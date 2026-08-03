import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { committedThisCycle, getCyclePaymentTotals } from "./zakat-cycle";
import { getCurrentNisab } from "./nisab";

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
    const nisab = await getCurrentNisab(tx);
    if (!nisab) throw new Error("Nisab setting is not configured");
    const nisabValue = nisab.nisabValue;

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
    const cycleTotals = await getCyclePaymentTotals(tx, input.userId, donorAccount.id);

    if (cycleTotals.pendingPayment) {
      throw new Error("You already have a zakat payment pending admin approval");
    }

    const committed = committedThisCycle(cycleTotals);
    const remainingDue = Prisma.Decimal.max(recommendedZakat.minus(committed), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const payAmount = paymentAmount.toDecimalPlaces(2);
    if (remainingDue.lte(0)) {
      throw new Error("Zakat for this cycle is already fulfilled");
    }
    // Full amount only — underpaying (e.g. 249 when 250 is due) is rejected.
    if (!payAmount.equals(remainingDue)) {
      throw new Error(`You must pay the full zakat amount due (${remainingDue.toFixed(2)})`);
    }
    if (accountBalance.lt(payAmount)) {
      throw new Error("Insufficient account balance");
    }
    if (payAmount.lte(0)) throw new Error("Zakat amount must be greater than 0");

    await tx.$executeRawUnsafe(
      `INSERT INTO zakat_payments
       (user_id, account_id, amount, zakat_type, method, status, reference_number, approved_by, approved_at, nisab_checked, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL, NULL, ?, NOW())`,
      input.userId,
      donorAccount.id,
      payAmount.toNumber(),
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
      payAmount.toNumber(),
      pendingCode,
      pendingCode,
      `Pending zakat payment (recommended due: ${recommendedZakat.toString()})`,
    );

    return {
      paymentId: payment.id,
      amount: payAmount,
      nisabValue,
      createdAt: payment.created_at,
    };
  });
}

