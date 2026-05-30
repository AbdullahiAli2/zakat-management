import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logError } from "@/lib/logging";
import { BENEFICIARY_CATEGORIES, type BeneficiaryCategory } from "@/lib/distributions";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

const ACTIVE_DISTRIBUTION_STATUSES = "('COMPLETED', 'APPROVED')";

export async function GET(req: NextRequest) {
  const path = "/api/admin/distributions/summary";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "DISTRIBUTIONS_VIEW");

    const [beneficiaryRows, communityRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ category: BeneficiaryCategory; total: number | string }>>(
        `SELECT b.category AS category, COALESCE(SUM(d.amount), 0) AS total
         FROM distributions d
         INNER JOIN beneficiaries b ON b.id = d.beneficiary_id
         WHERE d.status IN ${ACTIVE_DISTRIBUTION_STATUSES}
         GROUP BY b.category`,
      ),
      prisma.$queryRawUnsafe<Array<{ total: number | string }>>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM community_distributions
         WHERE status IN ${ACTIVE_DISTRIBUTION_STATUSES}`,
      ),
    ]);

    const byCategory = Object.fromEntries(BENEFICIARY_CATEGORIES.map((c) => [c, 0])) as Record<BeneficiaryCategory, number>;
    for (const row of beneficiaryRows) byCategory[row.category] = Number(row.total ?? 0);

    const communityTotal = Number(communityRows[0]?.total ?? 0);
    const individualTotal = BENEFICIARY_CATEGORIES.reduce((sum, c) => sum + byCategory[c], 0);
    const total = individualTotal + communityTotal;

    const percentage = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

    const items = [
      ...BENEFICIARY_CATEGORIES.map((category) => ({
        category,
        amount: byCategory[category],
        percent: percentage(byCategory[category]),
      })),
      {
        category: "COMMUNITY" as const,
        amount: communityTotal,
        percent: percentage(communityTotal),
      },
    ];

    return NextResponse.json({
      ok: true,
      data: {
        total,
        individualTotal,
        communityTotal,
        items,
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
      message: e?.message ?? "Fetch distribution summary failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Fetch distribution summary failed" }, { status: e?.status ?? 500 });
  }
}
