"use client";

import { getDb, storageEstimate } from "./db";
import type { CandidateFields } from "./schema";

/** Which fields you actually had to correct — the labelled error signal. */
function diffFields(
  extracted: CandidateFields,
  current: CandidateFields
): Record<string, { was: string | null; now: string | null }> {
  const changed: Record<string, { was: string | null; now: string | null }> = {};
  for (const key of Object.keys(extracted) as (keyof CandidateFields)[]) {
    if (extracted[key] !== current[key]) {
      changed[key] = { was: extracted[key], now: current[key] };
    }
  }
  return changed;
}

/**
 * Everything needed to analyse a field test, minus the image bytes — those stay
 * on the phone so the file remains small enough to share from a messenger.
 */
export async function buildExport() {
  const db = await getDb();

  const [photos, runs, candidates, events, venues, series, homes] = await Promise.all([
    db.getAll("photos"),
    db.getAll("ocrRuns"),
    db.getAll("candidates"),
    db.getAll("events"),
    db.getAll("venues"),
    db.getAll("series"),
    db.getAll("homeLocations"),
  ]);

  const storage = await storageEstimate();

  return {
    exportedAt: new Date().toISOString(),
    app: "out-tonight",
    device: {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      storageUsedMb: storage.usedMb,
      storageQuotaMb: storage.quotaMb,
    },
    summary: {
      photos: photos.length,
      candidates: candidates.length,
      confirmed: candidates.filter((c) => c.status === "confirmed").length,
      discarded: candidates.filter((c) => c.status === "discarded").length,
      pending: candidates.filter((c) => c.status === "pending").length,
      corrected: candidates.filter(
        (c) => Object.keys(diffFields(c.extracted, c.current)).length > 0
      ).length,
      events: events.length,
      going: events.filter((e) => e.status === "going").length,
    },
    photos: photos.map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      createdAt: p.createdAt,
    })),
    ocrRuns: runs.map((r) => ({
      id: r.id,
      photoId: r.photoId,
      winner: r.winner,
      totalMs: r.totalMs,
      backend: r.backend,
      model: r.model,
      lineCount: r.lines.length,
      // Every variant, not just the winner — otherwise there is no way to tell
      // whether the selection rule is choosing well.
      variants: r.variants,
      text: r.text,
    })),
    candidates: candidates.map((c) => ({
      id: c.id,
      photoId: c.photoId,
      runId: c.runId,
      status: c.status,
      yearPrinted: c.yearPrinted,
      weekdayMatches: c.weekdayMatches,
      needsReview: c.needsReview,
      extracted: c.extracted,
      current: c.current,
      corrections: diffFields(c.extracted, c.current),
      correctedAt: c.correctedAt,
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      source: e.source,
      startTime: e.startTime,
      venueName: e.venueName,
      status: e.status,
      inRange: e.inRange,
      photoId: e.photoId,
    })),
    venues: venues.map((v) => ({
      id: v.id,
      name: v.name,
      source: v.source,
      favorited: v.favorited,
      hasCoords: v.lat !== null,
    })),
    series,
    homeLocations: homes,
  };
}

export async function downloadExport(): Promise<void> {
  const data = await buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `out-tonight-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
