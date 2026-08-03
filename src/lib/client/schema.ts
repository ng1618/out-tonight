import type { DBSchema } from "idb";

/**
 * The phone is the source of truth. Everything the app knows lives here;
 * the server holds no state at all and only answers two stateless questions
 * (fetch-and-parse a URL, geocode a name) that a browser cannot ask directly.
 */

export type EventRecord = {
  id: number;
  title: string;
  url: string | null;
  /** 'quick-add' | 'venue-scrape' | 'photo' */
  source: string;
  venueId: number | null;
  venueName: string | null;
  seriesId: number | null;
  /** ISO local datetime, e.g. 2026-08-22T20:00:00 */
  startTime: string | null;
  endDate: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  inRange: boolean;
  status: "interested" | "going" | "dismissed";
  dedupeKey: string;
  /** Set when the event came from a scanned photo, so the source is one tap away. */
  photoId: number | null;
  price: string | null;
  category: string | null;
  createdAt: string;
};

export type VenueRecord = {
  id: number;
  name: string;
  url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  favorited: boolean;
  source: "manual" | "discovered";
  lastScrapedAt: string | null;
  createdAt: string;
};

export type SeriesRecord = {
  id: number;
  name: string;
  matchPattern: string;
  favorited: boolean;
  createdAt: string;
};

export type HomeLocationRecord = {
  id: number;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
};

export type CropRect = { x: number; y: number; width: number; height: number };

export type PhotoRecord = {
  id: number;
  /** Always the untouched original, so a bad crop can be redone. */
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  /** Region actually sent to OCR, in original-image pixels. Null = whole photo. */
  cropRect: CropRect | null;
  createdAt: string;
};

/** One preprocessing variant's OCR outcome — kept for all variants, not just the winner. */
export type VariantLog = {
  label: string;
  rotation: number;
  enhanced: boolean;
  chars: number;
  confidence: number;
  lines: number;
  ms: number;
  score: number;
};

export type OcrLineRecord = {
  text: string;
  box: { x: number; y: number; width: number; height: number };
  confidence: number;
};

export type OcrRunRecord = {
  id: number;
  photoId: number;
  variants: VariantLog[];
  winner: string;
  totalMs: number;
  /** 'webgpu' | 'wasm' — which execution provider actually ran. */
  backend: string;
  model: string;
  text: string;
  lines: OcrLineRecord[];
  createdAt: string;
};

/** The fields a person can correct. Stored twice: as extracted, and as corrected. */
export type CandidateFields = {
  title: string;
  venueName: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  timeNote: string | null;
  price: string | null;
  category: string | null;
};

export type CandidateRecord = {
  id: number;
  photoId: number;
  runId: number;
  /** Immutable: exactly what OCR + rules produced. Never edited. */
  extracted: CandidateFields;
  /** Current values after any manual correction. */
  current: CandidateFields;
  yearPrinted: boolean;
  weekdayMatches: boolean | null;
  needsReview: string[];
  status: "pending" | "confirmed" | "discarded";
  eventId: number | null;
  correctedAt: string | null;
  createdAt: string;
};

export type GeocodeRecord = {
  query: string;
  lat: number | null;
  lng: number | null;
};

export interface OutTonightDB extends DBSchema {
  events: {
    key: number;
    value: EventRecord;
    indexes: { byStartTime: string; byDedupeKey: string; byPhoto: number };
  };
  venues: {
    key: number;
    value: VenueRecord;
    indexes: { byName: string };
  };
  series: { key: number; value: SeriesRecord };
  homeLocations: { key: number; value: HomeLocationRecord };
  photos: { key: number; value: PhotoRecord };
  ocrRuns: { key: number; value: OcrRunRecord; indexes: { byPhoto: number } };
  candidates: {
    key: number;
    value: CandidateRecord;
    indexes: { byPhoto: number; byStatus: string };
  };
  geocodeCache: { key: string; value: GeocodeRecord };
}

export const DB_NAME = "out-tonight";
export const DB_VERSION = 1;
