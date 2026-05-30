import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { syncUserPermissionsSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/users/${resolved.id}/permissions`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "PERMISSIONS_MANAGE");

    const userId = Number(resolved.id);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    const validated = parseRequestBody(syncUserPermissionsSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const uniquePermissionIds = [...new Set(parsed.permissionIds)];

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    if (uniquePermissionIds.length > 0) {
      const existingPermissions = await prisma.permission.findMany({ where: { id: { in: uniquePermissionIds } }, select: { id: true } });
      if (existingPermissions.length !== uniquePermissionIds.length) {
        return NextResponse.json({ ok: false, error: "One or more permission IDs are invalid" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      if (uniquePermissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: uniquePermissionIds.map((permissionId) => ({ userId, permissionId })),
          skipDuplicates: true,
        });
      }
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_PERMISSIONS_UPDATED",
      module: "permissions",
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
    await logError({ userId: null, message: e?.message ?? "Sync user permissions failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Sync user permissions failed" }, { status: e?.status ?? 500 });
  }
}

