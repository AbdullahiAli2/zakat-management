import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { BENEFICIARY_CATEGORIES } from "@/lib/distributions";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const updateSchema = z
  .object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
    category: z.enum(BENEFICIARY_CATEGORIES).optional(),
    nationalId: z.string().max(100).nullable().optional(),
    familySize: z.coerce.number().int().positive().nullable().optional(),
    monthlyIncome: z.coerce.number().min(0).nullable().optional(),
    address: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/beneficiaries/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_EDIT");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid beneficiary id" }, { status: 400 });
    const validated = parseRequestBody(updateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const currentRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      "SELECT id FROM beneficiaries WHERE id = ? LIMIT 1",
      id,
    );
    if (!currentRows[0]) return NextResponse.json({ ok: false, error: "Beneficiary not found" }, { status: 404 });

    await prisma.$executeRawUnsafe(
      `UPDATE beneficiaries SET
         first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         phone = COALESCE(?, phone),
         gender = COALESCE(?, gender),
         category = COALESCE(?, category),
         national_id = COALESCE(?, national_id),
         family_size = COALESCE(?, family_size),
         monthly_income = COALESCE(?, monthly_income),
         address = COALESCE(?, address)
       WHERE id = ?`,
      parsed.firstName ?? null,
      parsed.lastName ?? null,
      parsed.phone ?? null,
      parsed.gender ?? null,
      parsed.category ?? null,
      parsed.nationalId ?? null,
      parsed.familySize ?? null,
      parsed.monthlyIncome ?? null,
      parsed.address ?? null,
      id,
    );

    await logAudit({
      userId: session.userId,
      path,
      action: "BENEFICIARY_UPDATED",
      module: "beneficiaries",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Update beneficiary failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Update beneficiary failed" }, { status: e?.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/beneficiaries/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_DELETE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid beneficiary id" }, { status: 400 });

    const linked = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      "SELECT COUNT(*) AS total FROM distributions WHERE beneficiary_id = ?",
      id,
    );
    if (Number(linked[0]?.total ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: "Cannot delete beneficiary with existing distributions" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe("DELETE FROM beneficiaries WHERE id = ?", id);

    await logAudit({
      userId: session.userId,
      path,
      action: "BENEFICIARY_DELETED",
      module: "beneficiaries",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Delete beneficiary failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Delete beneficiary failed" }, { status: e?.status ?? 500 });
  }
}
