import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { adminCreateUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function requestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/users";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "USERS_ADD");

    const validated = parseRequestBody(adminCreateUserSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const exists = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (exists) return NextResponse.json({ ok: false, error: "Email already exists" }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        password: await hashPassword(parsed.password),
        phone: parsed.phone,
        age: parsed.age,
        gender: parsed.gender,
        country: parsed.country,
        city: parsed.city,
        address: parsed.address,
        role: parsed.role,
        isActive: parsed.isActive,
      },
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "USER_CREATE",
      module: "users",
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        isActive: user.isActive,
        role: user.role,
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
      message: e?.message ?? "Create user failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Create user failed" }, { status: e?.status ?? 500 });
  }
}
