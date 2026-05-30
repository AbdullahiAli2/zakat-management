import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { approveDistribution, DISTRIBUTION_STATUSES, DISTRIBUTION_TYPES, finalizeDistributionTransaction, undoDistributionAccounting } from "@/lib/distributions";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const updateSchema = z
  .object({
    beneficiaryId: z.number().int().positive().optional(),
    distributionType: z.enum(DISTRIBUTION_TYPES).optional(),
    amount: z.coerce.number().positive().optional(),
    status: z.enum(DISTRIBUTION_STATUSES).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/distributions/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_EDIT");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid distribution id" }, { status: 400 });
    const validated = parseRequestBody(updateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    const currentRows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        amount: number | string;
        status: string;
        transaction_id: number | null;
        beneficiary_id: number;
        distribution_type: string;
        first_name: string | null;
        last_name: string | null;
      }>
    >(
      `SELECT d.id, d.amount, d.status, d.transaction_id, d.beneficiary_id, d.distribution_type,
              b.first_name, b.last_name
       FROM distributions d
       INNER JOIN beneficiaries b ON b.id = d.beneficiary_id
       WHERE d.id = ? LIMIT 1`,
      id,
    );
    const current = currentRows[0];
    if (!current) return NextResponse.json({ ok: false, error: "Distribution not found" }, { status: 404 });

    const nextStatus = parsed.status ?? current.status;
    const nextAmount = parsed.amount ?? Number(current.amount);

    if (nextStatus === "APPROVED" && current.status === "PENDING") {
      await prisma.$transaction(async (tx) => {
        await approveDistribution(tx, { distributionId: id, approverUserId: session.userId });
      });
    } else if (nextStatus === "COMPLETED" && current.status !== "COMPLETED" && !current.transaction_id) {
      const beneficiaryName =
        [current.first_name, current.last_name].filter(Boolean).join(" ").trim() || `Beneficiary #${current.beneficiary_id}`;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE distributions SET
             beneficiary_id = COALESCE(?, beneficiary_id),
             distribution_type = COALESCE(?, distribution_type),
             amount = COALESCE(?, amount),
             notes = COALESCE(?, notes)
           WHERE id = ?`,
          parsed.beneficiaryId ?? null,
          parsed.distributionType ?? null,
          parsed.amount ?? null,
          parsed.notes ?? null,
          id,
        );

        if (current.status === "PENDING") {
          await approveDistribution(tx, { distributionId: id, approverUserId: session.userId });
        }

        await finalizeDistributionTransaction(tx, {
          distributionId: id,
          adminUserId: session.userId,
          amount: nextAmount,
          beneficiaryName,
          distributionType: parsed.distributionType ?? current.distribution_type,
          notifyUserId: session.userId,
        });
      });
    } else {
      if (current.transaction_id && parsed.amount != null && parsed.amount !== Number(current.amount)) {
        return NextResponse.json({ ok: false, error: "Cannot change amount after distribution is completed" }, { status: 400 });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE distributions SET
           beneficiary_id = COALESCE(?, beneficiary_id),
           distribution_type = COALESCE(?, distribution_type),
           amount = COALESCE(?, amount),
           status = COALESCE(?, status),
           notes = COALESCE(?, notes)
         WHERE id = ?`,
        parsed.beneficiaryId ?? null,
        parsed.distributionType ?? null,
        parsed.amount ?? null,
        parsed.status ?? null,
        parsed.notes ?? null,
        id,
      );
    }

    await logAudit({
      userId: session.userId,
      path,
      action: "DISTRIBUTION_UPDATED",
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
    await logError({ userId: null, message: e?.message ?? "Update distribution failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: e?.message ?? "Update distribution failed" }, { status: e?.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/admin/distributions/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_DELETE");

    const id = Number(resolved.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid distribution id" }, { status: 400 });

    const currentRows = await prisma.$queryRawUnsafe<Array<{ amount: number | string; transaction_id: number | null }>>(
      "SELECT amount, transaction_id FROM distributions WHERE id = ? LIMIT 1",
      id,
    );
    const current = currentRows[0];
    if (!current) return NextResponse.json({ ok: false, error: "Distribution not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (current.transaction_id) {
        await undoDistributionAccounting(tx, {
          distributionId: id,
          reversedBy: session.userId,
          transactionId: current.transaction_id,
        });
        await tx.$executeRawUnsafe("DELETE FROM receipts WHERE transaction_id = ?", current.transaction_id);
        await tx.$executeRawUnsafe("DELETE FROM transactions WHERE id = ?", current.transaction_id);
      }
      await tx.$executeRawUnsafe("DELETE FROM distributions WHERE id = ?", id);
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "DISTRIBUTION_DELETED",
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
    await logError({ userId: null, message: e?.message ?? "Delete distribution failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: "Delete distribution failed" }, { status: e?.status ?? 500 });
  }
}
