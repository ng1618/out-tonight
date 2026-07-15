"use client";

import { useCallback, useEffect, useState } from "react";
import type { SeriesRow } from "@/lib/types";

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [name, setName] = useState("");
  const [matchPattern, setMatchPattern] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/series");
    setSeries(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, matchPattern }),
    });
    setName("");
    setMatchPattern("");
    load();
  }

  async function toggleFavorited(s: SeriesRow) {
    await fetch(`/api/series/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited: !s.favorited }),
    });
    load();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/series/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Favorite series</h1>
      <p className="text-sm text-zinc-500">
        Recurring things — yearly festivals, monthly drag shows, whatever — always
        show up when a new instance is found, regardless of distance.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          required
          placeholder="Display name, e.g. Science Slam"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          required
          placeholder="Text to match in event titles, e.g. science slam"
          value={matchPattern}
          onChange={(e) => setMatchPattern(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          Add favorite series
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {series.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}</p>
              <p className="truncate text-xs text-zinc-500">
                matches &ldquo;{s.match_pattern}&rdquo;
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={() => toggleFavorited(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  s.favorited
                    ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-black"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {s.favorited ? "Favorited" : "Not favorited"}
              </button>
              <button
                onClick={() => handleDelete(s.id)}
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
