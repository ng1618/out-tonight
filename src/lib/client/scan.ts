"use client";

import { buildCandidates } from "./buildCandidates";
import { getDb } from "./db";
import { readImage, type ProgressUpdate } from "./ocr";
import { cropImage, imageDimensions } from "./preprocess";
import type {
  CandidateRecord,
  CropRect,
  OcrRunRecord,
  PhotoRecord,
} from "./schema";

export type ScanResult = {
  photoId: number;
  runId: number;
  candidateCount: number;
  totalMs: number;
  winner: string;
  confidence: number;
  backend: string;
};

/**
 * Camera → stored photo → OCR across variants → parsed candidates, all on the
 * device. The photo is written first and kept whatever happens afterwards, so a
 * failed or disappointing read can be re-processed later without re-shooting.
 */
export async function scanPhoto(
  file: Blob,
  onProgress?: (update: ProgressUpdate) => void,
  cropRect: CropRect | null = null
): Promise<ScanResult> {
  const db = await getDb();
  const { width, height } = await imageDimensions(file);

  const photoId = (await db.add("photos", {
    blob: file,
    width,
    height,
    bytes: file.size,
    cropRect,
    createdAt: new Date().toISOString(),
  } as PhotoRecord)) as number;

  // Only the cropped region is read; the original stays untouched on disk.
  const forOcr = cropRect ? await cropImage(file, cropRect) : file;
  const ocr = await readImage(forOcr, onProgress);

  const runId = (await db.add("ocrRuns", {
    photoId,
    variants: ocr.variants,
    winner: ocr.winner,
    totalMs: ocr.totalMs,
    backend: ocr.backend,
    model: ocr.model,
    text: ocr.text,
    lines: ocr.lines,
    createdAt: new Date().toISOString(),
  } as OcrRunRecord)) as number;

  const built = buildCandidates(ocr.lines);

  const tx = db.transaction("candidates", "readwrite");
  await Promise.all(
    built.map((c) =>
      tx.store.add({
        photoId,
        runId,
        extracted: c.extracted,
        // Starts identical; every later difference is a correction worth logging.
        current: { ...c.extracted },
        yearPrinted: c.yearPrinted,
        weekdayMatches: c.weekdayMatches,
        needsReview: c.needsReview,
        status: "pending",
        eventId: null,
        correctedAt: null,
        createdAt: new Date().toISOString(),
      } as CandidateRecord)
    )
  );
  await tx.done;

  return {
    photoId,
    runId,
    candidateCount: built.length,
    totalMs: ocr.totalMs,
    winner: ocr.winner,
    confidence: ocr.confidence,
    backend: ocr.backend,
  };
}

/**
 * Read an already-stored photo again with a different crop. Candidates you have
 * already confirmed or discarded are left alone; only the unreviewed ones are
 * replaced, so re-cropping never undoes work you did.
 */
export async function rescanPhoto(
  photoId: number,
  cropRect: CropRect | null,
  onProgress?: (update: ProgressUpdate) => void
): Promise<ScanResult | null> {
  const db = await getDb();
  const photo = await db.get("photos", photoId);
  if (!photo) return null;

  const [oldRuns, oldCandidates] = await Promise.all([
    db.getAllFromIndex("ocrRuns", "byPhoto", photoId),
    db.getAllFromIndex("candidates", "byPhoto", photoId),
  ]);

  const clear = db.transaction(["ocrRuns", "candidates"], "readwrite");
  await Promise.all([
    ...oldRuns.map((r) => clear.objectStore("ocrRuns").delete(r.id)),
    ...oldCandidates
      .filter((c) => c.status === "pending")
      .map((c) => clear.objectStore("candidates").delete(c.id)),
  ]);
  await clear.done;

  await db.put("photos", { ...photo, cropRect });

  const forOcr = cropRect ? await cropImage(photo.blob, cropRect) : photo.blob;
  const ocr = await readImage(forOcr, onProgress);

  const runId = (await db.add("ocrRuns", {
    photoId,
    variants: ocr.variants,
    winner: ocr.winner,
    totalMs: ocr.totalMs,
    backend: ocr.backend,
    model: ocr.model,
    text: ocr.text,
    lines: ocr.lines,
    createdAt: new Date().toISOString(),
  } as OcrRunRecord)) as number;

  const built = buildCandidates(ocr.lines);
  const tx = db.transaction("candidates", "readwrite");
  await Promise.all(
    built.map((c) =>
      tx.store.add({
        photoId,
        runId,
        extracted: c.extracted,
        current: { ...c.extracted },
        yearPrinted: c.yearPrinted,
        weekdayMatches: c.weekdayMatches,
        needsReview: c.needsReview,
        status: "pending",
        eventId: null,
        correctedAt: null,
        createdAt: new Date().toISOString(),
      } as CandidateRecord)
    )
  );
  await tx.done;

  return {
    photoId,
    runId,
    candidateCount: built.length,
    totalMs: ocr.totalMs,
    winner: ocr.winner,
    confidence: ocr.confidence,
    backend: ocr.backend,
  };
}

export async function listPhotos(): Promise<PhotoRecord[]> {
  const rows = await (await getDb()).getAll("photos");
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPhoto(id: number): Promise<PhotoRecord | undefined> {
  return (await getDb()).get("photos", id);
}

export async function getRunForPhoto(photoId: number): Promise<OcrRunRecord | undefined> {
  const runs = await (await getDb()).getAllFromIndex("ocrRuns", "byPhoto", photoId);
  return runs[0];
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await getDb();
  const [runs, candidates] = await Promise.all([
    db.getAllFromIndex("ocrRuns", "byPhoto", id),
    db.getAllFromIndex("candidates", "byPhoto", id),
  ]);
  const tx = db.transaction(["photos", "ocrRuns", "candidates"], "readwrite");
  await Promise.all([
    tx.objectStore("photos").delete(id),
    ...runs.map((r) => tx.objectStore("ocrRuns").delete(r.id)),
    ...candidates.map((c) => tx.objectStore("candidates").delete(c.id)),
  ]);
  await tx.done;
}
