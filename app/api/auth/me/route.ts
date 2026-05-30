import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar";

export async function GET(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: true, user: null }, { status: 200 });
    const session = verifySessionJwt(token);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        role: true,
      },
    });

    if (!user || !user.isActive) return NextResponse.json({ ok: true, user: null }, { status: 200 });

    const avatarUrl = await getAvatarUrl(user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ ok: true, user: null }, { status: 200 });
  }
}
