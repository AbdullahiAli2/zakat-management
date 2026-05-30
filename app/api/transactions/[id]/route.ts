import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/transactions/${resolved.id}`;

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "TRANSACTIONS_VIEW");

    const transactionId = Number(resolved.id);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid transaction id" }, { status: 400 });
    }

    const whereSql = !isAdminRole(session.role) ? "AND t.user_id = ?" : "";
    const args: Array<string | number> = [transactionId];
    if (whereSql) args.push(session.userId);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        created_at: Date;
        amount: number | string;
        type: "ZAKAT_PAYMENT" | "DISTRIBUTION" | "DEPOSIT";
        status: string;
        reference: string | null;
        method: string | null;
        beneficiary_category: string | null;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT t.id, t.created_at, t.amount, t.type, t.status, t.reference,
              zp.method,
              b.category AS beneficiary_category,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email
       FROM transactions t
       INNER JOIN users u ON u.id = t.user_id
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       LEFT JOIN distributions d ON d.transaction_id = t.id
       LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
       WHERE t.id = ? ${whereSql}
       LIMIT 1`,
      ...args,
    );

    const t = rows[0];
    if (!t) return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
        id: t.id,
        date: t.created_at,
        amount: Number(t.amount),
        type: t.type,
        status: t.status,
        reference: t.reference,
        method: t.method ?? null,
        beneficiaryCategory: t.beneficiary_category ?? null,
        user: { name: t.user_name, email: t.user_email },
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
      message: e?.message ?? "Fetch transaction failed",
      stack: e?.stack,
      path,
      lineNumber: e?.lineNumber ?? null,
    });
    return NextResponse.json({ ok: false, error: e?.message ?? "Fetch transaction failed" }, { status: e?.status ?? 500 });
  }
}

