import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation";
import { hashPassword, readJwtFromRequest, verifyPassword, verifySessionJwt } from "@/lib/auth";
import { logAudit, logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function getRequestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const path = "/api/profile/password";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, isActive: true },
    });
    if (!user || !user.isActive) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const validCurrent = await verifyPassword(parsed.data.currentPassword, user.password);
    if (!validCurrent) return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });

    const newHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: session.userId },
      data: { password: newHash },
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "PASSWORD_CHANGE",
      module: "profile",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; lineNumber?: number; status?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Change password failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Failed to change password" }, { status: e?.status ?? 500 });
  }
}

