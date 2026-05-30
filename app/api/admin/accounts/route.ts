import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const createSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  fullName: z.string().trim().min(2).max(255).optional(),
  name: z.string().min(2).max(255),
  balance: z.coerce.number().min(0).default(0),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
}).refine((v) => Boolean(v.userId) || Boolean(v.fullName), {
  message: "userId or fullName is required",
});

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/accounts";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLET_MANAGE");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "10")));
    const q = sp.get("q")?.trim();
    const offset = (page - 1) * pageSize;
    const whereSql = q ? "WHERE a.name LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?" : "";
    const args = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [];

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM accounts a INNER JOIN users u ON u.id = a.user_id ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        user_id: number;
        name: string;
        balance: number | string;
        status: string;
        created_at: Date;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT a.id, a.user_id, a.name, a.balance, a.status, a.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
       FROM accounts a
       INNER JOIN users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
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
        items: rows.map((a) => ({
          id: a.id,
          userId: a.user_id,
          name: a.name,
          balance: Number(a.balance),
          status: a.status,
          createdAt: a.created_at,
          user: { name: a.user_name, email: a.user_email },
        })),
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch accounts failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch accounts failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/accounts";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLET_MANAGE");

    const validated = parseRequestBody(createSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    let targetUserId = parsed.userId ?? null;
    if (!targetUserId && parsed.fullName) {
      const [firstName, ...rest] = parsed.fullName.trim().split(/\s+/);
      const lastName = rest.join(" ").trim();
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id
         FROM users
         WHERE first_name = ? AND (? = '' OR last_name = ?)
         ORDER BY id DESC
         LIMIT 2`,
        firstName,
        lastName,
        lastName,
      );
      if (rows.length === 0) return NextResponse.json({ ok: false, error: "Full name not found" }, { status: 404 });
      if (rows.length > 1) return NextResponse.json({ ok: false, error: "Multiple users found. Use unique full name." }, { status: 400 });
      targetUserId = rows[0].id;
    }
    if (!targetUserId) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    await prisma.$executeRawUnsafe(
      "INSERT INTO accounts (user_id, name, balance, status, created_at) VALUES (?, ?, ?, ?, NOW())",
      targetUserId,
      parsed.name,
      parsed.balance,
      parsed.status,
    );

    await logAudit({
      userId: session.userId,
      path,
      action: "ACCOUNT_CREATED",
      module: "accounts",
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
    await logError({ userId: null, message: e?.message ?? "Create account failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Create account failed" }, { status: e?.status ?? 500 });
  }
}

