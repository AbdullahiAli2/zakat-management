import type { Prisma } from "@prisma/client";
import { notifyDistributionCompleted, notifyReceiptGenerated } from "./notifications";
import { postDistributionJournal, reverseDistributionJournal } from "./accounting/postings";
import { getZakatPoolBalance } from "./accounting/wallets";

export const BENEFICIARY_CATEGORIES = ["POOR", "ORPHAN", "WIDOW", "DISABLED", "STUDENT", "EMERGENCY"] as const;
export type BeneficiaryCategory = (typeof BENEFICIARY_CATEGORIES)[number];

export const BENEFICIARY_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type BeneficiaryStatus = (typeof BENEFICIARY_STATUSES)[number];

export const DISTRIBUTION_TYPES = ["FOOD", "CASH", "MEDICAL", "EDUCATION", "WATER", "EMERGENCY"] as const;
export type DistributionType = (typeof DISTRIBUTION_TYPES)[number];

export const DISTRIBUTION_STATUSES = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

type TxClient = Prisma.TransactionClient;

function transactionCode(prefix: string, id: number) {
  return `${prefix}-${id}-${Date.now()}`;
}

export async function approveDistribution(tx: TxClient, params: { distributionId: number; approverUserId: number }) {
  await tx.$executeRawUnsafe(
    "UPDATE distributions SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'PENDING'",
    params.approverUserId,
    params.distributionId,
  );
}

export async function finalizeDistributionTransaction(
  tx: TxClient,
  params: {
    distributionId: number;
    adminUserId: number;
    amount: number;
    beneficiaryName: string;
    distributionType: string;
    notifyUserId?: number;
  },
) {
  const poolBalance = await getZakatPoolBalance(tx);
  if (poolBalance < params.amount) {
    throw Object.assign(new Error("Insufficient zakat wallet balance"), { status: 400 });
  }

  const code = transactionCode("TXN-DST", params.distributionId);
  await tx.$executeRawUnsafe(
    `INSERT INTO transactions (user_id, account_id, zakat_payment_id, type, amount, status, transaction_code, reference, description, created_at)
     VALUES (?, NULL, NULL, 'DISTRIBUTION', ?, 'SUCCESS', ?, ?, ?, NOW())`,
    params.adminUserId,
    params.amount,
    code,
    code,
    `Distribution (${params.distributionType}) to ${params.beneficiaryName}`,
  );

  const txRows = await tx.$queryRawUnsafe<Array<{ id: number }>>("SELECT LAST_INSERT_ID() as id");
  const distributionTxId = txRows[0]?.id;
  if (!distributionTxId) throw Object.assign(new Error("Failed to create distribution transaction"), { status: 500 });

  await postDistributionJournal(tx, {
    distributionId: params.distributionId,
    amount: params.amount,
    transactionId: distributionTxId,
    postedBy: params.adminUserId,
    distributionType: params.distributionType,
  });

  await tx.$executeRawUnsafe(
    "UPDATE distributions SET transaction_id = ?, status = 'COMPLETED', completed_at = NOW() WHERE id = ?",
    distributionTxId,
    params.distributionId,
  );

  const receiptNumber = `RCPT-${distributionTxId}-${Date.now()}`;
  const receiptRows = await tx.$queryRawUnsafe<Array<{ id: number }>>(
    "SELECT id FROM receipts WHERE transaction_id = ? LIMIT 1",
    distributionTxId,
  );
  if (!receiptRows[0]?.id) {
    await tx.$executeRawUnsafe(
      "INSERT INTO receipts (transaction_id, receipt_number, generated_at) VALUES (?, ?, NOW())",
      distributionTxId,
      receiptNumber,
    );
  }

  if (params.notifyUserId) {
    await notifyReceiptGenerated({ userId: params.notifyUserId, receiptNumber, tx });
    await notifyDistributionCompleted({
      userId: params.notifyUserId,
      distributionId: params.distributionId,
      beneficiaryName: params.beneficiaryName,
      amount: String(params.amount),
      tx,
    });
  }
}

export async function undoDistributionAccounting(
  tx: TxClient,
  input: { distributionId: number; reversedBy: number; transactionId?: number | null },
) {
  await reverseDistributionJournal(tx, {
    distributionId: input.distributionId,
    reversedBy: input.reversedBy,
    transactionId: input.transactionId,
  });
}
