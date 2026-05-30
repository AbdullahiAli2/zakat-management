import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionJwt, readJwtFromRequest } from "@/lib/auth";
import { logAudit, logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

export async function POST(req: NextRequest) {
  const path = "/api/auth/logout";

  try {
    const token = readJwtFromRequest(req);
    let userId: number | null = null;

    if (token) {
      try {
        const session = verifySessionJwt(token);
        userId = session.userId;
      } catch {
        // ignore invalid token, we still clear cookie
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("zakat_auth", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    await logAudit({
      userId,
      path,
      action: "LOGOUT",
      module: "auth",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
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
      message: e?.message ?? "Logout failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json(
      { ok: false, error: "Logout failed" },
      { status: e?.status ?? 500 },
    );
  }
}

