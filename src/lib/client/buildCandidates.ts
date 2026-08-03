"use client";

import { parseGermanDates, parseGermanPrice, parseGermanTimes } from "../parseGerman";
import type { CandidateFields, OcrLineRecord } from "./schema";

export type BuiltCandidate = {
  extracted: CandidateFields;
  yearPrinted: boolean;
  weekdayMatches: boolean | null;
  needsReview: string[];
};

type Line = OcrLineRecord & { centreY: number; bottom: number; right: number };

function decorate(lines: OcrLineRecord[]): Line[] {
  return lines.map((l) => ({
    ...l,
    centreY: l.box.y + l.box.height / 2,
    bottom: l.box.y + l.box.height,
    right: l.box.x + l.box.width,
  }));
}

/** Two lines share a row when their vertical extents mostly overlap. */
function sameRow(a: Line, b: Line): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.box.y, b.box.y);
  return overlap > Math.min(a.box.height, b.box.height) * 0.5;
}

/**
 * Reading-order text interleaves the columns of a magazine page into nonsense
 * ("SMD407 SOMMERFE FLINTA*OPEN STAGE"). Bounding boxes fix that with
 * arithmetic: a date anchors a candidate, and only lines on the same row to its
 * right — or directly beneath it — belong to that event.
 */
export function buildCandidates(
  lines: OcrLineRecord[],
  contextDate: Date = new Date()
): BuiltCandidate[] {
  const decorated = decorate(lines);
  const candidates: BuiltCandidate[] = [];
  const usedTitles = new Set<string>();

  for (const anchor of decorated) {
    const dates = parseGermanDates(anchor.text, contextDate);
    if (dates.length === 0) continue;

    // Lines to the right on the same row: "SA 04.07. | FLINTA* MUSIC LAB".
    const rowMates = decorated
      .filter((l) => l !== anchor && sameRow(anchor, l) && l.box.x >= anchor.box.x)
      .sort((a, b) => a.box.x - b.box.x);

    // Only look below when the row itself carried nothing, and stop well before
    // the next row — otherwise the following event's date becomes this title.
    const below =
      rowMates.length > 0
        ? []
        : decorated
            .filter(
              (l) =>
                l.box.y > anchor.box.y &&
                l.box.y < anchor.bottom + anchor.box.height * 0.9 &&
                Math.abs(l.box.x - anchor.box.x) < Math.max(anchor.box.width, l.box.width)
            )
            .sort((a, b) => a.box.y - b.box.y);

    const cluster = [...rowMates, ...below];
    const clusterText = [anchor.text, ...cluster.map((l) => l.text)].join(" ");

    // A line that is itself a date is never the title — that mistake turns the
    // next programme row's date into this event's name. Month headings
    // ("AUGUST 2026") and stray fragments are excluded the same way.
    const titleLine =
      cluster
        .filter((l) => {
          const text = l.text.trim();
          if (text.length < 3) return false;
          if (parseGermanDates(text, contextDate).length > 0) return false;
          if (/^(MO|DI|MI|DO|FR|SA|SO)\b/i.test(text) && text.length < 12) return false;
          return true;
        })
        .sort((a, b) => b.box.height - a.box.height)[0] ?? null;

    for (const date of dates) {
      const title = (titleLine?.text ?? anchor.text).replace(/\s+/g, " ").trim();
      const key = `${date.date}|${title.toLowerCase()}`;
      if (usedTitles.has(key)) continue;
      usedTitles.add(key);

      const times = parseGermanTimes(clusterText, contextDate);
      const price = parseGermanPrice(clusterText);

      const needsReview: string[] = [];
      if (!date.yearPrinted) needsReview.push("startDate");
      if (date.weekdayMatches === false) needsReview.push("startDate");
      if (!titleLine) needsReview.push("title");
      if (times.length === 0) needsReview.push("startTime");

      candidates.push({
        extracted: {
          title,
          venueName: null,
          city: null,
          startDate: date.date,
          endDate: date.endDate,
          startTime: times[0]?.time ?? null,
          timeNote: times[0]?.note ?? null,
          price,
          category: null,
        },
        yearPrinted: date.yearPrinted,
        weekdayMatches: date.weekdayMatches,
        needsReview: [...new Set(needsReview)],
      });
    }
  }

  return anchorYears(candidates);
}

/**
 * A programme page covers one season. Where a weekday or a printed year pins a
 * date down, that year is evidence for its neighbours: rows whose weekday OCR
 * missed would otherwise be rolled forward a year by the fallback rule, which
 * is how five correct July entries came out as 2027.
 */
function anchorYears(candidates: BuiltCandidate[]): BuiltCandidate[] {
  const anchored = candidates.filter(
    (c) => c.extracted.startDate && (c.yearPrinted || c.weekdayMatches === true)
  );
  if (anchored.length === 0) return candidates;

  const counts = new Map<number, number>();
  for (const c of anchored) {
    const year = Number(c.extracted.startDate!.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const [dominantYear] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Months present on the page, used to tell a genuine year rollover
  // (a December page listing January) from a mis-inferred one.
  const anchorMonths = anchored.map((c) => Number(c.extracted.startDate!.slice(5, 7)));
  const maxAnchorMonth = Math.max(...anchorMonths);

  return candidates.map((c) => {
    if (!c.extracted.startDate || c.yearPrinted || c.weekdayMatches !== null) return c;

    const [year, month, day] = c.extracted.startDate.split("-").map(Number);
    if (year === dominantYear) return c;

    // Only pull back to the page's year when the month fits the same run of
    // months; a January date on a December page really is next year.
    if (month > maxAnchorMonth + 1) return c;

    const corrected = `${dominantYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      ...c,
      extracted: { ...c.extracted, startDate: corrected },
      needsReview: [...new Set([...c.needsReview, "startDate"])],
    };
  });
}
