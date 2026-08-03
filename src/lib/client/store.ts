"use client";

import { buildDedupeKey } from "../dedupe";
import { isWithinAnyHome } from "../distance";
import { getDb } from "./db";
import type {
  CandidateFields,
  EventRecord,
  HomeLocationRecord,
  SeriesRecord,
  VenueRecord,
} from "./schema";

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- geocoding

/**
 * Browsers can't call Nominatim directly (it requires a User-Agent header that
 * fetch refuses to set), so this goes through the stateless server endpoint.
 * Results are cached on-device, which also makes repeat lookups work offline.
 */
export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const db = await getDb();
  const cached = await db.get("geocodeCache", key);
  if (cached) {
    return cached.lat !== null && cached.lng !== null
      ? { lat: cached.lat, lng: cached.lng }
      : null;
  }

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { lat: number; lng: number } | null;
    await db.put("geocodeCache", {
      query: key,
      lat: body?.lat ?? null,
      lng: body?.lng ?? null,
    });
    return body ?? null;
  } catch {
    // Offline: don't cache a failure, so it retries when back online.
    return null;
  }
}

// ------------------------------------------------------------ home locations

export async function listHomeLocations(): Promise<HomeLocationRecord[]> {
  return (await getDb()).getAll("homeLocations");
}

export async function addHomeLocation(
  label: string,
  place: string,
  radiusKm: number
): Promise<HomeLocationRecord | null> {
  const coords = await geocode(place);
  if (!coords) return null;
  const db = await getDb();
  const id = await db.add("homeLocations", {
    label,
    lat: coords.lat,
    lng: coords.lng,
    radiusKm,
  } as HomeLocationRecord);
  return { id: id as number, label, lat: coords.lat, lng: coords.lng, radiusKm };
}

export async function updateHomeRadius(id: number, radiusKm: number): Promise<void> {
  const db = await getDb();
  const row = await db.get("homeLocations", id);
  if (!row) return;
  await db.put("homeLocations", { ...row, radiusKm });
  await recomputeInRange();
}

export async function deleteHomeLocation(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("homeLocations", id);
  await recomputeInRange();
}

async function computeInRange(lat: number | null, lng: number | null): Promise<boolean> {
  if (lat === null || lng === null) return true; // unknown location: surface it
  const homes = await listHomeLocations();
  if (homes.length === 0) return true;
  return isWithinAnyHome(lat, lng, homes.map((h) => ({ ...h, radius_km: h.radiusKm })));
}

async function recomputeInRange(): Promise<void> {
  const db = await getDb();
  const homes = await listHomeLocations();
  const tx = db.transaction("events", "readwrite");
  for await (const cursor of tx.store) {
    const e = cursor.value;
    // A favourited series opts an event in regardless of distance.
    if (e.seriesId !== null) continue;
    const inRange =
      e.lat === null || e.lng === null || homes.length === 0
        ? true
        : isWithinAnyHome(e.lat, e.lng, homes.map((h) => ({ ...h, radius_km: h.radiusKm })));
    if (inRange !== e.inRange) await cursor.update({ ...e, inRange });
  }
  await tx.done;
}

// -------------------------------------------------------------------- series

