import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type DbClient = Prisma.TransactionClient | typeof prisma;

const YEAR_START = `DATE_FORMAT(CURDATE(), '%Y-01-01')`;
const YEAR_END = `DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-01-01'), INTERVAL 1 YEAR)`;

export type CyclePaymentTotals = {
  approvedPaid: Prisma.Decimal;
  pendingPaid: Prisma.Decimal;
  pendingPayment: { id: number; amount: Prisma.Decimal } | null;
};

export async function getCyclePaymentTotals(
  client: DbClient,
  userId: number,
  accountId: number,
): Promise<CyclePaymentTotals> {
  const rows = await client.$queryRawUnsafe<
    Array<{ approved_paid: number | string; pending_paid: number | string }>
  >(
    `SELECT
       COALESCE(SUM(CASE
         WHEN status = 'APPROVED'
           AND approved_at >= ${YEAR_START}
           AND approved_at < ${YEAR_END}
         THEN amount ELSE 0 END), 0) AS approved_paid,
       COALESCE(SUM(CASE
         WHEN status = 'PENDING'
           AND created_at >= ${YEAR_START}
           AND created_at < ${YEAR_END}
         THEN amount ELSE 0 END), 0) AS pending_paid
     FROM zakat_payments
     WHERE user_id = ?
       AND account_id = ?
       AND status IN ('APPROVED', 'PENDING')`,
    userId,
    accountId,
  );

  const pendingRows = await client.$queryRawUnsafe<Array<{ id: number; amount: number | string }>>(
    `SELECT id, amount
     FROM zakat_payments
     WHERE user_id = ?
       AND account_id = ?
       AND status = 'PENDING'
       AND created_at >= ${YEAR_START}
       AND created_at < ${YEAR_END}
     ORDER BY created_at DESC
     LIMIT 1`,
    userId,
    accountId,
  );

  const pending = pendingRows[0];
  return {
    approvedPaid: new Prisma.Decimal(rows[0]?.approved_paid ?? 0),
    pendingPaid: new Prisma.Decimal(rows[0]?.pending_paid ?? 0),
    pendingPayment: pending
      ? { id: pending.id, amount: new Prisma.Decimal(pending.amount) }
      : null,
  };
}

export function committedThisCycle(totals: CyclePaymentTotals) {
  return totals.approvedPaid.plus(totals.pendingPaid);
}
