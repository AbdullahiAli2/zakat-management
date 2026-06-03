import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { buildReportPayload } from "@/lib/reports";
import { reportGenerateSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/reports";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "REPORTS_VIEW");

    const items = await prisma.report.findMany({
      orderBy: { generatedAt: "desc" },
      take: 50,
      include: { generator: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: items.map((r) => ({
        id: r.id,
        reportType: r.reportType,
        generatedAt: r.generatedAt,
        generatedBy: r.generator ? `${r.generator.firstName} ${r.generator.lastName}` : null,
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch reports failed", path });
    return NextResponse.json({ ok: false, error: "Fetch reports failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/admin/reports";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "REPORTS_GENERATE");

    const validated = parseRequestBody(reportGenerateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const payload = await buildReportPayload(parsed.reportType);

    const report = await prisma.report.create({
      data: {
        reportType: parsed.reportType,
        generatedBy: session.userId,
      },
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "REPORT_GENERATED",
      module: "reports",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: report.id,
        reportType: report.reportType,
        generatedAt: report.generatedAt,
        payload,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Generate report failed", path });
    return NextResponse.json({ ok: false, error: "Generate report failed" }, { status: e?.status ?? 500 });
  }
}
