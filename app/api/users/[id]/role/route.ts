import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { updateUserRoleSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/users/${resolved.id}/role`;
  let actorUserId: number | null = null;

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    actorUserId = session.userId;
    await requirePermission(session, "USERS_MANAGE");

    const userId = Number(resolved.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    }

    const validated = parseRequestBody(updateUserRoleSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: parsed.role,
        isActive: typeof parsed.isActive === "boolean" ? parsed.isActive : undefined,
      },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true, role: true },
    });

    await logAudit({
      userId: actorUserId,
      path,
      action: "USER_ROLE_UPDATE",
      module: "users",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
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
      userId: actorUserId,
      message: e?.message ?? "Failed to update user role",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Failed to update user role" }, { status: e?.status ?? 500 });
  }
}
