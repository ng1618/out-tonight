"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScrapedEvent } from "@/lib/scrape";
import type { VenueRecord } from "@/lib/client/schema";
import {
  addVenue,
  deleteVenue,
  ingestEvent,
  listVenues,
  setVenueFavorited,
} from "@/lib/client/store";
import { getDb } from "@/lib/client/db";

export default function VenuesPage() {
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => setVenues(await listVenues()), []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (venues.some((v) => v.name.toLowerCase() === name.trim().toLowerCase())) {
      setMessage("A venue with that name already exists");
      return;
    }
    await addVenue(name.trim(), url.trim() || null, address.trim() || null);
    setName("");
    setUrl("");
    setAddress("");
    load();
  }

  /** Refresh needs connectivity: the browser can't fetch venue sites itself. */
  async function handleRefresh(venue: VenueRecord) {
    if (!venue.url) return;
    setBusyId(venue.id);
    setMessage(null);
    try {
      const res = await fetch("/api/fetch-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: venue.url, mode: "listing" }),
      });
      const data = (await res.json()) as { events?: ScrapedEvent[]; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not reach that site");
        return;
      }

      const events = data.events ?? [];
      let added = 0;
      for (const scraped of events) {
        const result = await ingestEvent({
          title: scraped.title,
          url: scraped.url,
          source: "venue-scrape",
          startTime: scraped.startTime,
          imageUrl: scraped.imageUrl,
          // An event the venue merely promotes happens somewhere else.
          venueName: scraped.externalVenue ?? venue.name,
          address: scraped.address,
          lat: scraped.lat,
          lng: scraped.lng,
        });
        if (result.status === "inserted") added += 1;
      }

      const db = await getDb();
      await db.put("venues", { ...venue, lastScrapedAt: new Date().toISOString() });
      setMessage(`Found ${events.length}, added ${added} new`);
      load();
    } catch {
      setMessage("Offline — refreshing a venue needs a connection");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Venues</h1>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          required
          placeholder="Venue name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          type="url"
          placeholder="Events page URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          placeholder="Address (optional, improves location filtering)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          Add venue
        </button>
      </form>

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      <div className="flex flex-col gap-2">
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="flex items-start gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <button
              onClick={async () => {
                await setVenueFavorited(venue.id, !venue.favorited);
                load();
              }}
              aria-label={venue.favorited ? "Unfavourite" : "Favourite"}
              aria-pressed={venue.favorited}
              className={`flex-shrink-0 text-lg leading-none ${
                venue.favorited ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"
              }`}
            >
              {venue.favorited ? "★" : "☆"}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{venue.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {venue.url
                  ? venue.lastScrapedAt
                    ? `Last checked ${new Date(venue.lastScrapedAt).toLocaleDateString()}`
                    : "Never checked"
                  : "Found while scanning · no site to check"}
                {venue.lat === null && " · location unknown"}
              </p>
            </div>

            <div className="flex flex-shrink-0 gap-2">
              {venue.url && (
                <button
                  onClick={() => handleRefresh(venue)}
                  disabled={busyId === venue.id}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {busyId === venue.id ? "Checking…" : "Refresh"}
                </button>
              )}
              <button
                onClick={async () => {
                  await deleteVenue(venue.id);
                  load();
                }}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
