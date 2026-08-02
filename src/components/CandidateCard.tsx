"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { CandidateRow } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  startDate: "Date",
  startTime: "Time",
  venueName: "Venue",
  city: "City",
  price: "Price",
};

function reviewFlags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export default function CandidateCard({
  candidate,
  onResolved,
}: {
  candidate: CandidateRow;
  onResolved: (id: number) => void;
}) {
  const [draft, setDraft] = useState({
    title: candidate.title,
    startDate: candidate.start_date ?? "",
    startTime: candidate.start_time ?? "",
    venueName: candidate.venue_name ?? "",
    city: candidate.city ?? "",
    price: candidate.price ?? "",
    category: candidate.category ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const flags = reviewFlags(candidate.needs_review);

  async function send(status: "confirmed" | "discarded") {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        startDate: draft.startDate || null,
        startTime: draft.startTime || null,
        venueName: draft.venueName || null,
        city: draft.city || null,
        price: draft.price || null,
        category: draft.category || null,
        status,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage(data.error ?? "Something went wrong");
      return;
    }
    if (data.status === "duplicate") {
      setMessage("Already in your feed");
    }
    onResolved(candidate.id);
  }

  const field = (
    key: keyof typeof draft,
    label: string,
    type: "text" | "date" | "time" = "text"
  ) => (
    <label className="flex flex-col gap-1">
      <span
        className={`text-xs ${
          flags.includes(key)
            ? "font-medium text-amber-600 dark:text-amber-500"
            : "text-zinc-500"
        }`}
      >
        {label}
        {flags.includes(key) && " · check this"}
      </span>
      <input
        type={type}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-medium">{candidate.title}</p>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs ${
            candidate.confidence === "high"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : candidate.confidence === "low"
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {candidate.confidence}
        </span>
      </div>

      {candidate.subtitle && (
        <p className="-mt-2 text-sm text-zinc-500">{candidate.subtitle}</p>
      )}

      {flags.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Not certain: {flags.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {field("startDate", "Date", "date")}
        {field("startTime", "Time", "time")}
      </div>
      {candidate.time_note && (
        <p className="-mt-1 text-xs text-zinc-500">Printed as: {candidate.time_note}</p>
      )}

      {field("title", "Title")}
      <div className="grid grid-cols-2 gap-2">
        {field("venueName", "Venue")}
        {field("city", "City")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("price", "Price")}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Category</span>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {candidate.end_date && (
        <p className="text-xs text-zinc-500">Runs until {candidate.end_date}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => send("confirmed")}
          disabled={busy}
          className="flex-1 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {busy ? "…" : "Add to feed"}
        </button>
        <button
          onClick={() => send("discarded")}
          disabled={busy}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Not an event
        </button>
      </div>

      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
