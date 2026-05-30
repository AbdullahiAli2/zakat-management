import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  balance: z.coerce.number().min(0).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/accounts/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLET_MANAGE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid account id" }, { status: 400 });
    const validated = parseRequestBody(updateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    await prisma.$executeRawUnsafe(
      "UPDATE accounts SET name = COALESCE(?, name), balance = COALESCE(?, balance), status = COALESCE(?, status) WHERE id = ?",
      parsed.name ?? null,
      typeof parsed.balance === "number" ? parsed.balance : null,
      parsed.status ?? null,
      id,
    );

    await logAudit({ userId: session.userId, path, action: "ACCOUNT_UPDATED", module: "accounts", ip: ip(req), userAgent: req.headers.get("user-agent") });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Update account failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Update account failed" }, { status: e?.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/accounts/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "WALLET_MANAGE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid account id" }, { status: 400 });

    const linked = await prisma.$queryRawUnsafe<Array<{ c: bigint | number }>>(
      "SELECT COUNT(*) AS c FROM zakat_payments WHERE account_id = ?",
      id,
    );
    if (Number(linked[0]?.c ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: "Cannot delete account linked to payments" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe("DELETE FROM accounts WHERE id = ?", id);
    await logAudit({ userId: session.userId, path, action: "ACCOUNT_DELETED", module: "accounts", ip: ip(req), userAgent: req.headers.get("user-agent") });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Delete account failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Delete account failed" }, { status: e?.status ?? 500 });
  }
}

