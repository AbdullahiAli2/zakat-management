import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { DISTRIBUTION_STATUSES, DISTRIBUTION_TYPES, finalizeDistributionTransaction } from "@/lib/distributions";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const createSchema = z.object({
  beneficiaryId: z.number().int().positive(),
  distributionType: z.enum(DISTRIBUTION_TYPES),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
  status: z.enum(DISTRIBUTION_STATUSES).default("COMPLETED"),
});

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/distributions";
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
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const args: Array<string | number> = [];
    if (category) {
      whereParts.push("b.category = ?");
      args.push(category);
    }
    if (status) {
      whereParts.push("d.status = ?");
      args.push(status);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total
       FROM distributions d
       INNER JOIN beneficiaries b ON b.id = d.beneficiary_id
       ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        beneficiary_id: number;
        beneficiary_first_name: string | null;
        beneficiary_last_name: string | null;
        beneficiary_category: string;
        distribution_type: string;
        status: string;
        amount: number | string;
        notes: string | null;
        created_at: Date;
        admin_id: number;
        admin_name: string | null;
      }>
    >(
      `SELECT d.id, d.beneficiary_id, b.first_name AS beneficiary_first_name, b.last_name AS beneficiary_last_name,
              b.category AS beneficiary_category, d.distribution_type, d.status, d.amount, d.notes, d.created_at,
              d.admin_id, CONCAT(u.first_name, ' ', u.last_name) AS admin_name
       FROM distributions d
       INNER JOIN beneficiaries b ON b.id = d.beneficiary_id
       LEFT JOIN users u ON u.id = d.admin_id
       ${whereSql}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      ...args,
      pageSize,
      offset,
    );

    return NextResponse.json({
      ok: true,
      data: {
        page,
        pageSize,
        total,
        items: items.map((d) => ({
          id: d.id,
          beneficiaryId: d.beneficiary_id,
          beneficiaryName: [d.beneficiary_first_name, d.beneficiary_last_name].filter(Boolean).join(" ").trim() || `Beneficiary #${d.beneficiary_id}`,
          beneficiaryCategory: d.beneficiary_category,
          distributionType: d.distribution_type,
          status: d.status,
          amount: Number(d.amount),
          notes: d.notes,
          createdAt: d.created_at,
          adminId: d.admin_id,
          adminName: d.admin_name,
        })),
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch distributions failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Fetch distributions failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/distributions";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_ADD");

    const validated = parseRequestBody(createSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const beneficiaryRows = await prisma.$queryRawUnsafe<
      Array<{ id: number; first_name: string | null; last_name: string | null }>
    >("SELECT id, first_name, last_name FROM beneficiaries WHERE id = ? LIMIT 1", parsed.beneficiaryId);
    const beneficiary = beneficiaryRows[0];
    if (!beneficiary) return NextResponse.json({ ok: false, error: "Beneficiary not found" }, { status: 404 });

    const beneficiaryName =
      [beneficiary.first_name, beneficiary.last_name].filter(Boolean).join(" ").trim() || `Beneficiary #${beneficiary.id}`;

    await prisma.$transaction(async (tx) => {
      const initialStatus = parsed.status === "COMPLETED" ? "PENDING" : parsed.status;

      await tx.$executeRawUnsafe(
        `INSERT INTO distributions (beneficiary_id, admin_id, transaction_id, amount, distribution_type, status, notes, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, NOW())`,
        parsed.beneficiaryId,
        session.userId,
        parsed.amount,
        parsed.distributionType,
        initialStatus,
        parsed.notes ?? null,
      );

      const distRows = await tx.$queryRawUnsafe<Array<{ id: number }>>("SELECT LAST_INSERT_ID() AS id");
      const distributionId = distRows[0]?.id;
      if (!distributionId) throw Object.assign(new Error("Failed to create distribution"), { status: 500 });

      if (parsed.status === "COMPLETED") {
        await finalizeDistributionTransaction(tx, {
          distributionId,
          adminUserId: session.userId,
          amount: parsed.amount,
          beneficiaryName,
          distributionType: parsed.distributionType,
        });
      }
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "DISTRIBUTION_CREATED",
      module: "distributions",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({ userId: null, message: e?.message ?? "Create distribution failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: e?.message ?? "Create distribution failed" }, { status: e?.status ?? 500 });
  }
}
