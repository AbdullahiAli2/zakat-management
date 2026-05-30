import type { Prisma } from "@prisma/client";
import { getLastInsertId } from "./db";
import { getZakatPoolBalance } from "./accounting/wallets";
import {
  postCommunityDistributionJournal,
  reverseCommunityDistributionJournal,
} from "./accounting/postings";
import { DISTRIBUTION_TYPES } from "./distributions";

export { DISTRIBUTION_TYPES };
export const COMMUNITY_DISTRIBUTION_STATUSES = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as const;
export type CommunityDistributionStatus = (typeof COMMUNITY_DISTRIBUTION_STATUSES)[number];

type TxClient = Prisma.TransactionClient;

function transactionCode(prefix: string, id: number) {
  return `${prefix}-${id}-${Date.now()}`;
}

export async function approveCommunityDistribution(
  tx: TxClient,
  params: { communityDistributionId: number; approverUserId: number },
) {
  const rows = await tx.$queryRawUnsafe<
    Array<{
      id: number;
      status: string;
      amount: number | string;
      title: string;
      distribution_type: string;
      transaction_id: number | null;
    }>
  >(
    `SELECT id, status, amount, title, distribution_type, transaction_id
     FROM community_distributions WHERE id = ? LIMIT 1 FOR UPDATE`,
    params.communityDistributionId,
  );
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Community distribution not found"), { status: 404 });
  if (row.status !== "PENDING") throw Object.assign(new Error("Only pending distributions can be approved"), { status: 400 });
  if (row.transaction_id) throw Object.assign(new Error("Distribution already has a linked transaction"), { status: 400 });

  const amount = Number(row.amount);
  const poolBalance = await getZakatPoolBalance(tx);
  if (poolBalance < amount) {
    throw Object.assign(new Error("Insufficient zakat wallet balance"), { status: 400 });
  }

  const code = transactionCode("TXN-CDST", params.communityDistributionId);
  await tx.$executeRawUnsafe(
    `INSERT INTO transactions (user_id, account_id, zakat_payment_id, type, amount, status, transaction_code, reference, description, created_at)
     VALUES (?, NULL, NULL, 'DISTRIBUTION', ?, 'SUCCESS', ?, ?, ?, NOW())`,
    params.approverUserId,
    amount,
    code,
    code,
    `Community distribution: ${row.title} (${row.distribution_type})`,
  );

  const transactionId = await getLastInsertId(tx);
  if (!transactionId) throw Object.assign(new Error("Failed to create transaction"), { status: 500 });

  await postCommunityDistributionJournal(tx, {
    communityDistributionId: params.communityDistributionId,
    amount,
    transactionId,
    postedBy: params.approverUserId,
    distributionType: row.distribution_type,
    title: row.title,
  });

  await tx.$executeRawUnsafe(
    `UPDATE community_distributions
     SET status = 'APPROVED', approved_by = ?, approved_at = NOW(), transaction_id = ?
     WHERE id = ? AND status = 'PENDING'`,
    params.approverUserId,
    transactionId,
    params.communityDistributionId,
  );
}

export async function completeCommunityDistribution(
  tx: TxClient,
  params: { communityDistributionId: number },
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: number; status: string }>>(
    "SELECT id, status FROM community_distributions WHERE id = ? LIMIT 1 FOR UPDATE",
    params.communityDistributionId,
  );
  const row = rows[0];
  if (!row) throw Object.assign(new Error("Community distribution not found"), { status: 404 });
  if (row.status !== "APPROVED") {
    throw Object.assign(new Error("Only approved community distributions can be completed"), { status: 400 });
  }

  await tx.$executeRawUnsafe(
    `UPDATE community_distributions
     SET status = 'COMPLETED', completed_at = NOW()
     WHERE id = ? AND status = 'APPROVED'`,
    params.communityDistributionId,
  );
}

export async function undoCommunityDistributionAccounting(
  tx: TxClient,
  input: { communityDistributionId: number; reversedBy: number; transactionId?: number | null },
) {
  await reverseCommunityDistributionJournal(tx, {
    communityDistributionId: input.communityDistributionId,
    reversedBy: input.reversedBy,
    transactionId: input.transactionId,
  });
}
