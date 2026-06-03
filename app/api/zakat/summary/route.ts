import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { committedThisCycle, getCyclePaymentTotals } from "@/lib/zakat-cycle";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const querySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().positive().optional(),
});

export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

  const rate = new Prisma.Decimal(0.025);

  const nisabRow = await prisma.nisabSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  const nisabValue = nisabRow ? nisabRow.nisabValue : new Prisma.Decimal(process.env.NISAB_VALUE ?? "0");
  const goldPricePerGram = nisabRow ? nisabRow.goldPricePerGram : new Prisma.Decimal(process.env.GOLD_PRICE_PER_GRAM ?? "0");

  let wealthBase: Prisma.Decimal | null = null;
  let paidThisCycle: Prisma.Decimal | null = null;
  let pendingThisCycle: Prisma.Decimal | null = null;
  let hasPendingPayment = false;

  if (parsed.data.accountId) {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const accountRows = await prisma.$queryRawUnsafe<Array<{ balance: number | string }>>(
      "SELECT balance FROM accounts WHERE id = ? AND user_id = ? AND status = 'ACTIVE' LIMIT 1",
      parsed.data.accountId,
      session.userId,
    );
    const account = accountRows[0];
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    }
    wealthBase = new Prisma.Decimal(account.balance);

    const cycleTotals = await getCyclePaymentTotals(prisma, session.userId, parsed.data.accountId);
    paidThisCycle = cycleTotals.approvedPaid;
    pendingThisCycle = cycleTotals.pendingPaid;
    hasPendingPayment = cycleTotals.pendingPayment !== null;
  } else if (typeof parsed.data.amount === "number") {
    wealthBase = new Prisma.Decimal(parsed.data.amount);
    paidThisCycle = new Prisma.Decimal(0);
    pendingThisCycle = new Prisma.Decimal(0);
  }

  const belowNisab = wealthBase && nisabValue.gt(0) ? wealthBase.lt(nisabValue) : null;
  const calculatedZakat =
    wealthBase && nisabValue.gt(0) && wealthBase.gte(nisabValue)
      ? wealthBase.mul(rate).toDecimalPlaces(2)
      : wealthBase
        ? new Prisma.Decimal(0)
        : null;
  const committed =
    calculatedZakat && paidThisCycle !== null && pendingThisCycle !== null
      ? committedThisCycle({ approvedPaid: paidThisCycle, pendingPaid: pendingThisCycle, pendingPayment: null })
      : null;
  const remainingDue =
    calculatedZakat && committed !== null
      ? Prisma.Decimal.max(calculatedZakat.minus(committed), new Prisma.Decimal(0))
      : null;
  const zakatDue =
    belowNisab === null || remainingDue === null
      ? null
      : !belowNisab && remainingDue.gt(0) && !hasPendingPayment;

  return NextResponse.json({
    ok: true,
    data: {
      accountBalance: wealthBase?.toString() ?? null,
      nisabValue: nisabValue.toString(),
      goldPricePerGram: goldPricePerGram.toString(),
      rate: rate.toString(),
      calculatedZakat: calculatedZakat?.toString() ?? null,
      paidThisCycle: paidThisCycle?.toString() ?? null,
      pendingThisCycle: pendingThisCycle?.toString() ?? null,
      hasPendingPayment,
      remainingDue: remainingDue?.toString() ?? null,
      belowNisab,
      zakatDue,
    },
  });
}

