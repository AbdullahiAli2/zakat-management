import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { payZakat } from "@/lib/zakat";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const zakatTypeValues = ["MAAL", "BUSINESS"] as const;
const methodValues = ["EVCPLUS", "ZAAD", "E_DAHAB", "CASH", "WALLET"] as const;

const bodySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().positive(),
  zakatType: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine(
      (v): v is (typeof zakatTypeValues)[number] =>
        zakatTypeValues.includes(v as (typeof zakatTypeValues)[number]),
    ),
  method: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine(
      (v): v is (typeof methodValues)[number] =>
        methodValues.includes(v as (typeof methodValues)[number]),
    ),
});

function getRequestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const path = "/api/zakat/pay";

  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const session = verifySessionJwt(token);
    await requirePermission(session, "ZAKAT_PAY");

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });
    }

    let accountId = parsed.data.accountId;
    const amount = parsed.data.amount;
    const zakatType = parsed.data.zakatType;
    const method = parsed.data.method;
    if (!accountId) {
      const ownAccounts = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        "SELECT id FROM accounts WHERE user_id = ? AND status = 'ACTIVE' AND balance > 0 ORDER BY created_at DESC LIMIT 1",
        session.userId,
      );
      if (!ownAccounts[0]?.id) {
        return NextResponse.json(
          { ok: false, error: "You must create account and have balance before paying zakat" },
          { status: 400 },
        );
      }
      accountId = ownAccounts[0].id;
    }

    const result = await payZakat({
      userId: session.userId,
      amount,
      accountId,
      zakatType,
      method,
    });

    const userRows = await prisma.$queryRawUnsafe<Array<{ id: number; first_name: string; last_name: string; email: string }>>(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1",
      session.userId,
    );
    const user = userRows[0] ?? null;

    await logAudit({
      userId: session.userId,
      path,
      action: "PAY_ZAKAT_SUCCESS",
      module: "zakat",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      receipt: {
        paymentId: result.paymentId,
        user: { id: user?.id, firstName: user?.first_name, lastName: user?.last_name, email: user?.email },
        amount: result.amount.toString(),
        date: result.createdAt,
        zakatType,
        nisabValue: result.nisabValue.toString(),
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
      message: e?.message ?? "Zakat payment failed",
      stack: e?.stack,
      path,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });

    const statusCode = e?.status ?? 400;
    return NextResponse.json({ ok: false, error: e?.message ?? "Zakat payment failed" }, { status: statusCode });
  }
}

