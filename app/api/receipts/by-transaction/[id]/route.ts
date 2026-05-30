import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/receipts/by-transaction/${resolved.id}`;

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "TRANSACTIONS_VIEW");

    const transactionId = Number(resolved.id);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid transaction id" }, { status: 400 });
    }

    // Donor can only fetch receipt for own SUCCESS transactions.
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        receipt_number: string;
        generated_at: Date;
        transaction_id: number;
        amount: number | string;
        type: "ZAKAT_PAYMENT" | "DISTRIBUTION" | "DEPOSIT";
        status: string;
        method: string | null;
        beneficiary_category: string | null;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT r.receipt_number, r.generated_at, r.transaction_id,
              t.amount, t.type, t.status,
              zp.method,
              b.category AS beneficiary_category,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email
       FROM receipts r
       INNER JOIN transactions t ON t.id = r.transaction_id
       INNER JOIN users u ON u.id = t.user_id
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       LEFT JOIN distributions d ON d.transaction_id = t.id
       LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
       WHERE r.transaction_id = ?
         AND t.status = 'SUCCESS'
         AND t.user_id = ?
       LIMIT 1`,
      transactionId,
      session.userId,
    );

    const r = rows[0];
    if (!r) return NextResponse.json({ ok: false, error: "Receipt not found" }, { status: 404 });

    if (r.type !== "ZAKAT_PAYMENT" && r.type !== "DISTRIBUTION") {
      return NextResponse.json({ ok: false, error: "Receipt not available for this transaction type" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        receiptNumber: r.receipt_number,
        generatedAt: r.generated_at,
        transactionId: r.transaction_id,
        transaction: {
          amount: Number(r.amount),
          type: r.type,
          method: r.method,
          beneficiaryCategory: r.beneficiary_category,
        },
        user: { name: r.user_name, email: r.user_email },
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Fetch receipt failed",
      stack: e?.stack,
      path,
      lineNumber: e?.lineNumber ?? null,
    });
    return NextResponse.json({ ok: false, error: e?.message ?? "Fetch receipt failed" }, { status: e?.status ?? 500 });
  }
}

