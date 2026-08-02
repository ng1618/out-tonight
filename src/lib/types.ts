export type EventRow = {
  id: number;
  title: string;
  url: string | null;
  source: string;
  venue_id: number | null;
  venue_name: string | null;
  series_id: number | null;
  start_time: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  in_range: number;
  status: "interested" | "going" | "dismissed";
  dedupe_key: string | null;
  created_at: string;
};

export type VenueRow = {
  id: number;
  name: string;
  /** null for venues discovered while scraping — known by name only. */
  url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  favorited: number;
  source: "manual" | "discovered";
  last_scraped_at: string | null;
  created_at: string;
};

export type SeriesRow = {
  id: number;
  name: string;
  match_pattern: string;
  venue_id: number | null;
  favorited: number;
  notes: string | null;
  created_at: string;
};

export type HomeLocationRow = {
  id: number;
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  created_at: string;
};
