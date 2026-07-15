import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeInRange } from "@/lib/location";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { favorited?: boolean; name?: string; matchPattern?: string }
    | null;

  const db = getDb();

  if (body?.favorited !== undefined) {
    db.prepare("UPDATE series SET favorited = ? WHERE id = ?").run(
      body.favorited ? 1 : 0,
      id
    );

    if (!body.favorited) {
      // Un-favoriting removes the location-filter bypass; recompute in_range
      // for events tied to this series against their real coordinates.
      const events = db
        .prepare("SELECT id, lat, lng FROM events WHERE series_id = ?")
        .all(id) as { id: number; lat: number | null; lng: number | null }[];

      const update = db.prepare("UPDATE events SET in_range = ? WHERE id = ?");
      for (const event of events) {
        update.run(computeInRange(event.lat, event.lng) ? 1 : 0, event.id);
      }
    } else {
      db.prepare("UPDATE events SET in_range = 1 WHERE series_id = ?").run(id);
    }
  }

  if (body?.name) {
    db.prepare("UPDATE series SET name = ? WHERE id = ?").run(body.name, id);
  }
  if (body?.matchPattern) {
    db.prepare("UPDATE series SET match_pattern = ? WHERE id = ?").run(
      body.matchPattern.toLowerCase(),
      id
    );
  }

  const series = db.prepare("SELECT * FROM series WHERE id = ?").get(id);
  return NextResponse.json(series);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM series WHERE id = ?").run(id);
  return NextResponse.json({ status: "deleted" });
}
