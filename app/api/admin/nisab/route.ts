import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";
import { getCurrentNisab } from "@/lib/nisab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const updateSchema = z.object({
  goldPricePerGram: z.coerce.number().positive(),
});

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function noStoreJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/nisab";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return noStoreJson({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "NISAB_VIEW");

    const current = await getCurrentNisab();

    return noStoreJson({
      ok: true,
      data: current
        ? {
            id: current.id,
            goldPricePerGram: Number(current.goldPricePerGram),
            nisabValue: Number(current.nisabValue),
            updatedAt: current.updatedAt,
          }
        : null,
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return noStoreJson(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch nisab failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return noStoreJson({ ok: false, error: "Fetch nisab failed" }, { status: e?.status ?? 500 });
  }
}

export async function PUT(req: NextRequest) {
  const path = "/api/admin/nisab";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return noStoreJson({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "NISAB_EDIT");

    const validated = parseRequestBody(updateSchema, await req.json());
    if (!validated.ok) return noStoreJson(validated.body, { status: validated.status });
    const parsed = validated.data;
    const nisabValue = Number((parsed.goldPricePerGram * 85).toFixed(2));

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      "SELECT id FROM nisab_settings ORDER BY updated_at DESC, id DESC LIMIT 1",
    );
    if (rows[0]?.id) {
      await prisma.$executeRawUnsafe(
        "UPDATE nisab_settings SET gold_price_per_gram = ?, nisab_value = ?, updated_at = NOW(3) WHERE id = ?",
        parsed.goldPricePerGram,
        nisabValue,
        rows[0].id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO nisab_settings (gold_price_per_gram, nisab_value, updated_at) VALUES (?, ?, NOW(3))",
        parsed.goldPricePerGram,
        nisabValue,
      );
    }

    // Keep pending donor payments aligned with the new threshold (balance vs nisab).
    await prisma.$executeRawUnsafe(
      `UPDATE zakat_payments zp
       INNER JOIN accounts a ON a.id = zp.account_id
       SET zp.nisab_checked = CASE WHEN CAST(a.balance AS DECIMAL(15,2)) >= ? THEN 1 ELSE 0 END
       WHERE zp.status = 'PENDING'`,
      nisabValue,
    );

    await logAudit({
      userId: session.userId,
      path,
      action: "NISAB_UPDATED",
      module: "nisab",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    const fresh = await getCurrentNisab();

    return noStoreJson({
      ok: true,
      data: {
        goldPricePerGram: Number(fresh?.goldPricePerGram ?? parsed.goldPricePerGram),
        nisabValue: Number(fresh?.nisabValue ?? nisabValue),
        updatedAt: fresh?.updatedAt ?? new Date(),
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return noStoreJson(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Update nisab failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return noStoreJson({ ok: false, error: "Update nisab failed" }, { status: e?.status ?? 500 });
  }
}
