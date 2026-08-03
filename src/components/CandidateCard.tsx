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

type Target = "title" | "venueName" | "city" | "price";

export default function CandidateCard({
  candidate,
  lines = [],
  onResolved,
}: {
  candidate: CandidateRecord;
  /** Every line OCR found, so unused ones can be tapped into a field. */
  lines?: string[];
  onResolved: (id: number) => void;
}) {
  const [draft, setDraft] = useState<CandidateFields>(candidate.current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>("title");
  const [showLines, setShowLines] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  /** Append a detected line to the chosen field rather than retyping it. */
  function appendToField(text: string) {
    setDraft((d) => {
      const current = d[target];
      return { ...d, [target]: current ? `${current} ${text}`.trim() : text };
    });
  }

  const isUsed = (text: string) =>
    Object.values(draft).some(
      (v) => typeof v === "string" && v.toLowerCase().includes(text.toLowerCase())
    );

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

      {/* Multi-day events ("17 bis 19. Juli") need an end date, and one that
          was detected but never shown couldn't be corrected. */}
      {(draft.endDate || showEnd) && (
        <div className="grid grid-cols-2 gap-2">
          {field("endDate", "Ends", "date")}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDraft({ ...draft, endDate: null });
                setShowEnd(false);
              }}
              className="text-xs text-zinc-500 underline"
            >
              single day
            </button>
          </div>
        </div>
      )}
      {!draft.endDate && !showEnd && (
        <button
          type="button"
          onClick={() => setShowEnd(true)}
          className="self-start text-xs text-zinc-500 underline"
        >
          Runs over several days
        </button>
      )}
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

      {/* OCR usually reads more than gets used. Rather than retyping a title it
          already found, pick the target field and tap the pieces into it —
          quicker than a keyboard and it preserves the exact characters read. */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setShowLines((v) => !v)}
            className="self-start text-xs font-medium text-zinc-500"
          >
            {showLines ? "Hide" : "Show"} detected text ({lines.length})
          </button>

          {showLines && (
            <>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["title", "Title"],
                    ["venueName", "Venue"],
                    ["city", "City"],
                    ["price", "Price"],
                  ] as [Target, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTarget(key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      target === key
                        ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    → {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {lines.map((text, i) => (
                  <button
                    key={`${i}-${text}`}
                    type="button"
                    onClick={() => appendToField(text)}
                    // Already-used lines are dimmed rather than hidden, since a
                    // word can legitimately belong to two fields.
                    className={`rounded border px-2 py-1 text-xs ${
                      isUsed(text)
                        ? "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                        : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                Tapping adds to <span className="font-medium">{target === "venueName" ? "Venue" : target}</span>.
              </p>
            </>
          )}
        </div>
      )}

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
