import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { signSessionJwt, verifyPassword, type SessionUser } from "@/lib/auth";
import { logAudit, logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function getRequestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function makeCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export async function POST(req: NextRequest) {
  const path = "/api/auth/login";

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    const { email, password } = parsed.data;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        password: string;
        role: string;
        is_active: boolean;
      }>
    >(
      "SELECT id, first_name, last_name, email, password, role, is_active FROM users WHERE email = ? LIMIT 1",
      email,
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, user.password);
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    await prisma.$executeRawUnsafe("UPDATE users SET last_login = NOW() WHERE id = ?", user.id);

    const session: SessionUser = {
      userId: user.id,
      role: user.role as SessionUser["role"],
    };
    const sessionJwt = signSessionJwt(session);

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
    res.cookies.set("zakat_auth", sessionJwt, makeCookieOptions());

    await logAudit({
      userId: user.id,
      path,
      action: "LOGIN",
      module: "auth",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return res;
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Login failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });

    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Login failed" }, { status: statusCode });
  }
}

