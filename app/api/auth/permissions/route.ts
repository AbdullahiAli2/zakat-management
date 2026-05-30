import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readJwtFromRequest, verifySessionJwt } from "@/lib/auth";
import { isDonorRole, isSuperuserRole } from "@/lib/roles";

const donorDefaults = [
  "AUTH_LOGIN",
  "AUTH_REGISTER",
  "WALLET_MANAGE",
  "PROFILE_VIEW",
  "PROFILE_EDIT",
  "ZAKAT_PAY",
  "ZAKAT_CALCULATE",
  "DASHBOARD_VIEW",
  "TRANSACTIONS_VIEW",
];

export async function GET(req: NextRequest) {
  try {
    const token = readJwtFromRequest(req);
    if (!token) return NextResponse.json({ ok: true, data: { all: false, permissions: [] } });
    const session = verifySessionJwt(token);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, isActive: true, role: true },
    });
    if (!user || !user.isActive) return NextResponse.json({ ok: true, data: { all: false, permissions: [] } });
    if (isSuperuserRole(user.role)) return NextResponse.json({ ok: true, data: { all: true, permissions: [] } });

    const rows = await prisma.$queryRawUnsafe<Array<{ codename: string }>>(
      `SELECT DISTINCT p.codename
       FROM permissions p
       LEFT JOIN user_permission up ON up.permission_id = p.id AND up.user_id = ?
       LEFT JOIN group_permission gp ON gp.permission_id = p.id
       LEFT JOIN user_group ug ON ug.group_id = gp.group_id AND ug.user_id = ?
       WHERE up.id IS NOT NULL OR ug.id IS NOT NULL`,
      session.userId,
      session.userId,
    );

    const permissions = new Set(rows.map((r) => r.codename));
    if (isDonorRole(user.role)) {
      donorDefaults.forEach((p) => permissions.add(p));
    }

    return NextResponse.json({ ok: true, data: { all: false, permissions: Array.from(permissions) } });
  } catch {
    return NextResponse.json({ ok: true, data: { all: false, permissions: [] } });
  }
}
