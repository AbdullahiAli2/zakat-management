import { prisma } from "../db";
import { postZakatCollectionJournal, postDistributionJournal } from "./postings";

/** Backfill journal entries for historical SUCCESS transactions missing ledger postings. */
export async function backfillAccountingLedger() {
  const zakatRows = await prisma.$queryRawUnsafe<
    Array<{ payment_id: number; transaction_id: number; amount: number | string; user_id: number }>
  >(
    `SELECT zp.id AS payment_id, t.id AS transaction_id, t.amount, t.user_id
     FROM zakat_payments zp
     INNER JOIN transactions t ON t.zakat_payment_id = zp.id AND t.type = 'ZAKAT_PAYMENT' AND t.status = 'SUCCESS'
     LEFT JOIN journal_entries je ON je.reference_type = 'ZAKAT_PAYMENT' AND je.reference_id = zp.id AND je.status = 'POSTED'
     WHERE je.id IS NULL`,
  );

  for (const row of zakatRows) {
    await prisma.$transaction(async (tx) => {
      await postZakatCollectionJournal(tx, {
        paymentId: row.payment_id,
        amount: Number(row.amount),
        transactionId: row.transaction_id,
        postedBy: row.user_id,
      });
    });
  }

  const distRows = await prisma.$queryRawUnsafe<
    Array<{ distribution_id: number; transaction_id: number; amount: number | string; admin_id: number; distribution_type: string }>
  >(
    `SELECT d.id AS distribution_id, t.id AS transaction_id, t.amount, d.admin_id, d.distribution_type
     FROM distributions d
     INNER JOIN transactions t ON t.id = d.transaction_id AND t.type = 'DISTRIBUTION' AND t.status = 'SUCCESS'
     LEFT JOIN journal_entries je ON je.reference_type = 'DISTRIBUTION' AND je.reference_id = d.id AND je.status = 'POSTED'
     WHERE je.id IS NULL`,
  );

  for (const row of distRows) {
    await prisma.$transaction(async (tx) => {
      await postDistributionJournal(tx, {
        distributionId: row.distribution_id,
        amount: Number(row.amount),
        transactionId: row.transaction_id,
        postedBy: row.admin_id,
        distributionType: row.distribution_type,
      });
    });
  }

  return { zakatBackfilled: zakatRows.length, distributionBackfilled: distRows.length };
}
