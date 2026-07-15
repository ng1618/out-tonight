import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionToken(): string {
  return sign("authenticated");
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = createSessionToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
