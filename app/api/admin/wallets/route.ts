import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { createWalletSchema } from "@/lib/validation";
import { WALLET_STATUSES, WALLET_TYPES } from "@/lib/accounting/constants";
import { createWallet, getWalletBalance, listWallets, mapWallet } from "@/lib/accounting/wallets";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/wallets";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLETS_VIEW");

    const sp = req.nextUrl.searchParams;
    const walletTypeRaw = sp.get("walletType");
    const statusRaw = sp.get("status");
    const walletType = WALLET_TYPES.includes(walletTypeRaw as (typeof WALLET_TYPES)[number])
      ? (walletTypeRaw as (typeof WALLET_TYPES)[number])
      : undefined;
    const status = WALLET_STATUSES.includes(statusRaw as (typeof WALLET_STATUSES)[number])
      ? (statusRaw as (typeof WALLET_STATUSES)[number])
      : undefined;

    const rows = await listWallets(undefined, { walletType, status });
    const items = await Promise.all(rows.map(async (row) => mapWallet(row, await getWalletBalance(row.id))));

    return NextResponse.json({ ok: true, data: { items } });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "List wallets failed", path });
    return NextResponse.json({ ok: false, error: "List wallets failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/wallets";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLETS_CREATE");

    const validated = parseRequestBody(createWalletSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const wallet = await createWallet(undefined, {
      code: parsed.code,
      name: parsed.name,
      walletType: parsed.walletType,
      chartAccountId: parsed.chartAccountId,
      createdBy: session.userId,
    });
    if (!wallet) return NextResponse.json({ ok: false, error: "Failed to create wallet" }, { status: 500 });

    await logAudit({
      userId: session.userId,
      path,
      action: "WALLET_CREATED",
      module: "wallets",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: mapWallet(wallet, 0) });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Create wallet failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Create wallet failed" }, { status: e?.status ?? 500 });
  }
}
