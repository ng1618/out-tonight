import { NextRequest, NextResponse } from "next/server";
import { saveCandidates } from "@/lib/candidates";
import { extractEventsFromImage, isSupportedMediaType } from "@/lib/extract";
import { quickAddFromUrl } from "@/lib/ingest";
import { storePhoto } from "@/lib/rawSources";

export const maxDuration = 300;

function extractUrl(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

/**
 * The Android share sheet POSTs here. A share carries either a file (photo of a
 * poster) or text/a link — Instagram in particular sends different shapes
 * depending on what was shared, so handle whichever arrives and redirect the
 * person to the right place rather than leaving them on a blank response.
 */
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.redirect(`${origin}/photos?shared=invalid`, 303);
  }

  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!isSupportedMediaType(file.type)) {
      return NextResponse.redirect(`${origin}/photos?shared=unsupported`, 303);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storePhoto(bytes, file.type);

    if (stored.status === "stored") {
      try {
        const outcome = await extractEventsFromImage(bytes.toString("base64"), file.type);
        if (outcome.status === "ok") {
          saveCandidates(stored.id, outcome.result.candidates);
        }
      } catch {
        // Raw source is already saved; it can be re-processed from /photos.
      }
    }

    return NextResponse.redirect(`${origin}/photos`, 303);
  }

  const sharedUrl =
    (formData.get("url") as string | null) ??
    extractUrl(formData.get("text") as string | null);

  if (sharedUrl) {
    await quickAddFromUrl(sharedUrl);
    return NextResponse.redirect(`${origin}/?shared=link`, 303);
  }

  return NextResponse.redirect(`${origin}/photos?shared=empty`, 303);
}
