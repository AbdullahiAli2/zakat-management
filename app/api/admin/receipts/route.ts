import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest) {
  const path = "/api/admin/receipts";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "RECEIPTS_VIEW");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "10")));
    const q = sp.get("q")?.trim();
    const offset = (page - 1) * pageSize;

    // Enforce rule: receipts must be linked to SUCCESS transactions only.
    const whereParts: string[] = ["t.status = 'SUCCESS'"];
    const args: Array<string | number> = [];
    if (q) {
      whereParts.push("r.receipt_number LIKE ?");
      args.push(`%${q}%`);
    }
    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total
       FROM receipts r
       INNER JOIN transactions t ON t.id = r.transaction_id
       ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        transaction_id: number;
        receipt_number: string;
        generated_at: Date;
        amount: number | string;
        created_at: Date;
        transaction_type: "ZAKAT_PAYMENT" | "DISTRIBUTION";
        payment_method: string | null;
        beneficiary_category: string | null;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT r.id, r.transaction_id, r.receipt_number, r.generated_at,
              t.amount, t.created_at,
              t.type AS transaction_type,
              zp.method AS payment_method,
              b.category AS beneficiary_category,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email
       FROM receipts r
       INNER JOIN transactions t ON t.id = r.transaction_id
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       LEFT JOIN distributions d ON d.transaction_id = t.id
       LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
       INNER JOIN users u ON u.id = t.user_id
       ${whereSql}
       ORDER BY r.generated_at DESC
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
          transactionId: r.transaction_id,
          receiptNumber: r.receipt_number,
          generatedAt: r.generated_at,
          transactionType: r.transaction_type,
          paymentMethod: r.payment_method,
          beneficiaryCategory: r.beneficiary_category,
          amount: Number(r.amount),
          transactionDate: r.created_at,
          user: { name: r.user_name, email: r.user_email },
        })),
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch receipts failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch receipts failed" }, { status: e?.status ?? 500 });
  }
}

