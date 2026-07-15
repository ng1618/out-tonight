import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ status: "ok" });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
