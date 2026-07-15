import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const VALID_STATUSES = ["interested", "going", "dismissed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { status?: string }
    | null;

  if (!body?.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE events SET status = ? WHERE id = ?").run(body.status, id);
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return NextResponse.json(event);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  return NextResponse.json({ status: "deleted" });
}