export async function listSeries(): Promise<SeriesRecord[]> {
  const rows = await (await getDb()).getAll("series");
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSeries(name: string, matchPattern: string): Promise<void> {
  const db = await getDb();
  const id = (await db.add("series", {
    name,
    matchPattern: matchPattern.toLowerCase(),
    favorited: true,
    createdAt: now(),
  } as SeriesRecord)) as number;

  // Backfill: link and surface already-stored events matching this series.
  const tx = db.transaction("events", "readwrite");
  const needle = matchPattern.toLowerCase();
  for await (const cursor of tx.store) {
    const e = cursor.value;
    if (e.seriesId === null && e.title.toLowerCase().includes(needle)) {
      await cursor.update({ ...e, seriesId: id, inRange: true });
    }
  }
  await tx.done;
}

export async function setSeriesFavorited(id: number, favorited: boolean): Promise<void> {
  const db = await getDb();
  const row = await db.get("series", id);
  if (!row) return;
  await db.put("series", { ...row, favorited });
  await recomputeInRange();
}

export async function deleteSeries(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("series", id);
  await recomputeInRange();
}

async function matchSeries(title: string): Promise<SeriesRecord | null> {
  const all = await listSeries();
  const lower = title.toLowerCase();
  return all.find((s) => lower.includes(s.matchPattern.toLowerCase())) ?? null;
}

// -------------------------------------------------------------------- venues

export async function listVenues(): Promise<VenueRecord[]> {
  const rows = await (await getDb()).getAll("venues");
  return rows.sort((a, b) => {
    if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function addVenue(
  name: string,
  url: string | null,
  address: string | null
): Promise<VenueRecord> {
  const db = await getDb();
  const coords = address ? await geocode(address) : null;
  const record = {
    name,
    url,
    address,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    favorited: false,
    source: "manual" as const,
    lastScrapedAt: null,
    createdAt: now(),
  };
  const id = (await db.add("venues", record as VenueRecord)) as number;
  return { ...record, id };
}

export async function setVenueFavorited(id: number, favorited: boolean): Promise<void> {
  const db = await getDb();
  const row = await db.get("venues", id);
  if (!row) return;
  await db.put("venues", { ...row, favorited });
}

export async function deleteVenue(id: number): Promise<void> {
  await (await getDb()).delete("venues", id);
}

/** Venues learned from a scrape or a photo — known by name only, geocoded once. */
export async function ensureVenue(name: string): Promise<VenueRecord> {
  const db = await getDb();
  const existing = await db.getFromIndex("venues", "byName", name);
  if (existing) return existing;

  const coords = await geocode(name);
  const record = {
    name,
    url: null,
    address: null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    favorited: false,
    source: "discovered" as const,
    lastScrapedAt: null,
    createdAt: now(),
  };
  const id = (await db.add("venues", record as VenueRecord)) as number;
  return { ...record, id };
}

// -------------------------------------------------------------------- events

export type IngestInput = {
  title: string;
  url?: string | null;
  source: string;
  startTime: string | null;
  endDate?: string | null;
  imageUrl?: string | null;
  venueName?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  photoId?: number | null;
  price?: string | null;
  category?: string | null;
};

export type IngestResult =
  | { status: "inserted"; id: number }
  | { status: "duplicate"; id: number };

export async function ingestEvent(input: IngestInput): Promise<IngestResult> {
  const db = await getDb();

  const dedupeKey = buildDedupeKey(
    input.title,
    input.venueName ?? null,
    input.startTime
  );
  const existing = await db.getFromIndex("events", "byDedupeKey", dedupeKey);
  if (existing) return { status: "duplicate", id: existing.id };

  let venue: VenueRecord | null = null;
  if (input.venueName) venue = await ensureVenue(input.venueName);

  let lat = input.lat ?? venue?.lat ?? null;
  let lng = input.lng ?? venue?.lng ?? null;
  if ((lat === null || lng === null) && input.address) {
    const coords = await geocode(input.address);
    lat = coords?.lat ?? null;
    lng = coords?.lng ?? null;
  }

  const series = await matchSeries(input.title);
  const inRange = series?.favorited ? true : await computeInRange(lat, lng);

  const record: Omit<EventRecord, "id"> = {
    title: input.title,
    url: input.url ?? null,
    source: input.source,
    venueId: venue?.id ?? null,
    venueName: input.venueName ?? null,
    seriesId: series?.id ?? null,
    startTime: input.startTime,
    endDate: input.endDate ?? null,
    imageUrl: input.imageUrl ?? null,
    lat,
    lng,
    inRange,
    status: "interested",
    dedupeKey,
    photoId: input.photoId ?? null,
    price: input.price ?? null,
    category: input.category ?? null,
    createdAt: now(),
  };

  const id = (await db.add("events", record as EventRecord)) as number;
  return { status: "inserted", id };
}

export type FeedRange = "tonight" | "weekend" | "all";

function windowFor(range: FeedRange): { from: Date; to: Date } | null {
  if (range === "all") return null;
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  if (range === "tonight") {
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }

  // Coming Friday through end of Sunday; if it's already the weekend, today.
  const day = from.getDay(); // 0 Sun … 6 Sat
  const untilFriday = day <= 5 ? 5 - day : 0;
  from.setDate(from.getDate() + untilFriday);
  const to = new Date(from);
  to.setDate(to.getDate() + (day === 0 ? 1 : 3));
  return { from, to };
}

export async function listEvents(
  range: FeedRange = "all",
  opts: { includeDismissed?: boolean; includeOutOfRange?: boolean } = {}
): Promise<EventRecord[]> {
  const all = await (await getDb()).getAll("events");
  const win = windowFor(range);

  return all
    .filter((e) => {
      if (!opts.includeDismissed && e.status === "dismissed") return false;
      if (!opts.includeOutOfRange && !e.inRange) return false;
      if (win) {
        if (!e.startTime) return false;
        const t = new Date(e.startTime);
        // A multi-day event counts while it is still running.
        const end = e.endDate ? new Date(`${e.endDate}T23:59:59`) : t;
        if (end < win.from || t >= win.to) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
}

export async function setEventStatus(
  id: number,
  status: EventRecord["status"]
): Promise<void> {
  const db = await getDb();
  const row = await db.get("events", id);
  if (!row) return;
  await db.put("events", { ...row, status });
}

export async function getEvent(id: number): Promise<EventRecord | undefined> {
  return (await getDb()).get("events", id);
}

// ---------------------------------------------------------------- candidates

export async function confirmCandidate(
  candidateId: number,
  corrected: CandidateFields
): Promise<IngestResult | null> {
  const db = await getDb();
  const candidate = await db.get("candidates", candidateId);
  if (!candidate) return null;

  const startTime = corrected.startDate
    ? `${corrected.startDate}T${corrected.startTime ?? "00:00"}:00`
    : null;

  const result = await ingestEvent({
    title: corrected.title,
    source: "photo",
    startTime,
    endDate: corrected.endDate,
    venueName: corrected.venueName,
    address:
      corrected.venueName && corrected.city
        ? `${corrected.venueName}, ${corrected.city}`
        : null,
    photoId: candidate.photoId,
    price: corrected.price,
    category: corrected.category,
  });

  await db.put("candidates", {
    ...candidate,
    current: corrected,
    status: "confirmed",
    eventId: result.id,
    correctedAt: now(),
  });

  return result;
}

export async function discardCandidate(
  candidateId: number,
  corrected?: CandidateFields
): Promise<void> {
  const db = await getDb();
  const candidate = await db.get("candidates", candidateId);
  if (!candidate) return;
  await db.put("candidates", {
    ...candidate,
    current: corrected ?? candidate.current,
    status: "discarded",
    correctedAt: now(),
  });
}

export async function listPendingCandidates() {
  const db = await getDb();
  return db.getAllFromIndex("candidates", "byStatus", "pending");
}

export async function listCandidatesForPhoto(photoId: number) {
  const db = await getDb();
  return db.getAllFromIndex("candidates", "byPhoto", photoId);
}
