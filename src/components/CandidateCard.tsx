"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { CandidateFields, CandidateRecord } from "@/lib/client/schema";
import { confirmCandidate, discardCandidate } from "@/lib/client/store";

const LABELS: Record<string, string> = {
  title: "Title",
  startDate: "Date",
  startTime: "Time",
  venueName: "Venue",
  city: "City",
  price: "Price",
};

export default function CandidateCard({
  candidate,
  onResolved,
}: {
  candidate: CandidateRecord;
  onResolved: (id: number) => void;
}) {
  const [draft, setDraft] = useState<CandidateFields>(candidate.current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const flags = candidate.needsReview;

  async function resolve(action: "confirm" | "uninteresting" | "notAnEvent") {
    setBusy(true);
    setMessage(null);
    if (action === "confirm") {
      const result = await confirmCandidate(candidate.id, draft);
      if (result?.status === "duplicate") setMessage("Already in your feed");
    } else {
      await discardCandidate(candidate.id, action, draft);
    }
    setBusy(false);
    onResolved(candidate.id);
  }

  const field = (
    key: keyof CandidateFields,
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
        {flags.includes(key) && " · check"}
      </span>
      <input
        type={type}
        value={draft[key] ?? ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value || null })}
        className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      {flags.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Not certain: {flags.map((f) => LABELS[f] ?? f).join(", ")}
          {!candidate.yearPrinted && " · year not printed"}
          {candidate.weekdayMatches === false && " · weekday disagrees with date"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {field("startDate", "Date", "date")}
        {field("startTime", "Time", "time")}
      </div>
      {candidate.extracted.timeNote && (
        <p className="-mt-1 text-xs text-zinc-500">
          Printed as: {candidate.extracted.timeNote}
        </p>
      )}

      {field("title", "Title")}

      <div className="grid grid-cols-2 gap-2">
        {field("venueName", "Venue")}
        {field("city", "City")}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {field("price", "Price")}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">
            Category
            {candidate.categorySource === "printed" && (
              <span className="text-emerald-600 dark:text-emerald-500"> · on the page</span>
            )}
          </span>
          <select
            value={draft.category ?? ""}
            onChange={(e) => setDraft({ ...draft, category: e.target.value || null })}
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

      {/* A guess is offered rather than applied: nothing on the page said this,
          so it needs a deliberate tap. The line it came from is shown so the
          suggestion can be judged instead of trusted. */}
      {candidate.categorySuggestion && !draft.category && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Guess: <span className="font-medium">{candidate.categorySuggestion}</span>{" "}
              — not printed
            </p>
            {candidate.categoryEvidence && (
              <p className="truncate text-xs text-zinc-500">
                from &ldquo;{candidate.categoryEvidence}&rdquo;
              </p>
            )}
          </div>
          <button
            onClick={() =>
              setDraft({ ...draft, category: candidate.categorySuggestion })
            }
            className="flex-shrink-0 rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white"
          >
            Use
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={() => resolve("confirm")}
          disabled={busy}
          className="rounded-lg bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {busy ? "…" : "Add to feed"}
        </button>
        <div className="flex gap-2">
          {/* Kept apart on purpose: "not interesting" is a correct read you
              don't want, "not an event" is a failed one. */}
          <button
            onClick={() => resolve("uninteresting")}
            disabled={busy}
            className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Not interesting
          </button>
          <button
            onClick={() => resolve("notAnEvent")}
            disabled={busy}
            className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Not an event
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
