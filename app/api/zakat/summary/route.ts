import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
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

    const paidRows = await prisma.$queryRawUnsafe<Array<{ paid: number | string }>>(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM zakat_payments
       WHERE user_id = ?
         AND account_id = ?
         AND status = 'APPROVED'
         AND approved_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')
         AND approved_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-01-01'), INTERVAL 1 YEAR)`,
      session.userId,
      parsed.data.accountId,
    );
    paidThisCycle = new Prisma.Decimal(paidRows[0]?.paid ?? 0);
  } else if (typeof parsed.data.amount === "number") {
    wealthBase = new Prisma.Decimal(parsed.data.amount);
    paidThisCycle = new Prisma.Decimal(0);
  }

  const belowNisab = wealthBase && nisabValue.gt(0) ? wealthBase.lt(nisabValue) : null;
  const calculatedZakat =
    wealthBase && nisabValue.gt(0) && wealthBase.gte(nisabValue)
      ? wealthBase.mul(rate).toDecimalPlaces(2)
      : wealthBase
        ? new Prisma.Decimal(0)
        : null;
  const remainingDue =
    calculatedZakat && paidThisCycle ? Prisma.Decimal.max(calculatedZakat.minus(paidThisCycle), new Prisma.Decimal(0)) : null;
  const zakatDue =
    belowNisab === null || remainingDue === null
      ? null
      : !belowNisab && remainingDue.gt(0);

  return NextResponse.json({
    ok: true,
    data: {
      accountBalance: wealthBase?.toString() ?? null,
      nisabValue: nisabValue.toString(),
      goldPricePerGram: goldPricePerGram.toString(),
      rate: rate.toString(),
      calculatedZakat: calculatedZakat?.toString() ?? null,
      paidThisCycle: paidThisCycle?.toString() ?? null,
      remainingDue: remainingDue?.toString() ?? null,
      belowNisab,
      zakatDue,
    },
  });
}

