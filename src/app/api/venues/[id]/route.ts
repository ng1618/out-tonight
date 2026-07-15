import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM venues WHERE id = ?").run(id);
  return NextResponse.json({ status: "deleted" });
}
