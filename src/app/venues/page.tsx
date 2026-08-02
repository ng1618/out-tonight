"use client";

import { useCallback, useEffect, useState } from "react";
import type { VenueRow } from "@/lib/types";

export default function VenuesPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/venues");
    setVenues(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, address: address || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setName("");
    setUrl("");
    setAddress("");
    load();
  }

  async function handleRefresh(id: number) {
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/venues/${id}/refresh`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(`Found ${data.found}, added ${data.inserted} new`);
    load();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/venues/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleFavorited(venue: VenueRow) {
    setVenues((prev) =>
      prev.map((v) => (v.id === venue.id ? { ...v, favorited: v.favorited ? 0 : 1 } : v))
    );
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited: !venue.favorited }),
    });
    load();
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
          required
          type="url"
          placeholder="Venue website / events page URL"
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
              onClick={() => toggleFavorited(venue)}
              aria-label={venue.favorited ? "Unfavourite" : "Favourite"}
              aria-pressed={Boolean(venue.favorited)}
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
                  ? venue.last_scraped_at
                    ? `Last checked ${new Date(venue.last_scraped_at).toLocaleDateString()}`
                    : "Never checked"
                  : "Found while scraping · no site to check"}
                {venue.lat === null && " · location unknown"}
              </p>
            </div>

            <div className="flex flex-shrink-0 gap-2">
              {venue.url && (
                <button
                  onClick={() => handleRefresh(venue.id)}
                  disabled={busyId === venue.id}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {busyId === venue.id ? "Checking…" : "Refresh"}
                </button>
              )}
              <button
                onClick={() => handleDelete(venue.id)}
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
