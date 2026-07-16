import type { ScrapedEvent } from "../scrape";
import { scrapeSchlachthofWiesbaden } from "./schlachthof-wiesbaden";

type SiteScraper = (html: string) => ScrapedEvent[];

const REGISTRY: Record<string, SiteScraper> = {
  "schlachthof-wiesbaden.de": scrapeSchlachthofWiesbaden,
};

/** Bespoke per-site parsers for venues with no JSON-LD/OpenGraph at all. */
export function findSiteScraper(url: string): SiteScraper | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return REGISTRY[hostname] ?? null;
  } catch {
    return null;
  }
}
