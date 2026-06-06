import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, getLastInsertId } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { BENEFICIARY_CATEGORIES, BENEFICIARY_STATUSES } from "@/lib/distributions";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const createSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  gender: z.enum(["male", "female"]).optional(),
  category: z.enum(BENEFICIARY_CATEGORIES),
  nationalId: z.string().max(100).optional(),
  familySize: z.coerce.number().int().positive().optional(),
  monthlyIncome: z.coerce.number().min(0).optional(),
  address: z.string().optional(),
  status: z.enum(BENEFICIARY_STATUSES).optional(),
});

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function mapBeneficiary(row: {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  gender: string | null;
  category: string;
  national_id: string | null;
  family_size: number | null;
  monthly_income: number | string | null;
  address: string | null;
  status: string;
  verified_by: number | null;
  verified_at: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    gender: row.gender,
    category: row.category,
    nationalId: row.national_id,
    familySize: row.family_size,
    monthlyIncome: row.monthly_income != null ? Number(row.monthly_income) : null,
    address: row.address,
    status: row.status,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || `Beneficiary #${row.id}`,
  };
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/beneficiaries";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_VIEW");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "10")));
    const category = sp.get("category");
    const status = sp.get("status");
    const q = sp.get("q")?.trim();
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const args: Array<string | number> = [];
    if (category) {
      whereParts.push("b.category = ?");
      args.push(category);
    }
    if (status) {
      whereParts.push("b.status = ?");
      args.push(status);
    }
    if (q) {
      whereParts.push("(b.first_name LIKE ? OR b.last_name LIKE ? OR b.phone LIKE ? OR b.national_id LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM beneficiaries b ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        gender: string | null;
        category: string;
        national_id: string | null;
        family_size: number | null;
        monthly_income: number | string | null;
        address: string | null;
        status: string;
        verified_by: number | null;
        verified_at: Date | null;
        created_at: Date;
      }>
    >(
      `SELECT b.id, b.first_name, b.last_name, b.phone, b.gender, b.category,
              b.national_id, b.family_size, b.monthly_income, b.address,
              b.status, b.verified_by, b.verified_at, b.created_at
       FROM beneficiaries b
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      ...args,
      pageSize,
      offset,
    );

    return NextResponse.json({
      ok: true,
      data: { page, pageSize, total, items: items.map(mapBeneficiary) },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch beneficiaries failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch beneficiaries failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/beneficiaries";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_ADD");

    const validated = parseRequestBody(createSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    await prisma.$executeRawUnsafe(
      `INSERT INTO beneficiaries (first_name, last_name, phone, gender, category, national_id, family_size, monthly_income, address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      parsed.firstName ?? null,
      parsed.lastName ?? null,
      parsed.phone ?? null,
      parsed.gender ?? null,
      parsed.category,
      parsed.nationalId ?? null,
      parsed.familySize ?? null,
      parsed.monthlyIncome ?? null,
      parsed.address ?? null,
      parsed.status ?? "PENDING",
    );

    const id = await getLastInsertId();

    await logAudit({
      userId: session.userId,
      path,
      action: "BENEFICIARY_CREATED",
      module: "beneficiaries",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: { id } });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Create beneficiary failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: e?.message ?? "Create beneficiary failed" }, { status: e?.status ?? 500 });
  }
}
