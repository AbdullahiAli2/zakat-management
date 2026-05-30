import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest) {
  const path = "/api/admin/zakat-payments";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_APPROVE");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "10")));
    const status = sp.get("status");
    const offset = (page - 1) * pageSize;
    const whereSql = status ? "WHERE zp.status = ?" : "";
    const args = status ? [status] : [];

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM zakat_payments zp ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        user_id: number;
        account_id: number | null;
        amount: number | string;
        zakat_type: string;
        method: string;
        status: string;
        reference_number: string | null;
        nisab_checked: boolean;
        created_at: Date;
        approved_at: Date | null;
        user_name: string | null;
        user_email: string | null;
        account_name: string | null;
      }>
    >(
      `SELECT zp.id, zp.user_id, zp.account_id, zp.amount, zp.zakat_type, zp.method, zp.status, zp.reference_number, zp.nisab_checked, zp.created_at, zp.approved_at,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email, a.name AS account_name
       FROM zakat_payments zp
       INNER JOIN users u ON u.id = zp.user_id
       LEFT JOIN accounts a ON a.id = zp.account_id
       ${whereSql}
       ORDER BY zp.created_at DESC
       LIMIT ? OFFSET ?`,
      ...args,
      pageSize,
      offset,
    );

    return NextResponse.json({
      ok: true,
      data: {
        page,
        pageSize,
        total,
        items: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          accountId: r.account_id,
          amount: Number(r.amount),
          zakatType: r.zakat_type,
          method: r.method,
          status: r.status,
          referenceNumber: r.reference_number,
          nisabChecked: Boolean(r.nisab_checked),
          createdAt: r.created_at,
          approvedAt: r.approved_at,
          user: { name: r.user_name, email: r.user_email },
          account: { name: r.account_name },
        })),
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch zakat payments failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch zakat payments failed" }, { status: e?.status ?? 500 });
  }
}

