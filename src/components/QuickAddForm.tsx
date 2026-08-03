"use client";

import { useState } from "react";
import type { ScrapedEvent } from "@/lib/scrape";
import { ingestEvent } from "@/lib/client/store";

export default function QuickAddForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMessage(null);

    try {
      // The server only fetches and parses — the event is stored here on the phone.
      const res = await fetch("/api/fetch-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { events?: ScrapedEvent[]; error?: string };

      if (!res.ok) {
        setMessage(data.error ?? "Could not read that link");
        return;
      }

      const scraped = data.events?.[0];
      if (!scraped) {
        setMessage("Nothing event-like on that page");
        return;
      }

      const result = await ingestEvent({
        title: scraped.title,
        url: scraped.url ?? url,
        source: "quick-add",
        startTime: scraped.startTime,
        imageUrl: scraped.imageUrl,
        venueName: scraped.externalVenue ?? null,
        address: scraped.address,
        lat: scraped.lat,
        lng: scraped.lng,
      });

      setMessage(
        result.status === "duplicate" ? "Already saved" : `Saved: ${scraped.title}`
      );
      setUrl("");
      onAdded();
    } catch {
      setMessage("Offline — adding a link needs a connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          required
          placeholder="Paste an event link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>}
    </form>
  );
}
