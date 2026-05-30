import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

async function insertNotification(client: DbClient, input: { userId: number; title: string; message: string }) {
  await client.$executeRawUnsafe(
    `INSERT INTO notifications (user_id, title, message, is_read, created_at)
     VALUES (?, ?, ?, false, NOW())`,
    input.userId,
    input.title,
    input.message,
  );
  const rows = await client.$queryRawUnsafe<Array<{ id: number }>>("SELECT LAST_INSERT_ID() AS id");
  return { id: Number(rows[0]?.id ?? 0) };
}

export async function createNotification(input: {
  userId: number;
  title: string;
  message: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? prisma;
  return insertNotification(client, input);
}

export async function notifyPaymentApproved(input: { userId: number; paymentId: number; amount: string; tx?: Prisma.TransactionClient }) {
  return createNotification({
    userId: input.userId,
    title: "Zakat Payment Approved",
    message: `Your zakat payment #${input.paymentId} for ${input.amount} has been approved.`,
    tx: input.tx,
  });
}

export async function notifyReceiptGenerated(input: { userId: number; receiptNumber: string; tx?: Prisma.TransactionClient }) {
  return createNotification({
    userId: input.userId,
    title: "Receipt Generated",
    message: `Receipt ${input.receiptNumber} is now available for download.`,
    tx: input.tx,
  });
}

export async function notifyDistributionCompleted(input: {
  userId: number;
  distributionId: number;
  beneficiaryName: string;
  amount: string;
  tx?: Prisma.TransactionClient;
}) {
  return createNotification({
    userId: input.userId,
    title: "Distribution Completed",
    message: `Distribution #${input.distributionId} of ${input.amount} to ${input.beneficiaryName} has been completed.`,
    tx: input.tx,
  });
}

export async function markNotificationsAsRead(userId: number, opts?: { all?: boolean; ids?: number[] }) {
  if (opts?.all) {
    await prisma.$executeRawUnsafe("UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false", userId);
    return;
  }

  if (opts?.ids?.length) {
    const placeholders = opts.ids.map(() => "?").join(", ");
    await prisma.$executeRawUnsafe(
      `UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false AND id IN (${placeholders})`,
      userId,
      ...opts.ids,
    );
  }
}
