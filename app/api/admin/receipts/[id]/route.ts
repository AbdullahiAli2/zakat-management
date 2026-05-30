import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/receipts/${resolved.id}`;

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "RECEIPTS_VIEW");

    const receiptId = Number(resolved.id);
    if (!Number.isFinite(receiptId) || receiptId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid receipt id" }, { status: 400 });
    }

    // Enforce rule: receipt must be linked to a SUCCESS transaction only.
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        transaction_id: number;
        receipt_number: string;
        generated_at: Date;
        txn_amount: number | string;
        txn_status: string;
        txn_type: string;
        txn_method: string | null;
        beneficiary_category: string | null;
        txn_created_at: Date;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT r.id, r.transaction_id, r.receipt_number, r.generated_at,
              t.amount as txn_amount, t.status as txn_status, t.type as txn_type, t.created_at as txn_created_at,
              zp.method as txn_method,
              b.category AS beneficiary_category,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email
       FROM receipts r
       INNER JOIN transactions t ON t.id = r.transaction_id
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       LEFT JOIN distributions d ON d.transaction_id = t.id
       LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
       INNER JOIN users u ON u.id = t.user_id
       WHERE r.id = ? AND t.status = 'SUCCESS'
       LIMIT 1`,
      receiptId,
    );

    const r = rows[0];
    if (!r) return NextResponse.json({ ok: false, error: "Receipt not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
        id: r.id,
        transactionId: r.transaction_id,
        receiptNumber: r.receipt_number,
        generatedAt: r.generated_at,
        transaction: {
          amount: Number(r.txn_amount),
          status: r.txn_status,
          type: r.txn_type,
          createdAt: r.txn_created_at,
          method: r.txn_method,
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

