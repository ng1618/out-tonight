import { NextRequest, NextResponse } from "next/server";
import {
  extractJsonLdEvents,
  fetchHtml,
  scrapeSingleEvent,
  type ScrapedEvent,
} from "@/lib/scrape";
import { findSiteScraper } from "@/lib/site-scrapers";

export const maxDuration = 60;

export type FetchParseResponse = {
  status: "ok";
  /** "single" for a shared link, "listing" when the page is a programme. */
  kind: "single" | "listing";
  events: ScrapedEvent[];
};

/**
 * Stateless fetch-and-parse. The browser can't request arbitrary sites (CORS),
 * so this does it and returns structured events — but stores nothing. The phone
 * decides what to keep.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { url?: string; mode?: "single" | "listing" }
    | null;

  const url = body?.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Not a valid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs" }, { status: 400 });
  }

  const html = await fetchHtml(url);
  if (!html) {
    return NextResponse.json({ error: "Could not fetch that page" }, { status: 422 });
  }

  if (body?.mode === "listing") {
    const siteScraper = findSiteScraper(url);
    const events = siteScraper ? siteScraper(html) : extractJsonLdEvents(html);
    return NextResponse.json({ status: "ok", kind: "listing", events });
  }

  return NextResponse.json({
    status: "ok",
    kind: "single",
    events: [scrapeSingleEvent(html, url)],
  });
}
