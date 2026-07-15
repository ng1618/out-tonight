import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

declare global {
  var __db: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS home_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_km REAL NOT NULL DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      address TEXT,
      lat REAL,
      lng REAL,
      last_scraped_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      match_pattern TEXT NOT NULL,
      venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
      favorited INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      source TEXT NOT NULL,
      venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
      venue_name TEXT,
      series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
      start_time TEXT,
      image_url TEXT,
      lat REAL,
      lng REAL,
      in_range INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'interested',
      dedupe_key TEXT,
      notified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON events(dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

    CREATE TABLE IF NOT EXISTS geocode_cache (
      query TEXT PRIMARY KEY,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const homeCount = db
    .prepare("SELECT COUNT(*) AS n FROM home_locations")
    .get() as { n: number };

  if (homeCount.n === 0) {
    const insert = db.prepare(
      "INSERT INTO home_locations (label, lat, lng, radius_km) VALUES (?, ?, ?, ?)"
    );
    // Rhein-Main default anchors, ~30 min drive as a straight-line approximation.
    insert.run("Wiesbaden", 50.0782, 8.2398, 25);
    insert.run("Mainz", 49.9929, 8.2473, 25);
    insert.run("Frankfurt", 50.1109, 8.6821, 25);
  }
}

export function getDb(): Database.Database {
  if (!global.__db) {
    const db = new Database(DB_PATH);
    init(db);
    global.__db = db;
  }
  return global.__db;
}
