"use client";

import { useCallback, useEffect, useState } from "react";
import EventCard from "@/components/EventCard";
import QuickAddForm from "@/components/QuickAddForm";
import type { EventRecord } from "@/lib/client/schema";
import { listEvents, setEventStatus, type FeedRange } from "@/lib/client/store";

const RANGES: { key: FeedRange; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "Weekend" },
  { key: "all", label: "All" },
];

export default function FeedPage() {
  const [range, setRange] = useState<FeedRange>("tonight");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setEvents(await listEvents(range));
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: number, status: EventRecord["status"]) {
    setEvents((prev) =>
      status === "dismissed"
        ? prev.filter((e) => e.id !== id)
        : prev.map((e) => (e.id === id ? { ...e, status } : e))
    );
    await setEventStatus(id, status);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <QuickAddForm onAdded={load} />

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              range === r.key
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-zinc-500">Nothing here yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </div>
  );
}
