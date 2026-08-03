"use client";

import { findCategory } from "../categories";
import { parseGermanDates, parseGermanPrice, parseGermanTimes } from "../parseGerman";
import type { CandidateFields, OcrLineRecord } from "./schema";

export type BuiltCandidate = {
  extracted: CandidateFields;
  yearPrinted: boolean;
  weekdayMatches: boolean | null;
  categorySource: "printed" | "guessed" | null;
  categoryEvidence: string | null;
  categorySuggestion: string | null;
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

  // A page with many dates is a programme, where each row's title sits beside
  // its own date and looking further afield steals a neighbour's. One or two
  // dates means a poster, where the title is the big text at the top — above
  // the date, which row-and-below clustering can never reach.
  const dateLineCount = decorated.filter(
    (l) => parseGermanDates(l.text, contextDate).length > 0
  ).length;
  const posterMode = dateLineCount <= 2;

  const posterTitle = posterMode
    ? decorated
        .filter((l) => {
          const text = l.text.trim();
          if (text.length < 4) return false;
          if (parseGermanDates(text, contextDate).length > 0) return false;
          // Skip the boilerplate that is never a poster's name.
          if (/^(www\.|https?:)/i.test(text)) return false;
          if (/eintritt|einlass|camping|tickets?|vvk|abendkasse/i.test(text)) return false;
          if (!/[a-zäöüß]/i.test(text)) return false;
          return true;
        })
        // Biggest type wins: font size survives OCR even when characters don't.
        .sort((a, b) => b.box.height - a.box.height)[0] ?? null
    : null;

  for (const anchor of decorated) {
    const dates = parseGermanDates(anchor.text, contextDate);
    if (dates.length === 0) continue;

    // Lines to the right on the same row: "SA 04.07. | FLINTA* MUSIC LAB".
    //
    // The gap matters. On a two-column grid the nearest thing on the same row
    // is the *other column's* event, and treating it as this row's title is how
    // "KONZERT: POP" ended up naming a different date. A real continuation sits
    // a few characters away; another column sits across a gutter.
    const maxGap = anchor.box.height * 3;
    const rowMates = decorated
      .filter(
        (l) =>
          l !== anchor &&
          sameRow(anchor, l) &&
          l.box.x >= anchor.box.x &&
          l.box.x - anchor.right < maxGap
      )
      .sort((a, b) => a.box.x - b.box.x);

    // Lines below, in the same column, stopping at the next date. A grid title
    // wraps over several lines ("DIES & DAS –" / "DER NACHTFLOH-" / "MARKT IN
    // MAINZ"), so a fixed distance either truncates it or runs into the next
    // event; the next date is the real boundary.
    const columnWidth = Math.max(anchor.box.width, anchor.box.height * 8);
    const beneath = decorated
      .filter(
        (l) =>
          l.box.y > anchor.box.y &&
          l.box.y < anchor.bottom + anchor.box.height * 6 &&
          Math.abs(l.box.x - anchor.box.x) < columnWidth
      )
      .sort((a, b) => a.box.y - b.box.y);

    const stopAt = beneath.findIndex(
      (l) => parseGermanDates(l.text, contextDate).length > 0
    );
    const below = (stopAt === -1 ? beneath : beneath.slice(0, stopAt)).filter(
      (l) => parseGermanDates(l.text, contextDate).length === 0
    );

    // Titles only ever come from the same row, or from below when the row was
    // empty — a wider net here is what pulled in the neighbouring column.
    const cluster = rowMates.length > 0 ? rowMates : below;

    // On a poster the whole image is one event, so price and category can be
    // read from anywhere on it; on a programme they must stay within the row.
    const contextText = posterMode
      ? decorated.map((l) => l.text).join(" ")
      : [anchor.text, ...rowMates.map((l) => l.text), ...below.map((l) => l.text)].join(" ");
    const clusterText = contextText;

    // A line that is itself a date is never the title — that mistake turns the
    // next programme row's date into this event's name. Month headings
    // ("AUGUST 2026") and stray fragments are excluded the same way.
    const titleCandidates = cluster.filter((l) => {
          const text = l.text.trim();
          if (text.length < 3) return false;
          if (parseGermanDates(text, contextDate).length > 0) return false;
          if (/^(MO|DI|MI|DO|FR|SA|SO)\b/i.test(text) && text.length < 12) return false;
          // A line that is *only* a category label names the kind of event,
          // not the event — "KONZERT: POP" is not a title.
          const asCategory = findCategory([text]);
          if (asCategory?.source === "printed" && text.length < 24) return false;
      return true;
    });

    // A grid title wraps: "DIES & DAS –" / "DER NACHTFLOH-" / "MARKT IN MAINZ"
    // are one name across three boxes. Start from the largest line and take the
    // lines directly under it that are set at the same size — a smaller line
    // below is the category or the subtitle, not more of the title.
    const seed =
      posterTitle ?? [...titleCandidates].sort((a, b) => b.box.height - a.box.height)[0] ?? null;

    const titleParts: Line[] = [];
    if (seed) {
      titleParts.push(seed);
      const ordered = titleCandidates
        .filter((l) => l.box.y > seed.box.y)
        .sort((a, b) => a.box.y - b.box.y);
      let last = seed;
      for (const line of ordered) {
        const sameSize = Math.abs(line.box.height - seed.box.height) <= seed.box.height * 0.3;
        const adjacent = line.box.y - last.bottom < seed.box.height * 1.2;
        if (!sameSize || !adjacent) break;
        titleParts.push(line);
        last = line;
      }
    }

    for (const date of dates) {
      const title = (
        titleParts.length > 0 ? titleParts.map((l) => l.text).join(" ") : anchor.text
      )
        .replace(/\s+/g, " ")
        .trim();
      const key = `${date.date}|${title.toLowerCase()}`;
      if (usedTitles.has(key)) continue;
      usedTitles.add(key);

      const times = parseGermanTimes(clusterText, contextDate);
      const price = parseGermanPrice(clusterText);

      // Checked line by line so the result can point at the box it came from.
      const found = findCategory(
        posterMode
          ? decorated.map((l) => l.text)
          : [...below.map((l) => l.text), ...rowMates.map((l) => l.text), anchor.text]
      );

      // Only a label actually printed on the page is filled in; anything
      // inferred is offered as a suggestion for you to accept or overrule.
      const category = found?.source === "printed" ? found.category : null;

      const needsReview: string[] = [];
      if (!date.yearPrinted) needsReview.push("startDate");
      if (date.weekdayMatches === false) needsReview.push("startDate");
      if (titleParts.length === 0) needsReview.push("title");
      if (times.length === 0) needsReview.push("startTime");
      if (!category) needsReview.push("category");

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
          category,
        },
        yearPrinted: date.yearPrinted,
        weekdayMatches: date.weekdayMatches,
        categorySource: found?.source ?? null,
        categoryEvidence: found?.evidence ?? null,
        categorySuggestion: found?.source === "guessed" ? found.category : null,
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
