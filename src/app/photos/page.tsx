"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CandidateCard from "@/components/CandidateCard";
import type { CandidateRow } from "@/lib/types";

type Group = { rawSourceId: number; candidates: CandidateRow[] };

function groupBySource(rows: CandidateRow[]): Group[] {
  const map = new Map<number, CandidateRow[]>();
  for (const row of rows) {
    const list = map.get(row.raw_source_id) ?? [];
    list.push(row);
    map.set(row.raw_source_id, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rawSourceId, candidates]) => ({ rawSourceId, candidates }));
}

export default function PhotosPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/photos");
    setGroups(groupBySource(await res.json()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(file: File) {
    setStatus("uploading");
    setMessage("Reading the photo…");

    const body = new FormData();
    body.append("photo", file);

    const res = await fetch("/api/photos", { method: "POST", body });
    const data = await res.json();
    setStatus("idle");

    if (!res.ok) {
      setMessage(
        data.status === "refused"
          ? "That image was declined by the safety filter."
          : (data.error ?? "Extraction failed — the photo was kept, try again later.")
      );
      return;
    }

    const found = data.candidates?.length ?? 0;
    setMessage(
      data.status === "duplicate"
        ? `Already read this photo — ${found} event${found === 1 ? "" : "s"} from it below.`
        : found === 0
          ? "No events found in that image."
          : `Found ${found} event${found === 1 ? "" : "s"}.`
    );
    load();
  }

  function handleResolved(id: number) {
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, candidates: g.candidates.filter((c) => c.id !== id) }))
        .filter((g) => g.candidates.length > 0)
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Photos</h1>
      <p className="text-sm text-zinc-500">
        Photograph a poster or a listings page. Everything found is shown for you to
        confirm — one photo often holds several events, and some of them aren&apos;t
        events at all.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileInput.current?.click()}
        disabled={status === "uploading"}
        className="rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {status === "uploading" ? "Reading…" : "Add a photo"}
      </button>

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      {groups.length === 0 && status === "idle" && (
        <p className="text-sm text-zinc-500">Nothing waiting for review.</p>
      )}

      {groups.map((group) => (
        <div key={group.rawSourceId} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${group.rawSourceId}/image`}
              alt=""
              className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
            />
            <p className="text-sm text-zinc-500">
              {group.candidates.length} event
              {group.candidates.length === 1 ? "" : "s"} found in this photo
            </p>
          </div>

          {group.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onResolved={handleResolved}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
