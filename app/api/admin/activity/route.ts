import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { logError } from "@/lib/logging";
import { Prisma } from "@prisma/client";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const querySchema = z.object({
  days: z.coerce.number().int().min(3).max(30).default(7),
});

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const path = "/api/admin/activity";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    verifySessionJwt(token);

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.parse(raw);

    const days = parsed.days;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));

    // Pull last N transactions and bucket by calendar day.
    const txs = await prisma.transaction.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });

    const buckets = new Map<string, { day: string; count: number; sum: Prisma.Decimal }>();

    for (const tx of txs) {
      const d = tx.createdAt.toISOString().slice(0, 10);
      const existing = buckets.get(d);
      if (existing) {
        existing.count += 1;
        existing.sum = existing.sum.plus(tx.amount);
      } else {
        buckets.set(d, { day: fmtDay(new Date(d)), count: 1, sum: new Prisma.Decimal(tx.amount) });
      }
    }

    // Ensure all days appear (including zeros).
    const out: Array<{ day: string; count: number; totalAmount: string }> = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      const key = dt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      out.push({
        day: fmtDay(dt),
        count: bucket?.count ?? 0,
        totalAmount: (bucket?.sum ?? new Prisma.Decimal(0)).toString(),
      });
    }

    return NextResponse.json({
      ok: true,
      data: { points: out },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; status?: number; lineNumber?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Activity fetch failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    const statusCode = e?.status ?? 500;
    return NextResponse.json({ ok: false, error: "Activity fetch failed" }, { status: statusCode });
  }
}

