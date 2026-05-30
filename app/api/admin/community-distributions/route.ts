import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma, getLastInsertId } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { communityDistributionCreateSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function mapRow(row: {
  id: number;
  admin_id: number;
  admin_name: string | null;
  transaction_id: number | null;
  title: string;
  distribution_type: string;
  beneficiary_count: number;
  amount: number | string;
  location: string | null;
  status: string;
  notes: string | null;
  approved_by: number | null;
  approver_name: string | null;
  approved_at: Date | null;
  completed_at: Date | null;
  distribution_date: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    adminId: row.admin_id,
    adminName: row.admin_name,
    transactionId: row.transaction_id,
    title: row.title,
    distributionType: row.distribution_type,
    beneficiaryCount: row.beneficiary_count,
    amount: Number(row.amount),
    location: row.location,
    status: row.status,
    notes: row.notes,
    approvedBy: row.approved_by,
    approverName: row.approver_name,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
    distributionDate: row.distribution_date,
    createdAt: row.created_at,
  };
}

const listSelect = `
  cd.id, cd.admin_id, CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
  cd.transaction_id, cd.title, cd.distribution_type, cd.beneficiary_count, cd.amount,
  cd.location, cd.status, cd.notes, cd.approved_by,
  CONCAT(ap.first_name, ' ', ap.last_name) AS approver_name,
  cd.approved_at, cd.completed_at, cd.distribution_date, cd.created_at
`;

export async function GET(req: NextRequest) {
  const path = "/api/admin/community-distributions";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "COMMUNITY_DISTRIBUTIONS_VIEW");

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "10")));
    const status = sp.get("status");
    const q = sp.get("q")?.trim();
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const args: Array<string | number> = [];
    if (status) {
      whereParts.push("cd.status = ?");
      args.push(status);
    }
    if (q) {
      whereParts.push("(cd.title LIKE ? OR cd.location LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `SELECT COUNT(*) AS total FROM community_distributions cd ${whereSql}`,
      ...args,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        admin_id: number;
        admin_name: string | null;
        transaction_id: number | null;
        title: string;
        distribution_type: string;
        beneficiary_count: number;
        amount: number | string;
        location: string | null;
        status: string;
        notes: string | null;
        approved_by: number | null;
        approver_name: string | null;
        approved_at: Date | null;
        completed_at: Date | null;
        distribution_date: Date | null;
        created_at: Date;
      }>
    >(
      `SELECT ${listSelect}
       FROM community_distributions cd
       LEFT JOIN users u ON u.id = cd.admin_id
       LEFT JOIN users ap ON ap.id = cd.approved_by
       ${whereSql}
       ORDER BY cd.created_at DESC
       LIMIT ? OFFSET ?`,
      ...args,
      pageSize,
      offset,
    );

    return NextResponse.json({
      ok: true,
      data: { page, pageSize, total, items: items.map(mapRow) },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "List community distributions failed", path });
    return NextResponse.json({ ok: false, error: "List community distributions failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/community-distributions";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "COMMUNITY_DISTRIBUTIONS_CREATE");

    const validated = parseRequestBody(communityDistributionCreateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    await prisma.$executeRawUnsafe(
      `INSERT INTO community_distributions
         (admin_id, title, distribution_type, beneficiary_count, amount, location, status, notes, distribution_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, NOW())`,
      session.userId,
      parsed.title,
      parsed.distributionType,
      parsed.beneficiaryCount,
      parsed.amount,
      parsed.location ?? null,
      parsed.notes ?? null,
      parsed.distributionDate ? new Date(parsed.distributionDate) : null,
    );

    const id = await getLastInsertId();

    await logAudit({
      userId: session.userId,
      path,
      action: "COMMUNITY_DISTRIBUTION_CREATED",
      module: "community_distributions",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: { id } });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Create community distribution failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Create community distribution failed" }, { status: e?.status ?? 500 });
  }
}
