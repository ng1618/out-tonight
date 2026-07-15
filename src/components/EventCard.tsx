"use client";

import type { EventRow } from "@/lib/types";

function formatWhen(startTime: string | null): string {
  if (!startTime) return "Date unknown";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventCard({
  event,
  onStatusChange,
}: {
  event: EventRow;
  onStatusChange: (id: number, status: EventRow["status"]) => void;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      {event.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt=""
          className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={event.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-medium text-zinc-950 dark:text-zinc-50"
        >
          {event.title}
        </a>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatWhen(event.start_time)}
        </p>
        {event.venue_name && (
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {event.venue_name}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => onStatusChange(event.id, "going")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              event.status === "going"
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            Going
          </button>
          <button
            onClick={() => onStatusChange(event.id, "interested")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              event.status === "interested"
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            Interested
          </button>
          <button
            onClick={() => onStatusChange(event.id, "dismissed")}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
