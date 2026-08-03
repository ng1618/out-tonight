"use client";

import { useEffect, useState } from "react";
import { listVenues, setVenueForPendingCandidates } from "@/lib/client/store";
import type { VenueRecord } from "@/lib/client/schema";

/**
 * Sets the venue on every unreviewed candidate from one photo at once. A
 * listings page is a single venue's programme, so asking for it per event is
 * the same answer typed a dozen times.
 */
export default function BulkVenue({
  photoId,
  count,
  onApplied,
}: {
  photoId: number;
  count: number;
  onApplied: () => void;
}) {
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [applied, setApplied] = useState<number | null>(null);

  useEffect(() => {
    listVenues().then(setVenues);
  }, []);

  async function apply() {
    const n = await setVenueForPendingCandidates(
      photoId,
      venueName.trim() || null,
      city.trim() || null
    );
    setApplied(n);
    onApplied();
  }

  // Pointless for a single event — the card's own venue field is right there.
  if (count < 2) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-medium">All {count} at the same venue?</p>

      <div className="grid grid-cols-2 gap-2">
        <input
          list="known-venues"
          placeholder="Venue"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        {/* Venues you already track, so a repeat programme is two taps. */}
        <datalist id="known-venues">
          {venues.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>
      </div>

      <button
        onClick={apply}
        disabled={!venueName.trim() && !city.trim()}
        className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Apply to all {count}
      </button>

      {applied !== null && (
        <p className="text-xs text-zinc-500">
          Set on {applied} event{applied === 1 ? "" : "s"} — still editable below.
        </p>
      )}
    </div>
  );
}
