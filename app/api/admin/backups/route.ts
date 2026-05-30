import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit, logError } from "@/lib/logging";
import { backupCreateSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

function ip(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const routePath = "/api/admin/backups";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "BACKUPS_VIEW");

    const items = await prisma.backup.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { creator: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: items.map((b) => ({
        id: b.id,
        backupName: b.backupName,
        filePath: b.filePath,
        createdAt: b.createdAt,
        createdBy: b.creator ? `${b.creator.firstName} ${b.creator.lastName}` : null,
      })),
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Fetch backups failed", path: routePath });
    return NextResponse.json({ ok: false, error: "Fetch backups failed" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const routePath = "/api/admin/backups";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);
    await requirePermission(session, "BACKUPS_CREATE");

    const validated = parseRequestBody(backupCreateSchema, await req.json());
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${parsed.backupName.replace(/\s+/g, "_")}_${timestamp}.json`;
    const dir = path.join(process.cwd(), "storage", "backups");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      tables: {
        users: await prisma.user.count(),
        accounts: await prisma.account.count(),
        zakatPayments: await prisma.zakatPayment.count(),
        transactions: await prisma.transaction.count(),
        beneficiaries: await prisma.beneficiary.count(),
        distributions: await prisma.distribution.count(),
      },
    };
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");

    const backup = await prisma.backup.create({
      data: {
        backupName: parsed.backupName,
        filePath: filePath.replace(process.cwd(), ""),
        createdBy: session.userId,
      },
    });

    await logAudit({
      userId: session.userId,
      path: routePath,
      action: "BACKUP_CREATED",
      module: "backups",
      ip: ip(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, data: { id: backup.id, filePath: backup.filePath } });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; status?: number };
    await logError({ userId: null, message: e?.message ?? "Create backup failed", path: routePath });
    return NextResponse.json({ ok: false, error: "Create backup failed" }, { status: e?.status ?? 500 });
  }
}
