import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { favorited?: boolean }
    | null;

  if (body?.favorited === undefined) {
    return NextResponse.json({ error: "favorited is required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE venues SET favorited = ? WHERE id = ?").run(
    body.favorited ? 1 : 0,
    id
  );

  const venue = db.prepare("SELECT * FROM venues WHERE id = ?").get(id);
  return NextResponse.json(venue);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM venues WHERE id = ?").run(id);
  return NextResponse.json({ status: "deleted" });
}
