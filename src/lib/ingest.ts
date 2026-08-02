import { getDb } from "./db";
import { buildDedupeKey } from "./dedupe";
import { geocode } from "./geocode";
import { computeInRange } from "./location";
import { fetchHtml, scrapeSingleEvent } from "./scrape";
import { matchSeries } from "./series";

export type IngestInput = {
  title: string;
  url: string | null;
  source: string; // 'quick-add' | 'venue-scrape' | 'eventbrite' | 'meetup'
  startTime: string | null;
  imageUrl: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  venueId: number | null;
  venueName: string | null;
};

export type IngestResult =
  | { status: "inserted"; id: number }
  | { status: "duplicate" };

export async function ingestEvent(input: IngestInput): Promise<IngestResult> {
  const db = getDb();

  let lat = input.lat;
  let lng = input.lng;

  // Prefer a linked venue's known coordinates over per-event geocoding.
  if ((lat === null || lng === null) && input.venueId !== null) {
    const venue = db
      .prepare("SELECT lat, lng FROM venues WHERE id = ?")
      .get(input.venueId) as { lat: number | null; lng: number | null } | undefined;
    if (venue?.lat != null && venue?.lng != null) {
      lat = venue.lat;
      lng = venue.lng;
    }
  }

  if ((lat === null || lng === null) && input.address) {
    const geocoded = await geocode(input.address);
    if (geocoded) {
      lat = geocoded.lat;
      lng = geocoded.lng;
    }
  }

  const series = matchSeries(input.title);
  const favoritedSeries = series?.favorited ? series : null;
  const inRange = favoritedSeries ? true : computeInRange(lat, lng);

  const dedupeKey = buildDedupeKey(
    input.title,
    input.venueName,
    input.startTime
  );

  const existing = db
    .prepare("SELECT id FROM events WHERE dedupe_key = ?")
    .get(dedupeKey) as { id: number } | undefined;

  if (existing) {
    return { status: "duplicate" };
  }

  const result = db
    .prepare(
      `INSERT INTO events
        (title, url, source, venue_id, venue_name, series_id, start_time, image_url, lat, lng, in_range, status, dedupe_key)
       VALUES (@title, @url, @source, @venueId, @venueName, @seriesId, @startTime, @imageUrl, @lat, @lng, @inRange, 'interested', @dedupeKey)`
    )
    .run({
      title: input.title,
      url: input.url,
      source: input.source,
      venueId: input.venueId,
      venueName: input.venueName,
      seriesId: series?.id ?? null,
      startTime: input.startTime,
      imageUrl: input.imageUrl,
      lat,
      lng,
      inRange: inRange ? 1 : 0,
      dedupeKey,
    });

  return { status: "inserted", id: Number(result.lastInsertRowid) };
}

export type QuickAddResult =
  | { status: "inserted"; id: number; title: string }
  | { status: "duplicate" }
  | { status: "fetch_failed" };

/** Shared by the manual "paste a link" form and the Android share-target flow. */
export async function quickAddFromUrl(url: string): Promise<QuickAddResult> {
  const html = await fetchHtml(url);
  if (!html) return { status: "fetch_failed" };

  const scraped = scrapeSingleEvent(html, url);

  const result = await ingestEvent({
    title: scraped.title,
    url: scraped.url ?? url,
    source: "quick-add",
    startTime: scraped.startTime,
    imageUrl: scraped.imageUrl,
    address: scraped.address,
    lat: scraped.lat,
    lng: scraped.lng,
    venueId: null,
    venueName: null,
  });

  if (result.status === "duplicate") return { status: "duplicate" };
  return { status: "inserted", id: result.id, title: scraped.title };
}

/**
 * Venues learned from a scrape (a promoter listing a show it hosts elsewhere).
 * Known by name only — no URL to scrape — so they are geocoded once by name
 * and then behave like any other venue in the list.
 */
export async function ensureDiscoveredVenue(
  name: string
): Promise<{ id: number; name: string }> {
  const db = getDb();

  const existing = db
    .prepare("SELECT id, name FROM venues WHERE name = ? COLLATE NOCASE")
    .get(name) as { id: number; name: string } | undefined;
  if (existing) return existing;

  const geocoded = await geocode(name);

  const result = db
    .prepare(
      `INSERT INTO venues (name, url, lat, lng, source)
       VALUES (?, NULL, ?, ?, 'discovered')`
    )
    .run(name, geocoded?.lat ?? null, geocoded?.lng ?? null);

  return { id: Number(result.lastInsertRowid), name };
}

export type VenueRefreshResult =
  | { status: "ok"; found: number; inserted: number }
  | { status: "fetch_failed" }
  | { status: "not_found" };

export async function refreshVenue(venueId: number): Promise<VenueRefreshResult> {
  const db = getDb();
  const venue = db.prepare("SELECT * FROM venues WHERE id = ?").get(venueId) as
    | { id: number; name: string; url: string; lat: number | null; lng: number | null }
    | undefined;

  if (!venue) return { status: "not_found" };

  const html = await fetchHtml(venue.url);
  if (!html) return { status: "fetch_failed" };

  const { extractJsonLdEvents } = await import("./scrape");
  const { findSiteScraper } = await import("./site-scrapers");

  const siteScraper = findSiteScraper(venue.url);
  const scrapedEvents = siteScraper ? siteScraper(html) : extractJsonLdEvents(html);

  // Backfill venue coordinates from the first event with a known location.
  if (venue.lat === null || venue.lng === null) {
    const withGeo = scrapedEvents.find((e) => e.lat !== null && e.lng !== null);
    if (withGeo) {
      db.prepare("UPDATE venues SET lat = ?, lng = ? WHERE id = ?").run(
        withGeo.lat,
        withGeo.lng,
        venue.id
      );
    } else {
      const withAddress = scrapedEvents.find((e) => e.address);
      if (withAddress?.address) {
        const geocoded = await geocode(withAddress.address);
        if (geocoded) {
          db.prepare("UPDATE venues SET lat = ?, lng = ?, address = ? WHERE id = ?").run(
            geocoded.lat,
            geocoded.lng,
            withAddress.address,
            venue.id
          );
        }
      } else {
        // Last resort: geocode by venue name alone.
        const geocoded = await geocode(venue.name);
        if (geocoded) {
          db.prepare("UPDATE venues SET lat = ?, lng = ? WHERE id = ?").run(
            geocoded.lat,
            geocoded.lng,
            venue.id
          );
        }
      }
    }
  }

  let insertedCount = 0;
  for (const scraped of scrapedEvents) {
    // A promoted show happens elsewhere: link it to its own venue row so it
    // gets that venue's coordinates instead of inheriting this one's, which
    // would pass the radius filter for the wrong city.
    const eventVenue = scraped.externalVenue
      ? await ensureDiscoveredVenue(scraped.externalVenue)
      : { id: venue.id, name: venue.name };

    const result = await ingestEvent({
      title: scraped.title,
      url: scraped.url,
      source: "venue-scrape",
      startTime: scraped.startTime,
      imageUrl: scraped.imageUrl,
      address: scraped.address,
      lat: scraped.lat,
      lng: scraped.lng,
      venueId: eventVenue.id,
      venueName: eventVenue.name,
    });
    if (result.status === "inserted") insertedCount += 1;
  }

  db.prepare("UPDATE venues SET last_scraped_at = datetime('now') WHERE id = ?").run(
    venue.id
  );

  return { status: "ok", found: scrapedEvents.length, inserted: insertedCount };
}
