import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { getPrimarySystemWalletSummary } from "@/lib/system-wallet";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest) {
  const path = "/api/admin/system-wallet";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "SYSTEM_WALLET_VIEW");

    const wallet = await getPrimarySystemWalletSummary();
    return NextResponse.json({
      ok: true,
      data: {
        id: wallet.id,
        code: wallet.code,
        balance: wallet.balance,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch system wallet failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch system wallet failed" }, { status: e?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  void req;
  return NextResponse.json(
    { ok: false, error: "Manual wallet balance updates are disabled. Balances are derived from posted journal entries." },
    { status: 405 },
  );
}
