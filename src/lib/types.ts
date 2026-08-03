/**
 * Shared types that aren't tied to storage. The app's records live in
 * `src/lib/client/schema.ts` — the phone holds all state, so there are no
 * server-side row types any more.
 */

export type { Category } from "./categories";
export type { ScrapedEvent, OpenGraphData } from "./scrape";
