const MONTHS: Record<string, number> = {
  januar: 1, jan: 1,
  februar: 2, feb: 2,
  "märz": 3, maerz: 3, mrz: 3,
  april: 4, apr: 4,
  mai: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12,
};

/** JS getDay() index for each German abbreviation. */
const WEEKDAY_INDEX: Record<string, number> = {
  so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6,
};

const MONTH_NAMES = Object.keys(MONTHS).join("|");

export type ParsedDate = {
  /** ISO date. Year may be inferred — check yearPrinted. */
  date: string;
  endDate: string | null;
  yearPrinted: boolean;
  weekday: string | null;
  /** False only when a weekday was printed and disagrees with the date. */
  weekdayMatches: boolean | null;
  raw: string;
  index: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Local listings routinely print "22.08." and expect you to know the year.
 *
 * When a weekday is printed alongside, it *determines* the year: "SA 04.07."
 * is 2026 and not 2027, because only 2026-07-04 is a Saturday. That beats
 * guessing from the context date, which would roll a July date photographed in
 * August forward by a year. Without a weekday, fall back to the next
 * occurrence at or after the context date.
 */
function inferYear(
  day: number,
  month: number,
  context: Date,
  weekday: string | null
): number {
  const base = context.getFullYear();

  if (weekday) {
    const expected = WEEKDAY_INDEX[weekday.toLowerCase().slice(0, 2)];
    if (expected !== undefined) {
      // Nearest year whose weekday agrees, preferring the current one.
      for (const year of [base, base + 1, base - 1]) {
        if (
          isRealDate(day, month, year) &&
          new Date(year, month - 1, day).getDay() === expected
        ) {
          return year;
        }
      }
    }
  }

  const candidate = new Date(base, month - 1, day);
  const cutoff = new Date(context);
  cutoff.setDate(cutoff.getDate() - 1);
  return candidate < cutoff ? base + 1 : base;
}

function normaliseYear(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (raw.length === 2) return 2000 + n;
  return n;
}

function isRealDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getMonth() === month - 1 && d.getDate() === day;
}

function build(
  day: number,
  month: number,
  yearRaw: string | undefined,
  weekday: string | null,
  raw: string,
  index: number,
  context: Date,
  endDay?: number,
  endMonth?: number
): ParsedDate | null {
  const printedYear = normaliseYear(yearRaw);
  const year = printedYear ?? inferYear(day, month, context, weekday);
  if (!isRealDate(day, month, year)) return null;

  const date = `${year}-${pad(month)}-${pad(day)}`;

  let endDate: string | null = null;
  if (endDay !== undefined) {
    const em = endMonth ?? month;
    if (isRealDate(endDay, em, year)) endDate = `${year}-${pad(em)}-${pad(endDay)}`;
  }

  let weekdayMatches: boolean | null = null;
  if (weekday) {
    const expected = WEEKDAY_INDEX[weekday.toLowerCase().slice(0, 2)];
    if (expected !== undefined) {
      weekdayMatches = new Date(year, month - 1, day).getDay() === expected;
    }
  }

  return {
    date,
    endDate,
    yearPrinted: printedYear !== null,
    weekday,
    weekdayMatches,
    raw: raw.trim(),
    index,
  };
}

/**
 * Finds every German date in a block of text. Handles the formats that
 * actually appear on local posters and listing pages:
 *   "FR 17.07."  "22.08.2026"  "Sa, 22.8.2026"  "19. Juli 2026"
 *   "17. bis 19. Juli 2026"  "21.-23. August 2026"
 */
