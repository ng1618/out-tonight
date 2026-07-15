import { NextRequest, NextResponse } from "next/server";
import { quickAddFromUrl } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const result = await quickAddFromUrl(url);

  if (result.status === "fetch_failed") {
    return NextResponse.json({ error: "Could not fetch that link" }, { status: 422 });
  }
  if (result.status === "duplicate") {
    return NextResponse.json({ status: "duplicate" });
  }
  return NextResponse.json({ status: "inserted", id: result.id, title: result.title });
}
