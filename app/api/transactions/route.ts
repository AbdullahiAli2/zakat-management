import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const statusValues = ["PENDING", "SUCCESS", "FAILED"] as const;
const typeValues = ["DEPOSIT", "ZAKAT_PAYMENT", "DISTRIBUTION"] as const;
const methodValues = ["EVCPLUS", "E_DAHAB", "ZAAD", "CASH", "WALLET"] as const;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  type: z.enum(typeValues).optional(),
  status: z.enum(statusValues).optional(),
  method: z.enum(methodValues).optional(),
});

export async function GET(req: NextRequest) {
  const path = "/api/transactions";

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const session = verifySessionJwt(token);
    await requirePermission(session, "TRANSACTIONS_VIEW");

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    const { page, pageSize, dateFrom, dateTo, type, status, method } = parsed.data;
    const offset = (page - 1) * pageSize;
    const whereParts: string[] = [];
    const args: Array<string | number> = [];

    if (!isAdminRole(session.role)) {
      whereParts.push("t.user_id = ?");
      args.push(session.userId);
    }
    if (type) {
      whereParts.push("t.type = ?");
      args.push(type);
    }
    if (status) {
      whereParts.push("t.status = ?");
      args.push(status);
    }
    if (dateFrom) {
      whereParts.push("t.created_at >= ?");
      args.push(dateFrom.toISOString().slice(0, 19).replace("T", " "));
    }
    if (dateTo) {
      whereParts.push("t.created_at <= ?");
      args.push(dateTo.toISOString().slice(0, 19).replace("T", " "));
    }
    if (method) {
      whereParts.push("zp.method = ?");
      args.push(method);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total
       FROM transactions t
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        created_at: Date;
        amount: number | string;
        type: string;
        status: string;
        reference: string | null;
        method: string | null;
      }>
    >(
      `SELECT t.id, t.created_at, t.amount, t.type, t.status, t.reference, zp.method
       FROM transactions t
       LEFT JOIN zakat_payments zp ON zp.id = t.zakat_payment_id
       ${whereSql}
       ORDER BY t.created_at DESC
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
        items: items.map((t) => ({
          id: t.id,
          date: t.created_at,
          amount: Number(t.amount).toString(),
          type: t.type,
          method: t.method ?? "-",
          status: t.status,
          reference: t.reference,
        })),
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
      message: e?.message ?? "Failed to fetch transactions",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });

    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Failed to fetch transactions" }, { status: statusCode });
  }
}

