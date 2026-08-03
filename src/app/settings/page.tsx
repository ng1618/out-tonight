"use client";

import { useCallback, useEffect, useState } from "react";
import { storageEstimate } from "@/lib/client/db";
import { buildExport, downloadExport } from "@/lib/client/export";
import type { HomeLocationRecord } from "@/lib/client/schema";
import {
  addHomeLocation,
  deleteHomeLocation,
  listHomeLocations,
  updateHomeRadius,
} from "@/lib/client/store";

type Summary = Awaited<ReturnType<typeof buildExport>>["summary"];

export default function SettingsPage() {
  const [homes, setHomes] = useState<HomeLocationRecord[]>([]);
  const [label, setLabel] = useState("");
  const [place, setPlace] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [message, setMessage] = useState<string | null>(null);
  const [storage, setStorage] = useState({ usedMb: 0, quotaMb: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setHomes(await listHomeLocations());
    setStorage(await storageEstimate());
    setSummary((await buildExport()).summary);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const added = await addHomeLocation(label.trim(), place.trim(), radiusKm);
    if (!added) {
      setMessage("Could not find that place (needs a connection the first time)");
      return;
    }
    setLabel("");
    setPlace("");
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Home locations</h1>
      <p className="text-sm text-zinc-500">
        Events within a location&apos;s radius show up in the feed. Straight-line
        distance, as a stand-in for drive time.
      </p>

      <div className="flex flex-col gap-2">
        {homes.map((home) => (
          <div
            key={home.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="min-w-0">
              <p className="font-medium">{home.label}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="number"
                  defaultValue={home.radiusKm}
                  onBlur={async (e) => {
                    await updateHomeRadius(home.id, Number(e.target.value));
                    load();
                  }}
                  className="w-16 rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-800 dark:bg-zinc-900"
                />
                km radius
              </div>
            </div>
            <button
              onClick={async () => {
                await deleteHomeLocation(home.id);
                load();
              }}
              className="flex-shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          required
          placeholder="Label, e.g. Darmstadt"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          required
          placeholder="Place to look up, e.g. Darmstadt, Germany"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
          <span className="text-sm text-zinc-500">km radius</span>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          Add location
        </button>
      </form>

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <h2 className="text-lg font-semibold">Field-test log</h2>
      {summary && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">Photos scanned</dt>
          <dd className="text-right">{summary.photos}</dd>
          <dt className="text-zinc-500">Candidates found</dt>
          <dd className="text-right">{summary.candidates}</dd>
          <dt className="text-zinc-500">Added to feed</dt>
          <dd className="text-right">{summary.confirmed}</dd>
          <dt className="text-zinc-500">Real, not interesting</dt>
          <dd className="text-right">{summary.uninteresting}</dd>
          <dt className="text-zinc-500">Not an event (misread)</dt>
          <dd className="text-right">{summary.notAnEvent}</dd>
          <dt className="text-zinc-500">Needed correction</dt>
          <dd className="text-right">{summary.corrected}</dd>
          <dt className="text-zinc-500">Marked going</dt>
          <dd className="text-right">{summary.going}</dd>
          <dt className="text-zinc-500">Storage used</dt>
          <dd className="text-right">
            {storage.usedMb} MB{storage.quotaMb ? ` / ${storage.quotaMb} MB` : ""}
          </dd>
        </dl>
      )}

      <button
        onClick={downloadExport}
        className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Export log as JSON
      </button>
      <p className="text-xs text-zinc-500">
        Photos stay on the phone; the export carries the OCR results, your
        corrections, and timings.
      </p>
    </div>
  );
}
