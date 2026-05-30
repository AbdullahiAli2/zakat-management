import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { isAdminRole, isDonorRole } from "@/lib/roles";
import { logAudit } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(255),
  balance: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const session = verifySessionJwt(token);

    const accounts = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; status: string; balance: number | string; created_at: Date }>>(
      "SELECT id, name, status, balance, created_at FROM accounts WHERE user_id = ? ORDER BY created_at DESC",
      session.userId,
    );
    const paidRows = await prisma.$queryRawUnsafe<Array<{ total: number | string | null }>>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM zakat_payments WHERE user_id = ?",
      session.userId,
    );
    const walletBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const totalZakatPaid = Number(paidRows[0]?.total ?? 0);

    return NextResponse.json({
      ok: true,
      data: {
        balance: walletBalance.toString(),
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status,
          balance: a.balance.toString(),
          createdAt: a.created_at,
        })),
        totalZakatPaid: totalZakatPaid.toString(),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    const parsed = createAccountSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true, role: true },
    });
    if (!user || !user.isActive) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!isDonorRole(user.role) && !isAdminRole(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.$executeRawUnsafe(
      "INSERT INTO accounts (user_id, name, balance, status, created_at) VALUES (?, ?, ?, 'ACTIVE', NOW())",
      session.userId,
      parsed.data.name,
      parsed.data.balance,
    );

    await logAudit({
      userId: session.userId,
      path: "/api/accounts/me",
      action: "ACCOUNT_CREATED_SELF",
      module: "accounts",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Create account failed" }, { status: 400 });
  }
}

