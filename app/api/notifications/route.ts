import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));

    const [unreadCount, items, total] = await Promise.all([
      prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
        select: { id: true, title: true, message: true, isRead: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: session.userId } }),
    ]);

    return NextResponse.json({
      ok: true,
      data: { unreadCount, page: parsed.page, pageSize: parsed.pageSize, total, items },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load notifications" }, { status: 500 });
  }
}
