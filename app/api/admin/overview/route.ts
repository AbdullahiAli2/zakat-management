import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { logError } from "@/lib/logging";
import { getZakatPoolBalance } from "@/lib/accounting/wallets";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest) {
  const path = "/api/admin/overview";

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    verifySessionJwt(token);

    const [usersRows, txRows, zakatRows, nisabRows, distributedRows, beneficiariesRows, zakatWalletBalance] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>("SELECT COUNT(*) as total FROM users"),
      prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>("SELECT COUNT(*) as total FROM transactions"),
      prisma.$queryRawUnsafe<Array<{ total: string | null }>>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'ZAKAT_PAYMENT' AND status = 'SUCCESS'",
      ),
      prisma.$queryRawUnsafe<Array<{ nisab_value: string | null }>>("SELECT nisab_value FROM nisab_settings ORDER BY updated_at DESC LIMIT 1"),
      prisma.$queryRawUnsafe<Array<{ total: string | null }>>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'DISTRIBUTION' AND status = 'SUCCESS'",
      ),
      prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>("SELECT COUNT(*) as total FROM distributions"),
      getZakatPoolBalance(),
    ]);

    const totalUsers = Number(usersRows[0]?.total ?? 0);
    const totalTransactions = Number(txRows[0]?.total ?? 0);
    const totalZakatCollected = zakatRows[0]?.total ?? "0";
    const currentNisab = nisabRows[0]?.nisab_value ?? "0";
    const remainingBalance = String(zakatWalletBalance);
    const totalDistributed = distributedRows[0]?.total ?? "0";
    const beneficiariesSupported = Number(beneficiariesRows[0]?.total ?? 0);

    return NextResponse.json({
      ok: true,
      data: {
        totalUsers,
        totalTransactions,
        totalZakatCollected: String(totalZakatCollected),
        currentNisab: String(currentNisab),
        totalDistributed: String(totalDistributed),
        remainingBalance: String(remainingBalance),
        beneficiariesSupported,
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
      message: e?.message ?? "Admin overview failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Admin overview failed" }, { status: statusCode });
  }
}