export function parseGermanDates(text: string, context: Date = new Date()): ParsedDate[] {
  const found: ParsedDate[] = [];
  const spans: [number, number][] = [];

  // Patterns run most-specific first; a later, looser pattern must not re-match
  // text a range already consumed, or "17. bis 19. Juli" also yields a lone 19th.
  const overlaps = (start: number, end: number) =>
    spans.some(([s, e]) => start < e && end > s);

  const push = (m: RegExpExecArray | RegExpMatchArray, d: ParsedDate | null) => {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (overlaps(start, end)) return;
    spans.push([start, end]);
    if (d) found.push(d);
  };

  // "17. bis 19. Juli 2026" / "21.-23. August 2026"
  const rangeWord = new RegExp(
    `(\\d{1,2})\\.?\\s*(?:bis|–|-)\\s*(\\d{1,2})\\.?\\s*(${MONTH_NAMES})\\.?\\s*(\\d{2,4})?`,
    "gi"
  );
  for (const m of text.matchAll(rangeWord)) {
    const month = MONTHS[m[3].toLowerCase()];
    push(m, build(Number(m[1]), month, m[4], null, m[0], m.index ?? 0, context, Number(m[2]), month));
  }

  // "04.09. - 06.09."
  const rangeNum = /(\d{1,2})\.(\d{1,2})\.\s*(?:bis|–|-)\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g;
  for (const m of text.matchAll(rangeNum)) {
    push(
      m,
      build(Number(m[1]), Number(m[2]), m[5], null, m[0], m.index ?? 0, context, Number(m[3]), Number(m[4]))
    );
  }

  // "FR 17.07.26" / "Sa, 22.8.2026" / "22.08."
  const numeric = /(?:\b(MO|DI|MI|DO|FR|SA|SO)\b[.,]?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/gi;
  for (const m of text.matchAll(numeric)) {
    push(m, build(Number(m[2]), Number(m[3]), m[4], m[1] ?? null, m[0], m.index ?? 0, context));
  }

  // "Sa 22 08 2026" — OCR frequently drops the separating dots.
  const spaced = /\b(?:(MO|DI|MI|DO|FR|SA|SO)\s+)?(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/gi;
  for (const m of text.matchAll(spaced)) {
    push(m, build(Number(m[2]), Number(m[3]), m[4], m[1] ?? null, m[0], m.index ?? 0, context));
  }

  // "19. Juli 2026" / "12. Dezember" / "18 JULI 26"
  const worded = new RegExp(
    `(?:\\b(MO|DI|MI|DO|FR|SA|SO)\\b[.,]?\\s*)?(\\d{1,2})\\.?\\s*(${MONTH_NAMES})\\.?\\s*(\\d{2,4})?`,
    "gi"
  );
  for (const m of text.matchAll(worded)) {
    push(
      m,
      build(Number(m[2]), MONTHS[m[3].toLowerCase()], m[4], m[1] ?? null, m[0], m.index ?? 0, context)
    );
  }

  return found.sort((a, b) => a.index - b.index);
}

/** Character spans occupied by dates, so time parsing can skip them. */
function dateSpans(text: string, context: Date): [number, number][] {
  return parseGermanDates(text, context).map((d) => [d.index, d.index + d.raw.length]);
}

export type ParsedTime = {
  /** 24h HH:MM. */
  time: string;
  /** What the printed time actually means, when it isn't a plain start. */
  note: string | null;
  raw: string;
};

/**
 * "Einlass 15.00" is doors, "ab 14 Uhr" is open-ended, "11-17 Uhr" is a range —
 * collapsing them all to a start time loses the distinction that decides
 * whether you arrive on time.
 */
export function parseGermanTimes(text: string, context: Date = new Date()): ParsedTime[] {
  const out: ParsedTime[] = [];
  const seen = new Set<string>();
  // "22.08." and "04.07." look exactly like times; the date parser owns them.
  const excluded = dateSpans(text, context);

  const pattern =
    /(Einlass|Beginn|ab|von)?\s*:?\s*(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\s*(?:(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:Uhr)?)?|(?:(Einlass|Beginn|ab|von)\s*:?\s*)?\b(\d{1,2})\s*(?:-|–|bis)\s*(\d{1,2})\s*Uhr\b|(?:(Einlass|Beginn|ab|von)\s*:?\s*)?\b(\d{1,2})\s*Uhr\b/gi;

  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (excluded.some(([s, e]) => start < e && end > s)) continue;

    const hour = m[2] ?? m[7] ?? m[10];
    if (!hour) continue;
    const minute = m[3] ?? "00";
    const h = Number(hour);
    if (h > 23 || Number(minute) > 59) continue;

    const time = `${pad(h)}:${pad(Number(minute))}`;
    if (seen.has(time)) continue;
    seen.add(time);

    const qualifier = (m[1] ?? m[6] ?? m[9] ?? "").trim();
    const endHour = m[4] ?? m[8];
    const note = endHour
      ? `${time}–${pad(Number(endHour))}:${pad(Number(m[5] ?? 0))}`
      : qualifier
        ? qualifier.toLowerCase() === "ab"
          ? "ab"
          : qualifier
        : null;

    out.push({ time, note, raw: m[0].trim() });
  }

  return out;
}

export function parseGermanPrice(text: string): string | null {
  if (/\bEintritt\s+frei\b|\bfree\s+(admission|entry)\b|\bkostenlos\b/i.test(text)) {
    return "Eintritt frei";
  }
  // "AK 20€", "ak:20€", "20,00 €", "VVK 18 EUR"
  const m = text.match(
    /(?:\b(AK|VVK|Abendkasse|Vorverkauf)\b\s*:?\s*)?(\d{1,3}(?:[,.]\d{2})?)\s*(?:€|EUR\b)/i
  );
  if (!m) return null;
  const amount = m[2].replace(".", ",");
  return m[1] ? `${m[1].toUpperCase()} ${amount} €` : `${amount} €`;
}
