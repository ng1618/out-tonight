import { NextRequest, NextResponse } from "next/server";
import { saveCandidates, listCandidates } from "@/lib/candidates";
import { extractEventsFromImage, isSupportedMediaType } from "@/lib/extract";
import { storePhoto } from "@/lib/rawSources";

// Vision extraction on a dense listing page takes a while.
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(listCandidates());
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'photo' file field" }, { status: 400 });
  }

  const mimeType = file.type;
  if (!isSupportedMediaType(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported image type '${mimeType || "unknown"}'` },
      { status: 415 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storePhoto(bytes, mimeType);

  // Already-seen bytes: return the existing candidates instead of paying for
  // a second extraction of the same photo.
  if (stored.status === "duplicate") {
    return NextResponse.json({
      status: "duplicate",
      rawSourceId: stored.id,
      candidates: listCandidates(stored.id),
    });
  }

  let outcome;
  try {
    outcome = await extractEventsFromImage(bytes.toString("base64"), mimeType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    // The raw source is kept regardless — it can be re-processed later.
    return NextResponse.json(
      { error: message, rawSourceId: stored.id, status: "extraction_failed" },
      { status: 502 }
    );
  }

  if (outcome.status === "refused") {
    return NextResponse.json(
      { status: "refused", category: outcome.category, rawSourceId: stored.id },
      { status: 422 }
    );
  }
  if (outcome.status === "unparsed") {
    return NextResponse.json(
      { status: "unparsed", rawSourceId: stored.id },
      { status: 502 }
    );
  }

  saveCandidates(stored.id, outcome.result.candidates);

  return NextResponse.json({
    status: "extracted",
    rawSourceId: stored.id,
    imageKind: outcome.result.imageKind,
    candidates: listCandidates(stored.id),
  });
}
