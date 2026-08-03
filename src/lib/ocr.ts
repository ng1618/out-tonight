import { PaddleOcrService } from "ppu-paddle-ocr";
import { buildVariants, variantScore } from "./preprocess";

export type OcrBox = { x: number; y: number; width: number; height: number };

export type OcrLine = {
  text: string;
  box: OcrBox;
  confidence: number;
};

export type OcrResult = {
  lines: OcrLine[];
  text: string;
  confidence: number;
  /** Which preprocessing variant won, e.g. "90° enhanced". Useful when debugging a bad read. */
  variant: string;
};

type RawItem = { text: string; box: OcrBox; confidence: number };
type RawResult = { text?: string; lines?: RawItem[][]; confidence?: number };

declare global {
  var __ocr: PaddleOcrService | undefined;
}

/** Model load is expensive, so the service is created once per process. */
async function service(): Promise<PaddleOcrService> {
  if (!global.__ocr) {
    const svc = new PaddleOcrService();
    await svc.initialize();
    global.__ocr = svc;
  }
  return global.__ocr;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Runs OCR across every preprocessing variant and keeps the best read. Groups
 * are flattened to a single list of lines, each with the bounding box that
 * later lets us separate magazine columns by position.
 */
export async function readImage(input: Buffer): Promise<OcrResult> {
  const svc = await service();
  const variants = await buildVariants(input);

  let best: OcrResult = { lines: [], text: "", confidence: 0, variant: "none" };
  let bestScore = -1;

  for (const variant of variants) {
    let raw: RawResult;
    try {
      raw = (await svc.recognize(toArrayBuffer(variant.bytes))) as RawResult;
    } catch {
      continue;
    }

    const text = raw.text ?? "";
    const confidence = raw.confidence ?? 0;
    const score = variantScore(text.length, confidence);

    if (score > bestScore) {
      bestScore = score;
      best = {
        lines: (raw.lines ?? []).flat(),
        text,
        confidence,
        variant: variant.label,
      };
    }
  }

  return best;
}
