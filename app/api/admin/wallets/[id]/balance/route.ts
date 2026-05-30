import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { getWalletBalance, getWalletById, mapWallet } from "@/lib/accounting/wallets";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/wallets/${resolved.id}/balance`;
  try {
    const token = readJwtFromRequest(_req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLETS_VIEW");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid wallet id" }, { status: 400 });

    const wallet = await getWalletById(id);
    if (!wallet) return NextResponse.json({ ok: false, error: "Wallet not found" }, { status: 404 });

    const balance = await getWalletBalance(id);
    return NextResponse.json({
      ok: true,
      data: {
        walletId: id,
        code: wallet.code,
        balance,
        computedFrom: "journal_entry_lines SUM(debit - credit)",
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch wallet balance failed", path });
    return NextResponse.json({ ok: false, error: "Fetch wallet balance failed" }, { status: e?.status ?? 500 });
  }
}
