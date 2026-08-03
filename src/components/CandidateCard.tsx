"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { CandidateFields, CandidateRecord } from "@/lib/client/schema";
import { confirmCandidate, discardCandidate } from "@/lib/client/store";

/** A tap on one of the photo's boxes, routed from the page to the active card. */
export type BoxCommand = { id: number; candidateId: number; text: string };

export type DetectedLine = { text: string; confidence: number };

/**
 * Filters OCR debris out of the suggestions. Deliberately *not* a dictionary
 * check: a German wordlist would reject KREAOKE, CH'AHOM, Vulvodynia and
 * FLINTA* — the proper nouns that matter most — while happily passing
 * plausible-looking nonsense. The model's own confidence is the better signal,
 * with a few shape rules for the junk that still scores well.
 */
function looksLikeJunk(line: DetectedLine): boolean {
  const text = line.text.trim();
  if (text.length < 3) return true;
  if (line.confidence < 0.6) return true;
  // Bare digit runs like "062130" — a real one ("Rock 13") has letters too.
  if (/^[\d\s.,:/-]+$/.test(text) && !/\d{1,2}[.:]\d{2}/.test(text)) return true;
  // Letters with no vowel at all ("strg", "rt.Ist") are almost always misreads;
  // short all-caps like DJ or KUZ are legitimate, so length-gate it.
  if (text.length > 3 && /[a-zäöüß]/i.test(text) && !/[aeiouäöüy]/i.test(text)) return true;
  return false;
}

const LABELS: Record<string, string> = {
  title: "Title",
  startDate: "Date",
  startTime: "Time",
  venueName: "Venue",
  city: "City",
  price: "Price",
};

type Target = "title" | "venueName" | "city";

export default function CandidateCard({
  candidate,
  lines = [],
  boxCommand,
  onPickingChange,
  onResolved,
}: {
  candidate: CandidateRecord;
  /** Every line OCR found, so unused ones can be tapped into a field. */
  lines?: DetectedLine[];
  boxCommand?: BoxCommand | null;
  /** Tells the page which card and field the photo's boxes should feed. */
  onPickingChange?: (candidateId: number, target: Target | null) => void;
  onResolved: (id: number) => void;
}) {
  const [draft, setDraft] = useState<CandidateFields>(candidate.current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>("title");
  const [showLines, setShowLines] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showJunk, setShowJunk] = useState(false);
  const junkCount = lines.filter(looksLikeJunk).length;

  /**
   * Toggle rather than append: tapping a piece already in the field takes it
   * out again. That is what makes order fixable — remove "Open Air", add
   * "49. Flörsheimer", then add "Open Air" back after it.
   *
   * When the caret is sitting inside the field, the text lands *there* rather
   * than at the end, so a missing first word can be dropped into place without
   * clearing everything first.
   */
  const toggleInField = useCallback(
    (text: string) => {
      setDraft((d) => {
        const current = d[target] ?? "";
        const at = current.toLowerCase().indexOf(text.toLowerCase());
        if (at !== -1) {
          const without = (current.slice(0, at) + current.slice(at + text.length))
            .replace(/\s{2,}/g, " ")
            .trim();
          return { ...d, [target]: without || null };
        }
        if (!current) return { ...d, [target]: text };

        // caretRef is captured on blur, which fires before the tap's click.
        const caret = caretRef.current;
        const pos =
          caret && caret.field === target && caret.pos <= current.length
            ? caret.pos
            : current.length;

        const before = current.slice(0, pos).replace(/\s+$/, "");
        const after = current.slice(pos).replace(/^\s+/, "");
        const joined = [before, text, after].filter(Boolean).join(" ");
        return { ...d, [target]: joined };
      });
    },
    [target]
  );

  /** Remembers where the cursor was, since tapping a chip blurs the input. */
  const caretRef = useRef<{ field: Target; pos: number } | null>(null);

  const rememberCaret = (key: keyof CandidateFields) => (
    e: React.SyntheticEvent<HTMLInputElement>
  ) => {
    if (key === "title" || key === "venueName" || key === "city") {
      caretRef.current = {
        field: key,
        pos: e.currentTarget.selectionStart ?? e.currentTarget.value.length,
      };
    }
  };

  /** In the field being edited — tapping again removes it. */
  const inTarget = (text: string) =>
    (draft[target] ?? "").toLowerCase().includes(text.toLowerCase());

  /** Used by some other field, so worth dimming but not marking as selected. */
  const inOtherField = (text: string) =>
    !inTarget(text) &&
    Object.entries(draft).some(
      ([k, v]) =>
        k !== target && typeof v === "string" && v.toLowerCase().includes(text.toLowerCase())
    );

  // Taps on the photo's boxes are routed here by the page, which knows which
  // card is currently picking.
  useEffect(() => {
    if (boxCommand && boxCommand.candidateId === candidate.id) {
      toggleInField(boxCommand.text);
    }
    // Keyed on the command id so the same text can be tapped twice in a row.
  }, [boxCommand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Tracked on every interaction so the position survives the blur that
        // tapping a chip or a box causes.
        onSelect={rememberCaret(key)}
        onKeyUp={rememberCaret(key)}
        onClick={rememberCaret(key)}
        onFocus={() => {
          if (key === "title" || key === "venueName" || key === "city") {
            setTarget(key);
            onPickingChange?.(candidate.id, key);
          }
        }}
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

      {/* Time and price are still parsed and logged, just not shown — they are
          not worth a field each when a page yields a dozen events. */}
      {field("startDate", "Date", "date")}

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
      {field("title", "Title")}

      <div className="grid grid-cols-2 gap-2">
        {field("venueName", "Venue")}
        {field("city", "City")}
      </div>

      <div className="grid grid-cols-2 gap-2">
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
                  ] as [Target, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTarget(key);
                      onPickingChange?.(candidate.id, key);
                    }}
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
                {/* Best-read lines first. Confidence can't separate a real
                    short title from a clipped fragment — both score well — so
                    it orders rather than hides, and cropping tighter remains
                    the actual fix for a cluttered list. */}
                {(showJunk ? lines : lines.filter((l) => !looksLikeJunk(l)))
                  .slice()
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((line, i) => (
                    <button
                      key={`${i}-${line.text}`}
                      type="button"
                      onClick={() => toggleInField(line.text)}
                      className={`rounded border px-2 py-1 text-xs ${
                        inTarget(line.text)
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                          : inOtherField(line.text)
                            ? "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                            : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {line.text}
                    </button>
                  )
                )}
              </div>

              {junkCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowJunk((v) => !v)}
                  className="self-start text-xs text-zinc-500 underline"
                >
                  {showJunk
                    ? `Hide ${junkCount} low-confidence`
                    : `Show ${junkCount} low-confidence`}
                </button>
              )}
              <p className="text-xs text-zinc-500">
                Tap to add to{" "}
                <span className="font-medium">
                  {target === "venueName" ? "Venue" : target}
                </span>
                ; tap a filled-in one to take it out again. You can also tap the
                boxes on the photo above.
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
