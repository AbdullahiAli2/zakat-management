import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const querySchema = z.object({
  q: z.string().optional(),
  role: z.enum(["SUPERUSER", "ADMIN", "DONOR"]).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: NextRequest) {
  const path = "/api/users/search";

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    verifySessionJwt(token);

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.parse(raw);

    const whereParts: string[] = [];
    const params: Array<string | number | boolean> = [];

    if (parsed.q) {
      const like = `%${parsed.q}%`;
      whereParts.push("(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR country LIKE ? OR city LIKE ?)");
      params.push(like, like, like, like, like, like);
    }
    if (parsed.role === "SUPERUSER") {
      whereParts.push("role = 'SUPERUSER'");
    } else if (parsed.role === "ADMIN") {
      whereParts.push("role = 'ADMIN'");
    } else if (parsed.role === "DONOR") {
      whereParts.push("role = 'DONOR'");
    }
    if (typeof parsed.isActive === "boolean") {
      whereParts.push("is_active = ?");
      params.push(parsed.isActive);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM users ${whereSql}`,
      ...params,
    );
    const totalRaw = countRows[0]?.total ?? 0;
    const total = typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw);

    const offset = (parsed.page - 1) * parsed.pageSize;
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        is_active: boolean;
        role: string;
        last_login: Date | null;
        created_at: Date;
        phone: string | null;
        age: number | null;
        gender: "male" | "female" | null;
        country: string | null;
        city: string | null;
        address: string | null;
      }>
    >(
      `SELECT id, first_name, last_name, email, is_active, role, last_login, created_at, phone, age, gender, country, city, address
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      ...params,
      parsed.pageSize,
      offset,
    );

    return NextResponse.json({
      ok: true,
      data: {
        page: parsed.page,
        pageSize: parsed.pageSize,
        total,
        items: rows.map((u) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          role: u.role,
          isActive: u.is_active,
          lastLogin: u.last_login,
          createdAt: u.created_at,
          phone: u.phone,
          age: u.age,
          gender: u.gender,
          country: u.country,
          city: u.city,
          address: u.address,
        })),
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
      message: e?.message ?? "Users search failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Users search failed" }, { status: statusCode });
  }
}

