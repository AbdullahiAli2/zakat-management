import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { getWalletLedger } from "@/lib/accounting/wallets";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/wallets/${resolved.id}/ledger`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLETS_LEDGER_VIEW");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid wallet id" }, { status: 400 });

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "25")));

    const ledger = await getWalletLedger(id, { page, pageSize });
    return NextResponse.json({ ok: true, data: ledger });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch wallet ledger failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Fetch wallet ledger failed" }, { status: e?.status ?? 500 });
  }
}
