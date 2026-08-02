import * as cheerio from "cheerio";

export type ScrapedEvent = {
  title: string;
  url: string | null;
  startTime: string | null;
  imageUrl: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /**
   * Set when the event happens somewhere other than the site being scraped —
   * venues also promote shows they host elsewhere. Such an event must not
   * inherit the scraped venue's coordinates.
   */
  externalVenue?: string | null;
};

const FETCH_USER_AGENT = "out-tonight-personal-app/1.0 (single-user event tracker)";

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": FETCH_USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function flattenJsonLd(node: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    if (n && typeof n === "object") {
      const obj = n as Record<string, unknown>;
      out.push(obj);
      if (obj["@graph"]) visit(obj["@graph"]);
    }
  };
  visit(node);
  return out;
}

function isEventType(obj: Record<string, unknown>): boolean {
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) => typeof t === "string" && t.toLowerCase().includes("event")
  );
}

function extractAddress(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;
  const loc = location as Record<string, unknown>;
  const address = loc["address"];
  if (typeof address === "string") return address;
  if (address && typeof address === "object") {
    const a = address as Record<string, unknown>;
    return [a.streetAddress, a.postalCode, a.addressLocality, a.addressCountry]
      .filter((v) => typeof v === "string" && v.length > 0)
      .join(", ");
  }
  if (typeof loc.name === "string") return loc.name;
  return null;
}

function extractGeo(location: unknown): { lat: number | null; lng: number | null } {
  if (!location || typeof location !== "object") return { lat: null, lng: null };
  const loc = location as Record<string, unknown>;
  const geo = loc["geo"];
  if (geo && typeof geo === "object") {
    const g = geo as Record<string, unknown>;
    const lat = typeof g.latitude === "number" ? g.latitude : parseFloat(String(g.latitude));
    const lng = typeof g.longitude === "number" ? g.longitude : parseFloat(String(g.longitude));
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  return { lat: null, lng: null };
}

function extractImage(image: unknown): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image) && typeof image[0] === "string") return image[0];
  if (image && typeof image === "object") {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

/** Finds every schema.org Event in a page's JSON-LD blocks. */
export function extractJsonLdEvents(html: string): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    for (const node of flattenJsonLd(parsed)) {
      if (!isEventType(node)) continue;

      const name = typeof node.name === "string" ? node.name : null;
      if (!name) continue;

      const { lat, lng } = extractGeo(node.location);

      events.push({
        title: name,
        url: typeof node.url === "string" ? node.url : null,
        startTime: typeof node.startDate === "string" ? node.startDate : null,
        imageUrl: extractImage(node.image),
        address: extractAddress(node.location),
        lat,
        lng,
      });
    }
  });

  return events;
}

export type OpenGraphData = {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
};

export function extractOpenGraph(html: string): OpenGraphData {
  const $ = cheerio.load(html);
  const get = (prop: string) => $(`meta[property="${prop}"]`).attr("content") ?? null;

  return {
    title: get("og:title") ?? ($("title").text() || null),
    imageUrl: get("og:image"),
    description: get("og:description"),
  };
}

/**
 * Best-effort single-event extraction for a quick-add link: prefer JSON-LD
 * Event data (structured, often has date/venue), fall back to plain OG tags
 * (just a bookmark with a title/image).
 */
export function scrapeSingleEvent(html: string, sourceUrl: string): ScrapedEvent {
  const jsonLdEvents = extractJsonLdEvents(html);
  if (jsonLdEvents.length > 0) {
    return { ...jsonLdEvents[0], url: jsonLdEvents[0].url ?? sourceUrl };
  }

  const og = extractOpenGraph(html);
  return {
    title: og.title ?? sourceUrl,
    url: sourceUrl,
    startTime: null,
    imageUrl: og.imageUrl,
    address: null,
    lat: null,
    lng: null,
  };
}
