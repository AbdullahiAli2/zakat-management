import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { groupCreateSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function requestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/groups";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_VIEW");

    const groups = await prisma.group.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { users: true, permissions: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        usersCount: g._count.users,
        permissionsCount: g._count.permissions,
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Groups fetch failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Groups fetch failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/groups";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "GROUPS_ADD");

    const body = await req.json();
    const validated = parseRequestBody(groupCreateSchema, body);
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const group = await prisma.group.create({ data: { name: parsed.name } });

    await logAudit({
      userId: session.userId,
      path,
      action: "GROUP_CREATE",
      module: "groups",
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: group });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Group create failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Group create failed" }, { status: e?.status ?? 500 });
  }
}

