import * as cheerio from "cheerio";
import type { ScrapedEvent } from "../scrape";

const GERMAN_WEEKDAY_DATE = /(\d{2})\.(\d{2})\.(\d{2})/;

/**
 * The subtitle names the room in ALL CAPS at the very end
 * ("... Konzert in der JAHRHUNDERTHALLE FRANKFURT"). Requiring caps avoids
 * matching prose like "Haus im Meer Tour"; the last match wins because
 * earlier "im"/"in der" occurrences belong to tour or workshop names.
 */
const VENUE_PHRASE = /(?:\bim|\bin der|\bin den)\s+([A-ZÄÖÜ]{2,}(?:[\s-][A-ZÄÖÜ0-9.]{2,})*)/g;

/**
 * Rooms and outdoor areas that are part of the Schlachthof site itself.
 * Compared word-by-word, never as a substring: "JAHRHUNDERTHALLE FRANKFURT"
 * contains "HALLE" but is a different venue in another city.
 */
const OWN_ROOMS = new Set([
  "kesselhaus",
  "halle",
  "kulturpark",
  "backyard",
  "schlachthof",
]);

function extractVenuePhrase(subtitle: string): string | null {
  let last: string | null = null;
  for (const match of subtitle.matchAll(VENUE_PHRASE)) {
    last = match[1].trim().replace(/\.$/, "");
  }
  return last;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep, chr) => sep + chr.toUpperCase());
}

/**
 * schlachthof-wiesbaden.de has no JSON-LD/OpenGraph at all, but the
 * homepage calendar embeds a full date per event in plain text
 * ("Fr / 17.07.26"), just no time-of-day. Parsed straight from the DOM
 * structure, so this breaks if they redesign the site.
 */
export function scrapeSchlachthofWiesbaden(html: string): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, ScrapedEvent>();

  $('a[href*="/events/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || seen.has(href)) return;

    const divs = $(el).children("div");
    if (divs.length < 2) return;

    const dateText = $(divs[0]).text();
    const dateMatch = dateText.match(GERMAN_WEEKDAY_DATE);
    if (!dateMatch) return;

    const [, day, month, yearShort] = dateMatch;
    const startDate = `20${yearShort}-${month}-${day}T00:00:00`;

    const titleEl = $(divs[1]).find("span").first();
    const title = titleEl.text().trim();
    if (!title) return;

    const subtitle = $(divs[1]).text().replace(/\s+/g, " ").trim();
    const venuePhrase = extractVenuePhrase(subtitle);

    // Schlachthof also promotes shows it hosts at other venues. Unknown rooms
    // count as external on purpose: mislabelling a real venue as "Schlachthof"
    // puts the event at the wrong coordinates, while an unresolvable external
    // name just leaves the location empty and still surfaces the event.
    const isOwnRoom =
      venuePhrase === null ||
      venuePhrase
        .toLowerCase()
        .split(/[\s-]+/)
        .some((word) => OWN_ROOMS.has(word));

    seen.set(href, {
      title,
      url: href,
      startTime: startDate,
      imageUrl: null,
      address: null,
      lat: null,
      lng: null,
      externalVenue: isOwnRoom ? null : toTitleCase(venuePhrase),
    });
  });

  return [...seen.values()];
}
