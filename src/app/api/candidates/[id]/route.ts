import { NextResponse } from "next/server";
import { candidateStartTime, type CandidateRow } from "@/lib/candidates";
import { getDb } from "@/lib/db";
import { ensureDiscoveredVenue, ingestEvent } from "@/lib/ingest";

const EDITABLE: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  venueName: "venue_name",
  city: "city",
  startDate: "start_date",
  endDate: "end_date",
  startTime: "start_time",
  timeNote: "time_note",
  price: "price",
  category: "category",
};

type PatchBody = Partial<Record<keyof typeof EDITABLE, string | null>> & {
  status?: "confirmed" | "discarded";
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const db = getDb();
  const candidate = db
    .prepare("SELECT * FROM extraction_candidates WHERE id = ?")
    .get(id) as CandidateRow | undefined;
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Corrections are applied first so confirming uses the edited values.
  for (const [key, column] of Object.entries(EDITABLE)) {
    const value = body[key as keyof typeof EDITABLE];
    if (value !== undefined) {
      db.prepare(`UPDATE extraction_candidates SET ${column} = ? WHERE id = ?`).run(
        value,
        id
      );
    }
  }

  if (body.status === "discarded") {
    db.prepare("UPDATE extraction_candidates SET status = 'discarded' WHERE id = ?").run(id);
    return NextResponse.json({ status: "discarded" });
  }

  if (body.status !== "confirmed") {
    const updated = db
      .prepare("SELECT * FROM extraction_candidates WHERE id = ?")
      .get(id);
    return NextResponse.json(updated);
  }

  if (candidate.status === "confirmed") {
    return NextResponse.json(
      { error: "Already confirmed", eventId: candidate.event_id },
      { status: 409 }
    );
  }

  const edited = db
    .prepare("SELECT * FROM extraction_candidates WHERE id = ?")
    .get(id) as CandidateRow;

  const venue = edited.venue_name
    ? await ensureDiscoveredVenue(edited.venue_name)
    : null;

  const result = await ingestEvent({
    title: edited.title,
    url: null,
    source: "photo",
    startTime: candidateStartTime(edited),
    imageUrl: null,
    // Only used when the venue itself couldn't be geocoded by name.
    address: edited.city && edited.venue_name ? `${edited.venue_name}, ${edited.city}` : null,
    lat: null,
    lng: null,
    venueId: venue?.id ?? null,
    venueName: edited.venue_name,
  });

  if (result.status === "duplicate") {
    db.prepare("UPDATE extraction_candidates SET status = 'confirmed' WHERE id = ?").run(id);
    return NextResponse.json({ status: "duplicate" });
  }

  db.prepare(
    "UPDATE extraction_candidates SET status = 'confirmed', event_id = ? WHERE id = ?"
  ).run(result.id, id);

  return NextResponse.json({ status: "confirmed", eventId: result.id });
}
