"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CropBox from "@/components/CropBox";
import { getDb } from "@/lib/client/db";
import { warmUpOcr, type ProgressUpdate } from "@/lib/client/ocr";
import { listPhotos, scanPhoto } from "@/lib/client/scan";
import type { CropRect, PhotoRecord } from "@/lib/client/schema";

type Row = { photo: PhotoRecord; pending: number; total: number; url: string };

export default function PhotosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backend, setBackend] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    const photos = await listPhotos();
    const next: Row[] = [];
    for (const photo of photos) {
      const candidates = await db.getAllFromIndex("candidates", "byPhoto", photo.id);
      next.push({
        photo,
        pending: candidates.filter((c) => c.status === "pending").length,
        total: candidates.length,
        url: URL.createObjectURL(photo.blob),
      });
    }
    setRows((old) => {
      old.forEach((r) => URL.revokeObjectURL(r.url));
      return next;
    });
  }, []);

  useEffect(() => {
    load();
    warmUpOcr()
      .then(setBackend)
      .catch(() => setBackend("unavailable"));
  }, [load]);

  async function run(file: File, cropRect: CropRect | null) {
    setMessage(null);
    setProgress({ index: 0, total: 8, label: "preparing", bestScore: 0 });
    try {
      const result = await scanPhoto(file, setProgress, cropRect);
      setMessage(
        result.candidateCount === 0
          ? `Nothing readable (${(result.totalMs / 1000).toFixed(1)}s). Open it to crop tighter or type it in.`
          : `Found ${result.candidateCount} in ${(result.totalMs / 1000).toFixed(1)}s — best ${result.winner}`
      );
      setPendingFile(null);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Photos</h1>
        {backend && <span className="text-xs text-zinc-500">OCR: {backend}</span>}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPendingFile(file);
            setMessage(null);
          }
          e.target.value = "";
        }}
      />

      {pendingFile ? (
        <CropBox
          blob={pendingFile}
          busy={progress !== null}
          onApply={(rect) => run(pendingFile, rect)}
          onSkip={() => run(pendingFile, null)}
        />
      ) : (
        <button
          onClick={() => fileInput.current?.click()}
          disabled={progress !== null}
          className="rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {progress ? "Reading…" : "Add a photo"}
        </button>
      )}

      {progress && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm">
            Trying variant {progress.index} of {progress.total} — {progress.label}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-zinc-950 transition-all dark:bg-zinc-50"
              style={{ width: `${(progress.index / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Every rotation is tried and the clearest read wins — this takes a moment.
          </p>
        </div>
      )}

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      {rows.length === 0 && !progress && !pendingFile && (
        <p className="text-sm text-zinc-500">No photos yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <Link
            key={row.photo.id}
            href={`/photos/${row.photo.id}`}
            className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.url}
              alt=""
              className="aspect-square w-full rounded-lg object-cover"
            />
            <p className="text-xs text-zinc-500">
              {row.pending > 0
                ? `${row.pending} to review`
                : row.total > 0
                  ? `${row.total} done`
                  : "nothing found"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
