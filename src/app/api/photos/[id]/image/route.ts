import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getRawSource, rawSourceAbsolutePath } from "@/lib/rawSources";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = getRawSource(Number(id));

  if (!source?.file_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await readFile(rawSourceAbsolutePath(source.file_path));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": source.mime_type ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 410 });
  }
}
