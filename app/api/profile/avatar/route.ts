import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { logAudit, logError } from "@/lib/logging";
import { saveAvatarFile } from "@/lib/avatar";
import { isZodError, zodErrorBody } from "@/lib/parse-request";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getRequestIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const pathName = "/api/profile/avatar";
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const formData = await req.formData();
    const avatar = formData.get("avatar");
    if (!(avatar instanceof File)) {
      return NextResponse.json({ ok: false, error: "Please select an image" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(avatar.type)) {
      return NextResponse.json({ ok: false, error: "Only JPG, PNG, or WEBP is allowed" }, { status: 400 });
    }
    if (avatar.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "Image must be 2MB or less" }, { status: 400 });
    }

    const bytes = await avatar.arrayBuffer();
    const relativeUrl = await saveAvatarFile(session.userId, bytes, avatar.type);

    const existing = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true },
    });
    if (!existing || !existing.isActive) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await logAudit({
      userId: session.userId,
      path: pathName,
      action: "PROFILE_AVATAR_UPLOAD",
      module: "profile",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      data: { avatarUrl: relativeUrl },
    });
  } catch (err) {
    if (isZodError(err)) {
      const zod = zodErrorBody(err);
      return NextResponse.json(zod.body, { status: zod.status });
    }
    const e = err as { message?: string; stack?: string; lineNumber?: number; status?: number };
    await logError({
      userId: null,
      message: e?.message ?? "Upload avatar failed",
      stack: e?.stack,
      path: pathName,
      lineNumber: typeof e?.lineNumber === "number" ? e.lineNumber : null,
    });
    return NextResponse.json({ ok: false, error: "Failed to upload image" }, { status: e?.status ?? 500 });
  }
}

