import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeInRange } from "@/lib/location";

function recomputeAllInRange(db: ReturnType<typeof getDb>) {
  const events = db
    .prepare("SELECT id, lat, lng, series_id FROM events")
    .all() as { id: number; lat: number | null; lng: number | null; series_id: number | null }[];

  const update = db.prepare("UPDATE events SET in_range = ? WHERE id = ?");
  for (const event of events) {
    if (event.series_id !== null) continue; // favorited-series bypass stays untouched
    update.run(computeInRange(event.lat, event.lng) ? 1 : 0, event.id);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { radiusKm?: number }
    | null;

  if (body?.radiusKm === undefined) {
    return NextResponse.json({ error: "radiusKm is required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE home_locations SET radius_km = ? WHERE id = ?").run(
    body.radiusKm,
    id
  );
  recomputeAllInRange(db);

  const home = db.prepare("SELECT * FROM home_locations WHERE id = ?").get(id);
  return NextResponse.json(home);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM home_locations WHERE id = ?").run(id);
  recomputeAllInRange(db);
  return NextResponse.json({ status: "deleted" });
}
