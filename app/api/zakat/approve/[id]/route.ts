import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { postZakatCollectionJournal } from "@/lib/accounting/postings";
import { notifyPaymentApproved, notifyReceiptGenerated } from "@/lib/notifications";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/zakat/approve/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_APPROVE");

    const paymentId = Number(resolved.id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) return NextResponse.json({ ok: false, error: "Invalid payment id" }, { status: 400 });

    const paymentRows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        user_id: number;
        account_id: number | null;
        amount: number | string;
        method: string;
        status: string;
        nisab_checked: boolean;
      }>
    >(
      "SELECT id, user_id, account_id, amount, method, status, nisab_checked FROM zakat_payments WHERE id = ? LIMIT 1",
      paymentId,
    );
    const payment = paymentRows[0];
    if (!payment) return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
    if (payment.status !== "PENDING") return NextResponse.json({ ok: false, error: "Payment is not pending" }, { status: 400 });
    if (!payment.nisab_checked) return NextResponse.json({ ok: false, error: "Payment is below Nisab and cannot be approved" }, { status: 400 });
    if (!payment.account_id) return NextResponse.json({ ok: false, error: "Payment has no account" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // Enforce idempotency/race-safety: only approve if still pending.
      const paymentUpdateResult = await tx.$executeRawUnsafe(
        "UPDATE zakat_payments SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'PENDING'",
        session.userId,
        payment.id,
      );
      if (typeof paymentUpdateResult === "number" && paymentUpdateResult < 1) {
        throw Object.assign(new Error("Payment is not pending"), { status: 400 });
      }

      const accRows = await tx.$queryRawUnsafe<Array<{ id: number; balance: number | string; status: string }>>(
        "SELECT id, balance, status FROM accounts WHERE id = ? LIMIT 1 FOR UPDATE",
        payment.account_id,
      );
      const acc = accRows[0];
      if (!acc || acc.status !== "ACTIVE") throw Object.assign(new Error("Account unavailable"), { status: 400 });
      const next = Number(acc.balance) - Number(payment.amount);
      if (next < 0) throw Object.assign(new Error("Insufficient account balance"), { status: 400 });
      await tx.$executeRawUnsafe("UPDATE accounts SET balance = ? WHERE id = ?", next, acc.id);

      // Update existing pending transaction (created at pay time), otherwise fall back for legacy payments.
      const successReference = `TXN-ZKP-${payment.id}-${Date.now()}`;
      const txnCode = successReference;
      const txnUpdateResult = await tx.$executeRawUnsafe(
        "UPDATE transactions SET status = 'SUCCESS', reference = ?, transaction_code = ?, description = ? WHERE zakat_payment_id = ? AND type = 'ZAKAT_PAYMENT' AND status = 'PENDING'",
        successReference,
        txnCode,
        "Approved zakat payment",
        payment.id,
      );
      if (typeof txnUpdateResult === "number" && txnUpdateResult < 1) {
        await tx.$executeRawUnsafe(
          `INSERT INTO transactions (user_id, account_id, zakat_payment_id, type, amount, status, transaction_code, reference, description, created_at)
           VALUES (?, ?, ?, 'ZAKAT_PAYMENT', ?, 'SUCCESS', ?, ?, ?, NOW())`,
          payment.user_id,
          payment.account_id,
          payment.id,
          Number(payment.amount),
          txnCode,
          successReference,
          "Approved zakat payment",
        );
      }

      // Fetch the exact transaction created/updated via reference to avoid wrong linkage.
      const txnRows = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        "SELECT id FROM transactions WHERE zakat_payment_id = ? AND type = 'ZAKAT_PAYMENT' AND reference = ? LIMIT 1",
        payment.id,
        successReference,
      );
      const txnId = txnRows[0]?.id;
      if (!txnId) throw Object.assign(new Error("Failed to create/resolve transaction for receipt"), { status: 500 });

      // Ensure receipt is created only once per transaction.
      const receiptRows = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        "SELECT id FROM receipts WHERE transaction_id = ? LIMIT 1",
        txnId,
      );
      if (!receiptRows[0]?.id) {
        const receiptNumber = `RCPT-${txnId}-${Date.now()}`;
        await tx.$executeRawUnsafe(
          "INSERT INTO receipts (transaction_id, receipt_number, generated_at) VALUES (?, ?, NOW())",
          txnId,
          receiptNumber,
        );
        await notifyReceiptGenerated({ userId: payment.user_id, receiptNumber, tx });
      }

      await postZakatCollectionJournal(tx, {
        paymentId: payment.id,
        amount: Number(payment.amount),
        transactionId: txnId,
        postedBy: session.userId,
      });

      await notifyPaymentApproved({
        userId: payment.user_id,
        paymentId: payment.id,
        amount: String(payment.amount),
        tx,
      });
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "ZAKAT_APPROVED",
      module: "zakat",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Approve zakat failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: e?.message ?? "Approve zakat failed" }, { status: e?.status ?? 500 });
  }
}

