import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { syncUserGroupsSchema, toggleUserGroupSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/users/${resolved.id}/groups`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_VIEW");

    const userId = Number(resolved.id);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });

    const [groups, links] = await Promise.all([
      prisma.group.findMany({ orderBy: { name: "asc" } }),
      prisma.userGroup.findMany({ where: { userId }, select: { groupId: true } }),
    ]);
    const enabledSet = new Set(links.map((l) => l.groupId));
    return NextResponse.json({
      ok: true,
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        enabled: enabledSet.has(g.id),
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "User groups fetch failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "User groups fetch failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/users/${resolved.id}/groups`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_EDIT");

    const userId = Number(resolved.id);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    const validated = parseRequestBody(toggleUserGroupSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    if (parsed.enabled) {
      await prisma.userGroup.upsert({
        where: { userId_groupId: { userId, groupId: parsed.groupId } },
        update: {},
        create: { userId, groupId: parsed.groupId },
      });
    } else {
      await prisma.userGroup.deleteMany({
        where: { userId, groupId: parsed.groupId },
      });
    }

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_GROUP_APPLY",
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
    await logError({ userId: null, message: e?.message ?? "Apply user group failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Apply user group failed" }, { status: e?.status ?? 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/users/${resolved.id}/groups`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_EDIT");

    const userId = Number(resolved.id);
    if (!Number.isFinite(userId) || userId <= 0) return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    const validated = parseRequestBody(syncUserGroupsSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const uniqueGroupIds = [...new Set(parsed.groupIds)];

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    if (uniqueGroupIds.length > 0) {
      const existingGroups = await prisma.group.findMany({
        where: { id: { in: uniqueGroupIds } },
        select: { id: true },
      });
      if (existingGroups.length !== uniqueGroupIds.length) {
        return NextResponse.json({ ok: false, error: "One or more group IDs are invalid" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userGroup.deleteMany({ where: { userId } });
      if (uniqueGroupIds.length > 0) {
        await tx.userGroup.createMany({
          data: uniqueGroupIds.map((groupId) => ({ userId, groupId })),
          skipDuplicates: true,
        });
      }
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_GROUPS_UPDATED",
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
    await logError({ userId: null, message: e?.message ?? "Sync user groups failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Sync user groups failed" }, { status: e?.status ?? 500 });
  }
}

