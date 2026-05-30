import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { permissionCreateSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function requestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/permissions";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "PERMISSIONS_MANAGE");

    const items = await prisma.permission.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ ok: true, data: items });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Permissions fetch failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Permissions fetch failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/permissions";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "PERMISSIONS_MANAGE");

    const body = await req.json();
    const validated = parseRequestBody(permissionCreateSchema, body);
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const item = await prisma.permission.create({ data: { codename: parsed.codename, name: parsed.name } });

    await logAudit({
      userId: session.userId,
      path,
      action: "PERMISSION_CREATE",
      module: "permissions",
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: item });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Permission create failed", stack: e?.stack, path, lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null });
    return NextResponse.json({ ok: false, error: "Permission create failed" }, { status: e?.status ?? 500 });
  }
}

