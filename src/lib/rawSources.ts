import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

export type RawSourceRow = {
  id: number;
  kind: string;
  file_path: string | null;
  mime_type: string | null;
  sha256: string | null;
  source_url: string | null;
  note: string | null;
  created_at: string;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type StoreResult =
  | { status: "stored"; id: number; filePath: string }
  | { status: "duplicate"; id: number; filePath: string };

/**
 * Writes the image to disk and records it as an immutable raw source. The same
 * bytes uploaded twice reuse the first row, so re-sharing a photo doesn't
 * create a second source to review.
 */
export async function storePhoto(
  bytes: Buffer,
  mimeType: string
): Promise<StoreResult> {
  const db = getDb();
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const existing = db
    .prepare("SELECT id, file_path FROM raw_sources WHERE sha256 = ?")
    .get(sha256) as { id: number; file_path: string } | undefined;
  if (existing) {
    return { status: "duplicate", id: existing.id, filePath: existing.file_path };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${sha256.slice(0, 16)}.${EXTENSIONS[mimeType] ?? "bin"}`;
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  const result = db
    .prepare(
      "INSERT INTO raw_sources (kind, file_path, mime_type, sha256) VALUES ('photo', ?, ?, ?)"
    )
    .run(filename, mimeType, sha256);

  return { status: "stored", id: Number(result.lastInsertRowid), filePath: filename };
}

export function rawSourceAbsolutePath(filePath: string): string {
  // Guard against a stored value trying to escape the upload directory.
  return path.join(UPLOAD_DIR, path.basename(filePath));
}

export function getRawSource(id: number): RawSourceRow | undefined {
  return getDb().prepare("SELECT * FROM raw_sources WHERE id = ?").get(id) as
    | RawSourceRow
    | undefined;
}
