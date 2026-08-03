"use client";

export type Variant = {
  label: string;
  rotation: number;
  enhanced: boolean;
  blob: Blob;
};

/**
 * Canvas port of the Node/sharp preprocessing. Measured on real photos, trying
 * every orientation and letting OCR confidence pick beats detecting rotation:
 * one image went from zero readable lines to 0.99 confidence at 90°.
 */
async function toBitmap(source: Blob): Promise<ImageBitmap> {
  return createImageBitmap(source);
}

function draw(bitmap: ImageBitmap, rotation: number): OffscreenCanvas {
  const swap = rotation === 90 || rotation === 270;
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

/**
 * Grayscale, then stretch the histogram to the full range. Contrast helps
 * unevenly — it nearly doubled the text found on one photo and destroyed
 * another — so it competes as a variant rather than being applied blindly.
 */
function enhance(canvas: OffscreenCanvas): OffscreenCanvas {
  const ctx = canvas.getContext("2d")!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    data[i] = data[i + 1] = data[i + 2] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const span = max - min;
  if (span > 0 && span < 255) {
    const scale = 255 / span;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.min(255, Math.max(0, (data[i] - min) * scale));
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Cuts the chosen region out of the original. The source blob is never
 * modified — only this derived image goes to OCR, so a crop can be redone.
 */
export async function cropImage(
  source: Blob,
  rect: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const bitmap = await toBitmap(source);
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
}

export async function buildVariants(source: Blob): Promise<Variant[]> {
  const bitmap = await toBitmap(source);
  const variants: Variant[] = [];

  for (const rotation of [0, 90, 180, 270]) {
    for (const enhanced of [false, true]) {
      const canvas = draw(bitmap, rotation);
      const finished = enhanced ? enhance(canvas) : canvas;
      variants.push({
        label: `${rotation}°${enhanced ? " enhanced" : ""}`,
        rotation,
        enhanced,
        blob: await finished.convertToBlob({ type: "image/jpeg", quality: 0.92 }),
      });
    }
  }

  bitmap.close();
  return variants;
}

/**
 * Text volume weighted by confidence. Line count alone rewards a variant that
 * finds many junk fragments; confidence alone rewards one that finds two words
 * perfectly. The product picked correctly on every test image.
 */
export function variantScore(charCount: number, confidence: number): number {
  return charCount * confidence;
}

export async function imageDimensions(
  source: Blob
): Promise<{ width: number; height: number }> {
  const bitmap = await toBitmap(source);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
