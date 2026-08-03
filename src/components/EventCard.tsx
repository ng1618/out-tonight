"use client";

import Link from "next/link";
import type { EventRecord } from "@/lib/client/schema";

function formatWhen(event: EventRecord): string {
  if (!event.startTime) return "Date unknown";
  const date = new Date(event.startTime);
  if (Number.isNaN(date.getTime())) return event.startTime;

  const hasTime = !event.startTime.endsWith("T00:00:00");
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = hasTime
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  if (event.endDate) {
    const end = new Date(`${event.endDate}T00:00:00`);
    return `${day} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return time ? `${day}, ${time}` : day;
}

export default function EventCard({
  event,
  onStatusChange,
}: {
  event: EventRecord;
  onStatusChange: (id: number, status: EventRecord["status"]) => void;
}) {
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active
        ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    }`;

  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      {event.photoId !== null && (
        // Scanned events link back to the photo they came from.
        <Link
          href={`/photos/${event.photoId}`}
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800"
          aria-label="View source photo"
        >
          🖼
        </Link>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-zinc-950 dark:text-zinc-50"
          >
            {event.title}
          </a>
        ) : (
          <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
            {event.title}
          </p>
        )}

        <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatWhen(event)}</p>

        {(event.venueName || event.price) && (
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {[event.venueName, event.price].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-1 flex gap-2">
          <button onClick={() => onStatusChange(event.id, "going")} className={pill(event.status === "going")}>
            Going
          </button>
          <button
            onClick={() => onStatusChange(event.id, "interested")}
            className={pill(event.status === "interested")}
          >
            Interested
          </button>
          <button onClick={() => onStatusChange(event.id, "dismissed")} className={pill(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
