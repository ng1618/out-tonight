import sharp from "sharp";

export type Variant = {
  label: string;
  rotation: number;
  enhanced: boolean;
  bytes: Buffer;
};

/**
 * Photographed pages arrive at any orientation, and phone shots of glossy
 * paper are often low-contrast. Rather than trying to *detect* either problem,
 * produce every plausible variant and let OCR confidence decide — measured on
 * real photos, that picks correctly where orientation detection would need a
 * Hough transform, and it rescues images that return nothing at 0°.
 */
export async function buildVariants(input: Buffer): Promise<Variant[]> {
  const variants: Variant[] = [];

  for (const rotation of [0, 90, 180, 270]) {
    const rotated = sharp(input).rotate(rotation);

    variants.push({
      label: `${rotation}°`,
      rotation,
      enhanced: false,
      bytes: await rotated.clone().jpeg({ quality: 92 }).toBuffer(),
    });

    variants.push({
      label: `${rotation}° enhanced`,
      rotation,
      enhanced: true,
      bytes: await rotated
        .clone()
        .grayscale()
        .normalise()
        .sharpen()
        .jpeg({ quality: 92 })
        .toBuffer(),
    });
  }

  return variants;
}

/**
 * Text volume weighted by confidence. Line count alone rewards a variant that
 * finds many junk fragments; confidence alone rewards one that finds two words
 * perfectly. The product tracked the correct choice on every test image.
 */
export function variantScore(charCount: number, confidence: number): number {
  return charCount * confidence;
}
