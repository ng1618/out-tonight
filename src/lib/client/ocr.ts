"use client";

import { buildVariants, variantScore } from "./preprocess";
import type { OcrLineRecord, VariantLog } from "./schema";

export type OcrOutcome = {
  lines: OcrLineRecord[];
  text: string;
  confidence: number;
  winner: string;
  totalMs: number;
  backend: string;
  model: string;
  variants: VariantLog[];
};

type RawItem = { text: string; box: OcrLineRecord["box"]; confidence: number };
type RawResult = { text?: string; lines?: RawItem[][]; confidence?: number };

type Service = {
  initialize: () => Promise<void>;
  recognize: (input: ArrayBuffer) => Promise<RawResult>;
  destroy: () => Promise<void>;
};

let servicePromise: Promise<{ service: Service; backend: string }> | null = null;

/**
 * The model is a few megabytes and takes real time to compile, so it is loaded
 * once and reused for the life of the tab. WebGPU is used when the device has
 * it, falling back to WebAssembly.
 */
async function getService(): Promise<{ service: Service; backend: string }> {
  if (!servicePromise) {
    servicePromise = (async () => {
      const mod = await import("ppu-paddle-ocr/web");
      const webgpu = await mod.isWebGpuAvailable().catch(() => false);
      const service = new mod.PaddleOcrService() as unknown as Service;
      await service.initialize();
      return { service, backend: webgpu ? "webgpu" : "wasm" };
    })();
  }
  return servicePromise;
}

export async function warmUpOcr(): Promise<string> {
  return (await getService()).backend;
}

export type ProgressUpdate = {
  index: number;
  total: number;
  label: string;
  bestScore: number;
};

/**
 * Runs OCR across every preprocessing variant and keeps the best read, logging
 * all of them. Recording the losers is deliberate — without them there is no
 * way to tell whether the selection rule is choosing well in the field.
 */
export async function readImage(
  source: Blob,
  onProgress?: (update: ProgressUpdate) => void
): Promise<OcrOutcome> {
  const { service, backend } = await getService();
  const variants = await buildVariants(source);
  const startedAll = performance.now();

  const logs: VariantLog[] = [];
  let best: Omit<OcrOutcome, "totalMs" | "backend" | "variants" | "model"> = {
    lines: [],
    text: "",
    confidence: 0,
    winner: "none",
  };
  let bestScore = -1;

  for (const [index, variant] of variants.entries()) {
    onProgress?.({
      index: index + 1,
      total: variants.length,
      label: variant.label,
      bestScore: Math.max(0, bestScore),
    });

    const started = performance.now();
    let raw: RawResult = {};
    try {
      raw = await service.recognize(await variant.blob.arrayBuffer());
    } catch {
      // A variant that throws still gets logged, with zeroes.
    }
    const ms = Math.round(performance.now() - started);

    const text = raw.text ?? "";
    const confidence = raw.confidence ?? 0;
    const lines = (raw.lines ?? []).flat();
    const score = variantScore(text.length, confidence);

    logs.push({
      label: variant.label,
      rotation: variant.rotation,
      enhanced: variant.enhanced,
      chars: text.length,
      confidence,
      lines: lines.length,
      ms,
      score,
    });

    if (score > bestScore) {
      bestScore = score;
      best = { lines, text, confidence, winner: variant.label };
    }
  }

  return {
    ...best,
    totalMs: Math.round(performance.now() - startedAll),
    backend,
    model: "PP-OCRv6 tiny",
    variants: logs,
  };
}
