import * as cheerio from "cheerio";
import type { ScrapedEvent } from "../scrape";

const GERMAN_WEEKDAY_DATE = /(\d{2})\.(\d{2})\.(\d{2})/;

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

    // Subtitle text (e.g. "Konzert im KESSELHAUS") isn't a real street
    // address, so it's not passed through for geocoding.
    seen.set(href, {
      title,
      url: href,
      startTime: startDate,
      imageUrl: null,
      address: null,
      lat: null,
      lng: null,
    });
  });

  return [...seen.values()];
}
