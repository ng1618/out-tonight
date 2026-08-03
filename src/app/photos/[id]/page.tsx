"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CandidateCard from "@/components/CandidateCard";
import PhotoWithBoxes from "@/components/PhotoWithBoxes";
import { getPhoto, getRunForPhoto, deletePhoto } from "@/lib/client/scan";
import type { CandidateRecord, OcrRunRecord, PhotoRecord } from "@/lib/client/schema";
import { listCandidatesForPhoto } from "@/lib/client/store";

export default function PhotoDetailPage() {
  const params = useParams<{ id: string }>();
  const photoId = Number(params.id);

  const [photo, setPhoto] = useState<PhotoRecord | null>(null);
  const [run, setRun] = useState<OcrRunRecord | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showText, setShowText] = useState(false);

  const load = useCallback(async () => {
    const [p, r, c] = await Promise.all([
      getPhoto(photoId),
      getRunForPhoto(photoId),
      listCandidatesForPhoto(photoId),
    ]);
    setPhoto(p ?? null);
    setRun(r ?? null);
    setCandidates(c);
  }, [photoId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!photo) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-zinc-500">Photo not found.</p>
        <Link href="/photos" className="text-sm underline">
          Back to photos
        </Link>
      </div>
    );
  }

  const pending = candidates.filter((c) => c.status === "pending");
  const resolved = candidates.filter((c) => c.status !== "pending");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/photos" className="text-sm underline">
          ← Photos
        </Link>
        <button
          onClick={async () => {
            await deletePhoto(photoId);
            window.location.href = "/photos";
          }}
          className="text-sm text-zinc-500"
        >
          Delete
        </button>
      </div>

      <PhotoWithBoxes blob={photo.blob} lines={run?.lines ?? []} showBoxes={showBoxes} />

      {run && (
        <div className="flex flex-col gap-2 text-xs text-zinc-500">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>best: {run.winner}</span>
            <span>{run.lines.length} lines</span>
            <span>{(run.totalMs / 1000).toFixed(1)}s</span>
            <span>{run.backend}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBoxes((v) => !v)}
              className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {showBoxes ? "Hide boxes" : "Show boxes"}
            </button>
            <button
              onClick={() => setShowText((v) => !v)}
              className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {showText ? "Hide raw text" : "Show raw text"}
            </button>
          </div>
          {showText && (
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-2 text-[11px] dark:bg-zinc-900">
              {run.text || "(nothing read)"}
            </pre>
          )}
        </div>
      )}

      {pending.length === 0 && resolved.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nothing was readable in this photo. The image is kept, so it can be read
          again later with a better method.
        </p>
      )}

      {pending.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          onResolved={() => load()}
        />
      ))}

      {resolved.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-zinc-500">
            Already handled ({resolved.length})
          </h2>
          {resolved.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <span className="min-w-0 truncate">{c.current.title}</span>
              <span className="flex-shrink-0 text-xs text-zinc-500">
                {c.status === "confirmed" ? "in feed" : "discarded"}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
