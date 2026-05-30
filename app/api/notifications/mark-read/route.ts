import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { markNotificationsAsRead } from "@/lib/notifications";
import { notificationsMarkReadSchema } from "@/lib/validation";
import { validationErrorBody } from "@/lib/validation-messages";
import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";

export async function POST(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const session = verifySessionJwt(token);

    const body = await req.json();
    const validated = parseRequestBody(notificationsMarkReadSchema, body);
    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });
    const parsed = validated.data;

    await markNotificationsAsRead(session.userId, { all: parsed.all, ids: parsed.ids });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to mark as read" }, { status: 400 });
  }
}

