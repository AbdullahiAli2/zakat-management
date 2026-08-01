import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { beneficiaryVerifySchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/beneficiaries/${resolved.id}/verify`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "BENEFICIARIES_VERIFY");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid beneficiary id" }, { status: 400 });

    const validated = parseRequestBody(beneficiaryVerifySchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    // Raw SQL avoids Prisma enum read failures when legacy DB values differ in case.
    if (parsed.status === "APPROVED" || parsed.status === "REJECTED") {
      await prisma.$executeRawUnsafe(
        `UPDATE beneficiaries
         SET status = ?, verified_by = ?, verified_at = NOW()
         WHERE id = ?`,
        parsed.status,
        session.userId,
        id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE beneficiaries
         SET status = ?, verified_by = NULL, verified_at = NULL
         WHERE id = ?`,
        parsed.status,
        id,
      );
    }

    await logAudit({
      userId: session.userId,
      path,
      action: `BENEFICIARY_${parsed.status}`,
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
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Verify beneficiary failed", path });
    return NextResponse.json({ ok: false, error: "Verify beneficiary failed" }, { status: e?.status ?? 500 });
  }
}
