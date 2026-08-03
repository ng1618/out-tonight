"use client";

import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type OutTonightDB } from "./schema";

let dbPromise: Promise<IDBPDatabase<OutTonightDB>> | null = null;

/** Rhein-Main defaults, ~30 min by car approximated as straight-line radius. */
const DEFAULT_HOMES = [
  { id: 1, label: "Wiesbaden", lat: 50.0782, lng: 8.2398, radiusKm: 25 },
  { id: 2, label: "Mainz", lat: 49.9929, lng: 8.2473, radiusKm: 25 },
  { id: 3, label: "Frankfurt", lat: 50.1109, lng: 8.6821, radiusKm: 25 },
];

export function getDb(): Promise<IDBPDatabase<OutTonightDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutTonightDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const events = db.createObjectStore("events", {
          keyPath: "id",
          autoIncrement: true,
        });
        events.createIndex("byStartTime", "startTime");
        events.createIndex("byDedupeKey", "dedupeKey", { unique: true });
        events.createIndex("byPhoto", "photoId");

        const venues = db.createObjectStore("venues", {
          keyPath: "id",
          autoIncrement: true,
        });
        venues.createIndex("byName", "name", { unique: true });

        db.createObjectStore("series", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("homeLocations", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("photos", { keyPath: "id", autoIncrement: true });

        const runs = db.createObjectStore("ocrRuns", {
          keyPath: "id",
          autoIncrement: true,
        });
        runs.createIndex("byPhoto", "photoId");

        const candidates = db.createObjectStore("candidates", {
          keyPath: "id",
          autoIncrement: true,
        });
        candidates.createIndex("byPhoto", "photoId");
        candidates.createIndex("byStatus", "status");

        db.createObjectStore("geocodeCache", { keyPath: "query" });
      },
    }).then(async (db) => {
      // Seed home locations once, so the radius filter works on first launch.
      const count = await db.count("homeLocations");
      if (count === 0) {
        const tx = db.transaction("homeLocations", "readwrite");
        await Promise.all(DEFAULT_HOMES.map((h) => tx.store.put(h)));
        await tx.done;
      }
      return db;
    });
  }
  return dbPromise;
}

/** Rough on-device usage, shown before an export so growth doesn't surprise anyone. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number }> {
  if (!navigator.storage?.estimate) return { usedMb: 0, quotaMb: 0 };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return {
    usedMb: Math.round((usage / 1024 / 1024) * 10) / 10,
    quotaMb: Math.round(quota / 1024 / 1024),
  };
}
