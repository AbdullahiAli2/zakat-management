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
  goldPricePerGram: z.coerce.number().positive(),
});

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/nisab";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "NISAB_VIEW");

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; gold_price_per_gram: number | string; nisab_value: number | string; updated_at: Date }>>(
      "SELECT id, gold_price_per_gram, nisab_value, updated_at FROM nisab_settings ORDER BY id DESC LIMIT 1",
    );
    const current = rows[0] ?? null;

    return NextResponse.json({
      ok: true,
      data: current
        ? {
            id: current.id,
            goldPricePerGram: Number(current.gold_price_per_gram),
            nisabValue: Number(current.nisab_value),
            updatedAt: current.updated_at,
          }
        : null,
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch nisab failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch nisab failed" }, { status: e?.status ?? 500 });
  }
}

export async function PUT(req: NextRequest) {
  const path = "/api/admin/nisab";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "NISAB_EDIT");

    const validated = parseRequestBody(updateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const nisabValue = parsed.goldPricePerGram * 85;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>("SELECT id FROM nisab_settings ORDER BY id DESC LIMIT 1");
    if (rows[0]?.id) {
      await prisma.$executeRawUnsafe(
        "UPDATE nisab_settings SET gold_price_per_gram = ?, nisab_value = ?, updated_at = NOW() WHERE id = ?",
        parsed.goldPricePerGram,
        nisabValue,
        rows[0].id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO nisab_settings (gold_price_per_gram, nisab_value, updated_at) VALUES (?, ?, NOW())",
        parsed.goldPricePerGram,
        nisabValue,
      );
    }

    await logAudit({
      userId: session.userId,
      path,
      action: "NISAB_UPDATED",
      module: "nisab",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: { goldPricePerGram: parsed.goldPricePerGram, nisabValue } });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Update nisab failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Update nisab failed" }, { status: e?.status ?? 500 });
  }
}

