"use client";

import { useEffect, useRef, useState } from "react";
import type { OcrLineRecord } from "@/lib/client/schema";

/**
 * The photo with OCR boxes drawn over it. Seeing *where* text was found — and
 * where it wasn't — explains a bad read far faster than a confidence number.
 * Boxes are in the coordinate space of the winning (possibly rotated) variant,
 * so they're scaled to whatever size the image renders at.
 */
export default function PhotoWithBoxes({
  blob,
  lines,
  showBoxes = true,
}: {
  blob: Blob;
  lines: OcrLineRecord[];
  showBoxes?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  // Boxes come from the rotated variant, so fall back to the widest box extent
  // when the rendered image's own dimensions don't match that space.
  const extent = lines.reduce(
    (acc, l) => ({
      w: Math.max(acc.w, l.box.x + l.box.width),
      h: Math.max(acc.h, l.box.y + l.box.height),
    }),
    { w: 0, h: 0 }
  );

  const space = natural && extent.w <= natural.w * 1.05 ? natural : { w: extent.w, h: extent.h };

  if (!url) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt="Scanned poster"
        className="block w-full"
        onLoad={(e) =>
          setNatural({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
      />

      {showBoxes && space.w > 0 && (
        <svg
          viewBox={`0 0 ${space.w} ${space.h}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {lines.map((line, i) => (
            <rect
              key={i}
              x={line.box.x}
              y={line.box.y}
              width={line.box.width}
              height={line.box.height}
              fill="none"
              stroke={line.confidence > 0.8 ? "#10b981" : "#f59e0b"}
              strokeWidth={Math.max(1, space.w / 400)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
