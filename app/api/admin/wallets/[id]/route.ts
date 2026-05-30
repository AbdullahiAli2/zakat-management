import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { walletStatusSchema } from "@/lib/validation";
import { activateWallet, getWalletBalance, getWalletById, mapWallet, suspendWallet } from "@/lib/accounting/wallets";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/wallets/${resolved.id}`;
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
    return NextResponse.json({ ok: true, data: mapWallet(wallet, balance) });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch wallet failed", path });
    return NextResponse.json({ ok: false, error: "Fetch wallet failed" }, { status: e?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/wallets/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLETS_SUSPEND");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid wallet id" }, { status: 400 });

    const validated = parseRequestBody(walletStatusSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const wallet =
      parsed.status === "SUSPENDED"
        ? await suspendWallet(id)
        : parsed.status === "ACTIVE"
          ? await activateWallet(id)
          : null;
    if (!wallet) return NextResponse.json({ ok: false, error: "Wallet not found" }, { status: 404 });

    await logAudit({
      userId: session.userId,
      path,
      action: parsed.status === "SUSPENDED" ? "WALLET_SUSPENDED" : "WALLET_ACTIVATED",
      module: "wallets",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    const balance = await getWalletBalance(id);
    return NextResponse.json({ ok: true, data: mapWallet(wallet, balance) });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Update wallet failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Update wallet failed" }, { status: e?.status ?? 500 });
  }
}
