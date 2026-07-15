import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/cron/") // authenticated separately via CRON_SECRET
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
  ],
};
