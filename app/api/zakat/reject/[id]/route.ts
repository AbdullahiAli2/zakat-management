import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const path = `/api/zakat/reject/${resolved.id}`;
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_APPROVE");

    const paymentId = Number(resolved.id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) return NextResponse.json({ ok: false, error: "Invalid payment id" }, { status: 400 });

    const rows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      "SELECT status FROM zakat_payments WHERE id = ? LIMIT 1",
      paymentId,
    );
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
    if (rows[0].status !== "PENDING") return NextResponse.json({ ok: false, error: "Only pending payment can be rejected" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const paymentUpdateResult = await tx.$executeRawUnsafe(
        "UPDATE zakat_payments SET status = 'REJECTED', approved_by = ?, approved_at = NOW() WHERE id = ? AND status = 'PENDING'",
        session.userId,
        paymentId,
      );

      if (typeof paymentUpdateResult === "number" && paymentUpdateResult < 1) {
        throw Object.assign(new Error("Payment is not pending"), { status: 400 });
      }

      // If a pending transaction exists (created at pay time), mark it as failed.
      await tx.$executeRawUnsafe(
        "UPDATE transactions SET status = 'FAILED' WHERE zakat_payment_id = ? AND type = 'ZAKAT_PAYMENT' AND status = 'PENDING'",
        paymentId,
      );
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "ZAKAT_REJECTED",
      module: "zakat",
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
    await logError({ userId: null, message: e?.message ?? "Reject zakat failed", stack: e?.stack, path, lineNumber: e?.lineNumber ?? null });
    return NextResponse.json({ ok: false, error: e?.message ?? "Reject zakat failed" }, { status: e?.status ?? 500 });
  }
}

