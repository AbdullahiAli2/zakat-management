import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { logError } from "@/lib/logging";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().optional(),
  module: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const path = "/api/admin/audit";

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    verifySessionJwt(token);

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.parse(raw);

    const whereParts: string[] = [];
    const params: Array<string> = [];
    if (parsed.module) {
      whereParts.push("a.module = ?");
      params.push(parsed.module);
    }
    if (parsed.q) {
      const like = `%${parsed.q}%`;
      whereParts.push("(a.action LIKE ? OR a.module LIKE ? OR a.path LIKE ? OR a.ip_address LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)");
      params.push(like, like, like, like, like, like, like);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const totalRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) as total FROM audits a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`,
      ...params,
    );
    const totalRaw = totalRows[0]?.total ?? 0;
    const total = typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw);

    const offset = (parsed.page - 1) * parsed.pageSize;
    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        user_id: number | null;
        path: string;
        action: string;
        module: string;
        ip_address: string | null;
        browser: string | null;
        operating_system: string | null;
        created_at: Date;
        user_name: string | null;
        user_email: string | null;
      }>
    >(
      `SELECT a.id, a.user_id, a.path, a.action, a.module, a.ip_address, a.browser, a.operating_system, a.created_at,
              TRIM(CONCAT(IFNULL(u.first_name, ''), ' ', IFNULL(u.last_name, ''))) AS user_name,
              u.email AS user_email
       FROM audits a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      ...params,
      parsed.pageSize.toString(),
      offset.toString(),
    );

    const modules = await prisma.$queryRawUnsafe<Array<{ module: string | null }>>(
      "SELECT DISTINCT module FROM audits WHERE module IS NOT NULL ORDER BY module ASC",
    );

    return NextResponse.json({
      ok: true,
      data: {
        page: parsed.page,
        pageSize: parsed.pageSize,
        total,
        modules: modules.map((m) => m.module).filter((v): v is string => Boolean(v)),
        items: items.map((a) => ({
          id: a.id,
          userId: a.user_id,
          path: a.path,
          action: a.action,
          module: a.module,
          ip: a.ip_address ?? "",
          browser: a.browser ?? "",
          os: a.operating_system ?? "",
          createdAt: a.created_at,
          user: a.user_name ? { name: a.user_name, email: a.user_email ?? "" } : null,
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
      message: e?.message ?? "Audit fetch failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Audit fetch failed" }, { status: statusCode });
  }
}

