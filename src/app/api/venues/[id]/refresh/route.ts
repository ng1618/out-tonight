import { NextResponse } from "next/server";
import { refreshVenue } from "@/lib/ingest";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await refreshVenue(Number(id));

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
  if (result.status === "fetch_failed") {
    return NextResponse.json({ error: "Could not fetch venue page" }, { status: 422 });
  }
  return NextResponse.json(result);
}
