import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { hashPassword, signSessionJwt } from "@/lib/auth";
import { logAudit, logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

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
    maxAge: 60 * 60 * 24 * 7,
  };
}

function prismaClientMessage(err: Prisma.PrismaClientKnownRequestError): string | null {
  if (err.code === "P2002") return "Email already in use";
  if (err.code === "P2022") {
    return "Database schema is out of date. Run: npm run db:repair then npm run db:migrate";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const path = "/api/auth/register";

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    const { firstName, lastName, email, password, phone, age, gender, country, city, address } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: passwordHash,
          phone: phone ?? null,
          age,
          gender,
          country,
          city,
          address,
          role: "DONOR",
          isActive: true,
        },
      });

      const wallet = await tx.account.findFirst({ where: { userId: created.id, name: "Main Wallet" } });
      if (!wallet) {
        await tx.account.create({
          data: {
            userId: created.id,
            name: "Main Wallet",
            balance: 0,
            status: "ACTIVE",
          },
        });
      }

      return created;
    });

    const sessionJwt = signSessionJwt({ userId: user.id, role: "DONOR" });
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        age: user.age,
        gender: user.gender,
        country: user.country,
        city: user.city,
        address: user.address,
        role: "DONOR",
      },
    });
    res.cookies.set("zakat_auth", sessionJwt, makeCookieOptions());

    await logAudit({
      userId: user.id,
      path,
      action: "REGISTER",
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

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const friendly = prismaClientMessage(err);
      if (friendly) {
        const status = err.code === "P2002" ? 409 : 500;
        return NextResponse.json({ ok: false, error: friendly }, { status });
      }
    }

    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Register failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });

    return NextResponse.json(
      { ok: false, error: "Registration failed. Please try again or contact support." },
      { status: e?.status ?? 500 },
    );
  }
}
