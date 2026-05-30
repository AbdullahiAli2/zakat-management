import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { syncGroupPermissionsSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/groups/${resolved.id}/permissions`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_VIEW");

    const groupId = Number(resolved.id);
    if (!Number.isFinite(groupId) || groupId <= 0) return NextResponse.json({ ok: false, error: "Invalid group id" }, { status: 400 });

    const [permissions, links] = await Promise.all([
      prisma.permission.findMany({ orderBy: { codename: "asc" } }),
      prisma.groupPermission.findMany({ where: { groupId }, select: { permissionId: true } }),
    ]);
    const enabledSet = new Set(links.map((l) => l.permissionId));

    return NextResponse.json({
      ok: true,
      data: permissions.map((p) => ({
        id: p.id,
        codename: p.codename,
        name: p.name,
        enabled: enabledSet.has(p.id),
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Group permissions fetch failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Group permissions fetch failed" }, { status: e?.status ?? 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/groups/${resolved.id}/permissions`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "PERMISSIONS_MANAGE");

    const groupId = Number(resolved.id);
    if (!Number.isFinite(groupId) || groupId <= 0) return NextResponse.json({ ok: false, error: "Invalid group id" }, { status: 400 });
    const validated = parseRequestBody(syncGroupPermissionsSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const uniquePermissionIds = [...new Set(parsed.permissionIds)];

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

    if (uniquePermissionIds.length > 0) {
      const existingPermissions = await prisma.permission.findMany({
        where: { id: { in: uniquePermissionIds } },
        select: { id: true },
      });
      if (existingPermissions.length !== uniquePermissionIds.length) {
        return NextResponse.json({ ok: false, error: "One or more permission IDs are invalid" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupPermission.deleteMany({ where: { groupId } });
      if (uniquePermissionIds.length > 0) {
        await tx.groupPermission.createMany({
          data: uniquePermissionIds.map((permissionId) => ({ groupId, permissionId })),
          skipDuplicates: true,
        });
      }
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "GROUP_PERMISSIONS_UPDATED",
      module: "groups",
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
    await logError({ userId: null, message: e?.message ?? "Update group permissions failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Update group permissions failed" }, { status: e?.status ?? 500 });
  }
}

