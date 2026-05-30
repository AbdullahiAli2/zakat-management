import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import type { TransactionStatus, TransactionType } from "@prisma/client";

export type ProcessTransactionOptions = {
  type?: TransactionType;
  status?: TransactionStatus;
  reference?: string;
  description?: string;
  userId: number;
  accountId?: number | null;
  zakatPaymentId?: number | null;
  tx?: Prisma.TransactionClient;
};

async function processTransactionCore(
  tx: Prisma.TransactionClient,
  amount: Prisma.Decimal,
  options: ProcessTransactionOptions,
) {
  const status = options.status ?? "SUCCESS";
  const type = options.type ?? "DEPOSIT";

  const transaction = await tx.transaction.create({
    data: {
      userId: options.userId,
      accountId: options.accountId ?? null,
      zakatPaymentId: options.zakatPaymentId ?? null,
      type,
      amount,
      status,
      reference: options.reference,
      description: options.description,
    },
  });

  return transaction;
}

// Reusable service: performs a financial transfer atomically.
// Includes ACID-like rollback behavior via `prisma.$transaction`.
export async function processTransaction(
  amount: number | string | Prisma.Decimal,
  options: ProcessTransactionOptions,
) {
  const amt = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);

  if (options.tx) {
    return processTransactionCore(options.tx, amt, options);
  }

  return prisma.$transaction((tx) => processTransactionCore(tx, amt, options));
}

