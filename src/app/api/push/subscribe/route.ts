import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(body.endpoint, body.keys.p256dh, body.keys.auth);

  return NextResponse.json({ status: "subscribed" });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(body.endpoint);
  return NextResponse.json({ status: "unsubscribed" });
}
