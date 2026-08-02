import { getDb } from "./db";
import type { ExtractedCandidate } from "./extract";
import type { CandidateRow } from "./types";

export type { CandidateRow };

export function saveCandidates(
  rawSourceId: number,
  candidates: ExtractedCandidate[]
): number[] {
  const db = getDb();

  const insert = db.prepare(
    `INSERT INTO extraction_candidates
       (raw_source_id, title, subtitle, venue_name, city, start_date, end_date,
        start_time, time_note, price, category, confidence, needs_review)
     VALUES (@rawSourceId, @title, @subtitle, @venueName, @city, @startDate, @endDate,
             @startTime, @timeNote, @price, @category, @confidence, @needsReview)`
  );

  const ids: number[] = [];
  const insertAll = db.transaction((rows: ExtractedCandidate[]) => {
    for (const c of rows) {
      // An unprinted year and a weekday that contradicts the date are both
      // things the person must confirm, so they join whatever the model flagged.
      const review = new Set(c.needsReview);
      if (c.startDate && !c.yearPrinted) review.add("startDate");
      if (c.weekdayMatches === false) review.add("startDate");

      const result = insert.run({
        rawSourceId,
        title: c.title,
        subtitle: c.subtitle,
        venueName: c.venueName,
        city: c.city,
        startDate: c.startDate,
        endDate: c.endDate,
        startTime: c.startTime,
        timeNote: c.timeNote,
        price: c.price,
        category: c.category,
        confidence: c.confidence,
        needsReview: review.size > 0 ? JSON.stringify([...review]) : null,
      });
      ids.push(Number(result.lastInsertRowid));
    }
  });

  insertAll(candidates);
  return ids;
}

export function listCandidates(rawSourceId?: number): CandidateRow[] {
  const db = getDb();
  if (rawSourceId !== undefined) {
    return db
      .prepare(
        "SELECT * FROM extraction_candidates WHERE raw_source_id = ? ORDER BY start_date IS NULL, start_date, id"
      )
      .all(rawSourceId) as CandidateRow[];
  }
  return db
    .prepare(
      "SELECT * FROM extraction_candidates WHERE status = 'pending' ORDER BY raw_source_id DESC, start_date IS NULL, start_date, id"
    )
    .all() as CandidateRow[];
}

/** Combines the extracted date and time into the ISO string events store. */
export function candidateStartTime(row: {
  start_date: string | null;
  start_time: string | null;
}): string | null {
  if (!row.start_date) return null;
  return `${row.start_date}T${row.start_time ?? "00:00"}:00`;
}
