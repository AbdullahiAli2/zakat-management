import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { adminUpdateUserSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function requestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/users/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "USERS_EDIT");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });

    const body = await req.json();
    const validated = parseRequestBody(adminUpdateUserSchema, body);
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone,
        age: parsed.age,
        gender: parsed.gender,
        country: parsed.country,
        city: parsed.city,
        address: parsed.address,
        isActive: parsed.isActive,
        role: parsed.role,
      },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, role: true },
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_UPDATE",
      module: "users",
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        name: `${updated.firstName} ${updated.lastName}`,
        email: updated.email,
        isActive: updated.isActive,
        role: updated.role,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Update user failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Update user failed" }, { status: e?.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/users/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "USERS_DELETE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    if (id === session.userId) return NextResponse.json({ ok: false, error: "Cannot delete your own account" }, { status: 400 });

    await prisma.user.delete({ where: { id } });

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_DELETE",
      module: "users",
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Delete user failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Delete user failed" }, { status: e?.status ?? 500 });
  }
}

