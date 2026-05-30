import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { UserRole } from "./roles";

const COOKIE_NAME = "zakat_auth";

type JwtPayload = {
  sub: string;
  role: UserRole;
};

export type SessionUser = {
  userId: number;
  role: UserRole;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET env var");
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signSessionJwt(session: SessionUser) {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      sub: String(session.userId),
      role: session.role,
    } satisfies JwtPayload,
    secret,
    { expiresIn: "7d" },
  );
}

export function verifySessionJwt(token: string): SessionUser {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret) as JwtPayload & {
    isSuperuser?: boolean;
    isAdmin?: boolean;
    isDonor?: boolean;
  };

  if (decoded.role) {
    return { userId: Number(decoded.sub), role: decoded.role };
  }

  // Legacy JWT fallback (pre role-enum migration)
  if (decoded.isSuperuser) return { userId: Number(decoded.sub), role: "SUPERUSER" };
  if (decoded.isAdmin) return { userId: Number(decoded.sub), role: "ADMIN" };
  return { userId: Number(decoded.sub), role: "DONOR" };
}

export function readJwtFromRequest(req: NextRequest) {
  const tokenFromCookie = req.cookies.get(COOKIE_NAME)?.value;
  if (tokenFromCookie) return tokenFromCookie;

  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function readJwtFromHeaders() {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}
