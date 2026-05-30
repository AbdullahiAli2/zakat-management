import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { zakatCalculationSchema } from "@/lib/validation";
import { createZakatCalculation } from "@/lib/zakat-calculations";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const path = "/api/zakat/calculations";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_CALCULATE");

    const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
    const items = await prisma.zakatCalculation.findMany({
      where: { userId: session.userId, zakatYear: year },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ok: true,
      data: items.map((c) => ({
        id: c.id,
        totalAssets: Number(c.totalAssets),
        liabilities: Number(c.liabilities),
        netAssets: Number(c.netAssets),
        nisabValue: Number(c.nisabValue),
        zakatDue: Number(c.zakatDue),
        zakatYear: c.zakatYear,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch calculations failed", path });
    return NextResponse.json({ ok: false, error: "Fetch calculations failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const path = "/api/zakat/calculations";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_CALCULATE");

    const validated = parseRequestBody(zakatCalculationSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const calculation = await createZakatCalculation({
      userId: session.userId,
      totalAssets: parsed.totalAssets,
      liabilities: parsed.liabilities,
      zakatYear: parsed.zakatYear,
    });

    await logAudit({
      userId: session.userId,
      path,
      action: "ZAKAT_CALCULATION_CREATED",
      module: "zakat_calculations",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: calculation.id,
        totalAssets: Number(calculation.totalAssets),
        liabilities: Number(calculation.liabilities),
        netAssets: Number(calculation.netAssets),
        nisabValue: Number(calculation.nisabValue),
        zakatDue: Number(calculation.zakatDue),
        zakatYear: calculation.zakatYear,
        createdAt: calculation.createdAt,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Create calculation failed", path });
    return NextResponse.json({ ok: false, error: e?.message ?? "Create calculation failed" }, { status: e?.status ?? 500 });
  }
}
