import { getDb } from "./db";

export type SeriesRow = {
  id: number;
  name: string;
  match_pattern: string;
  venue_id: number | null;
  favorited: number;
  notes: string | null;
};

/** Substring match on normalized title — simple and predictable for a handful of series. */
export function matchSeries(title: string): SeriesRow | null {
  const db = getDb();
  const series = db.prepare("SELECT * FROM series").all() as SeriesRow[];
  const normalizedTitle = title.toLowerCase();

  for (const s of series) {
    if (normalizedTitle.includes(s.match_pattern.toLowerCase())) {
      return s;
    }
  }
  return null;
}
