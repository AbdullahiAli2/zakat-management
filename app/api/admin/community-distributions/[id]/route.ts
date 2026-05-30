import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { communityDistributionUpdateSchema } from "@/lib/validation";
import { undoCommunityDistributionAccounting } from "@/lib/community-distributions";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/community-distributions/${resolved.id}`;
  try {
    const token = readJwtFromRequest(_req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "COMMUNITY_DISTRIBUTIONS_VIEW");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

    const rows = await prisma.$queryRawUnsafe<
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
      `SELECT cd.id, cd.admin_id, CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
              cd.transaction_id, cd.title, cd.distribution_type, cd.beneficiary_count, cd.amount,
              cd.location, cd.status, cd.notes, cd.approved_by,
              CONCAT(ap.first_name, ' ', ap.last_name) AS approver_name,
              cd.approved_at, cd.completed_at, cd.distribution_date, cd.created_at
       FROM community_distributions cd
       LEFT JOIN users u ON u.id = cd.admin_id
       LEFT JOIN users ap ON ap.id = cd.approved_by
       WHERE cd.id = ? LIMIT 1`,
      id,
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
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
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch community distribution failed", path });
    return NextResponse.json({ ok: false, error: "Fetch community distribution failed" }, { status: e?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/community-distributions/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "COMMUNITY_DISTRIBUTIONS_CREATE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    const validated = parseRequestBody(communityDistributionUpdateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const currentRows = await prisma.$queryRawUnsafe<Array<{ status: string; transaction_id: number | null }>>(
      "SELECT status, transaction_id FROM community_distributions WHERE id = ? LIMIT 1",
      id,
    );
    const current = currentRows[0];
    if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (current.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: "Only pending community distributions can be edited" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE community_distributions SET
         title = COALESCE(?, title),
         distribution_type = COALESCE(?, distribution_type),
         beneficiary_count = COALESCE(?, beneficiary_count),
         amount = COALESCE(?, amount),
         location = COALESCE(?, location),
         notes = COALESCE(?, notes),
         distribution_date = COALESCE(?, distribution_date)
       WHERE id = ?`,
      parsed.title ?? null,
      parsed.distributionType ?? null,
      parsed.beneficiaryCount ?? null,
      parsed.amount ?? null,
      parsed.location ?? null,
      parsed.notes ?? null,
      parsed.distributionDate ? new Date(parsed.distributionDate) : null,
      id,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Update community distribution failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Update community distribution failed" }, { status: e?.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/community-distributions/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "COMMUNITY_DISTRIBUTIONS_DELETE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

    const currentRows = await prisma.$queryRawUnsafe<Array<{ transaction_id: number | null }>>(
      "SELECT transaction_id FROM community_distributions WHERE id = ? LIMIT 1",
      id,
    );
    const current = currentRows[0];
    if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (current.transaction_id) {
        await undoCommunityDistributionAccounting(tx, {
          communityDistributionId: id,
          reversedBy: session.userId,
          transactionId: current.transaction_id,
        });
        await tx.$executeRawUnsafe("DELETE FROM receipts WHERE transaction_id = ?", current.transaction_id);
        await tx.$executeRawUnsafe("DELETE FROM transactions WHERE id = ?", current.transaction_id);
      }
      await tx.$executeRawUnsafe("DELETE FROM community_distributions WHERE id = ?", id);
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "COMMUNITY_DISTRIBUTION_DELETED",
      module: "community_distributions",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Delete community distribution failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Delete community distribution failed" }, { status: e?.status ?? 500 });
  }
}
