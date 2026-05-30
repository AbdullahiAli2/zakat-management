import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validation";
import { logAudit, logError } from "@/lib/logging";
import { getAvatarUrl } from "@/lib/avatar";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function getRequestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/profile";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string | null;
        age: number | null;
        gender: "MALE" | "FEMALE" | null;
        country: string | null;
        city: string | null;
        address: string | null;
        is_active: boolean;
        created_at: Date;
        role: "SUPERUSER" | "ADMIN" | "DONOR";
      }>
    >(
      "SELECT id, first_name, last_name, email, phone, age, gender, country, city, address, is_active, created_at, role FROM users WHERE id = ? LIMIT 1",
      session.userId,
    );
    const user = rows[0];
    if (!user || !user.is_active) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const avatarUrl = await getAvatarUrl(user.id);

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        avatarUrl,
        phone: user.phone ?? null,
        age: user.age,
        gender: user.gender,
        country: user.country,
        city: user.city,
        address: user.address,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; lineNumber?: number; status?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Get profile failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Failed to get profile" }, { status: e?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const path = "/api/profile";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE users
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           age = COALESCE(?, age),
           gender = COALESCE(?, gender),
           country = COALESCE(?, country),
           city = COALESCE(?, city),
           address = COALESCE(?, address)
       WHERE id = ?`,
      parsed.data.firstName ?? null,
      parsed.data.lastName ?? null,
      parsed.data.phone ?? null,
      parsed.data.age ?? null,
      parsed.data.gender ?? null,
      parsed.data.country ?? null,
      parsed.data.city ?? null,
      parsed.data.address ?? null,
      session.userId,
    );
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string | null;
        age: number | null;
        gender: "MALE" | "FEMALE" | null;
        country: string | null;
        city: string | null;
        address: string | null;
        role: "SUPERUSER" | "ADMIN" | "DONOR";
      }>
    >(
      "SELECT id, first_name, last_name, email, phone, age, gender, country, city, address, role FROM users WHERE id = ? LIMIT 1",
      session.userId,
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    await logAudit({
      userId: session.userId,
      path,
      action: "PROFILE_UPDATE",
      module: "profile",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const avatarUrl = await getAvatarUrl(user.id);

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        avatarUrl,
        phone: user.phone ?? null,
        age: user.age,
        gender: user.gender,
        country: user.country,
        city: user.city,
        address: user.address,
        role: user.role,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; lineNumber?: number; status?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Update profile failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: e?.status ?? 500 });
  }
}

