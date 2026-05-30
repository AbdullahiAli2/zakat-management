import { prisma } from "./db";
import { Prisma } from "@prisma/client";

async function getNisabValueWithTx(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRawUnsafe<Array<{ nisab_value: number | string }>>(
    "SELECT nisab_value FROM nisab_settings ORDER BY id DESC LIMIT 1",
  );
  if (!rows[0]) throw new Error("Nisab setting is not configured");
  return new Prisma.Decimal(rows[0].nisab_value);
}

export type PayZakatInput = {
  userId: number;
  amount: number | string | Prisma.Decimal;
  accountId: number;
  zakatType: "MAAL" | "BUSINESS";
  method: "EVCPLUS" | "E_DAHAB" | "ZAAD" | "CASH" | "WALLET";
};

export type PayZakatResult = {
  paymentId: number;
  amount: Prisma.Decimal;
  nisabValue: Prisma.Decimal;
  createdAt: Date;
};

export async function payZakat(input: PayZakatInput): Promise<PayZakatResult> {
  const paymentAmount = input.amount instanceof Prisma.Decimal ? input.amount : new Prisma.Decimal(input.amount);
  const rate = new Prisma.Decimal(0.025);

  return prisma.$transaction(async (tx) => {
    const nisabValue = await getNisabValueWithTx(tx);

    if (paymentAmount.lte(0)) throw new Error("Amount must be greater than 0");
    const accountRows = await tx.$queryRawUnsafe<Array<{ id: number; user_id: number; balance: number | string; status: string }>>(
      "SELECT id, user_id, balance, status FROM accounts WHERE id = ? LIMIT 1",
      input.accountId,
    );
    const donorAccount = accountRows[0];
    if (!donorAccount) throw new Error("Donor account not found");
    if (donorAccount.user_id !== input.userId) throw new Error("Account does not belong to current user");
    if (donorAccount.status !== "ACTIVE") throw new Error("Account is not active");

    const accountBalance = new Prisma.Decimal(donorAccount.balance);
    if (accountBalance.lte(0)) {
      throw new Error("You must create account and have balance before paying zakat");
    }
    const nisabChecked = accountBalance.gte(nisabValue);
    if (!nisabChecked) {
      throw new Error("Payment is below Nisab (85g gold) and cannot be approved");
    }
    // Zakat due is always computed from total wealth (account balance).
    // User-entered amount is only the amount they want to pay (full or partial).
    const recommendedZakat = accountBalance.mul(rate).toDecimalPlaces(2);
    const paidRows = await tx.$queryRawUnsafe<Array<{ paid: number | string }>>(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM zakat_payments
       WHERE user_id = ?
         AND account_id = ?
         AND status = 'APPROVED'
         AND approved_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')
         AND approved_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-01-01'), INTERVAL 1 YEAR)`,
      input.userId,
      donorAccount.id,
    );
    const paidThisCycle = new Prisma.Decimal(paidRows[0]?.paid ?? 0);
    const remainingDue = Prisma.Decimal.max(recommendedZakat.minus(paidThisCycle), new Prisma.Decimal(0));
    if (remainingDue.lte(0)) {
      throw new Error("Zakat for this cycle is already fulfilled");
    }
    if (paymentAmount.gt(remainingDue)) {
      throw new Error(`Amount exceeds remaining zakat due (${remainingDue.toString()}) for this cycle`);
    }
    if (accountBalance.lt(paymentAmount)) {
      throw new Error("Insufficient account balance");
    }
    if (paymentAmount.lte(0)) throw new Error("Zakat amount must be greater than 0");

    await tx.$executeRawUnsafe(
      `INSERT INTO zakat_payments
       (user_id, account_id, amount, zakat_type, method, status, reference_number, approved_by, approved_at, nisab_checked, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, NULL, ?, NOW())`,
      input.userId,
      donorAccount.id,
      paymentAmount.toNumber(),
      input.zakatType,
      input.method,
      `ZKT-${Date.now()}-${input.userId}`,
      nisabChecked ? 1 : 0,
    );

    // Use LAST_INSERT_ID for correct linkage under concurrency.
    const paymentRows = await tx.$queryRawUnsafe<Array<{ id: number; created_at: Date }>>(
      "SELECT id, created_at FROM zakat_payments WHERE id = LAST_INSERT_ID()",
    );
    const payment = paymentRows[0];
    if (!payment) throw new Error("Failed to create payment");

    // Create ONE pending transaction for the zakat payment.
    // System wallet is computed only from SUCCESS transactions, so this won't change it yet.
    const pendingCode = `TXN-PEND-ZKP-${payment.id}-${Date.now()}`;
    await tx.$executeRawUnsafe(
      `INSERT INTO transactions
        (user_id, account_id, zakat_payment_id, type, amount, status, transaction_code, reference, description, created_at)
       VALUES (?, ?, ?, 'ZAKAT_PAYMENT', ?, 'PENDING', ?, ?, ?, NOW())`,
      input.userId,
      donorAccount.id,
      payment.id,
      paymentAmount.toNumber(),
      pendingCode,
      pendingCode,
      `Pending zakat payment (recommended due: ${recommendedZakat.toString()})`,
    );

    return {
      paymentId: payment.id,
      amount: paymentAmount,
      nisabValue,
      createdAt: payment.created_at,
    };
  });
}

