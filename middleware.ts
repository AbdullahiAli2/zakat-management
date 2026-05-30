import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

type SessionRole = "SUPERUSER" | "ADMIN" | "DONOR";

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/donor") || pathname.startsWith("/profile");
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

function redirectToRoleHome(req: NextRequest, role: SessionRole) {
  const url = req.nextUrl.clone();
  url.pathname = role === "DONOR" ? "/donor" : "/admin";
  return NextResponse.redirect(url);
}

function readToken(req: NextRequest) {
  const cookieToken = req.cookies.get("zakat_auth")?.value;
  if (cookieToken) return cookieToken;

  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function readRole(payload: Record<string, unknown>): SessionRole {
  if (payload.role === "SUPERUSER" || payload.role === "ADMIN" || payload.role === "DONOR") {
    return payload.role;
  }
  if (payload.is_superuser) return "SUPERUSER";
  if (payload.is_admin) return "ADMIN";
  return "DONOR";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  try {
    const token = readToken(req);
    if (!token) return redirectToLogin(req);

    const secret = process.env.JWT_SECRET;
    if (!secret) return redirectToLogin(req);

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = readRole(payload as Record<string, unknown>);

    if (pathname.startsWith("/admin") && role === "DONOR") {
      return redirectToRoleHome(req, role);
    }

    if (pathname.startsWith("/donor") && (role === "ADMIN" || role === "SUPERUSER")) {
      return redirectToRoleHome(req, role);
    }
  } catch {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/donor/:path*", "/profile"],
};
