"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CropRect } from "@/lib/client/schema";

type Handle = "nw" | "ne" | "sw" | "se" | "move";

/**
 * Drag the edges to keep only the poster. Cropping before OCR removes the
 * neighbouring magazine columns entirely, which is a far more reliable fix for
 * interleaved text than trying to untangle it from bounding boxes afterwards.
 *
 * The rect is held in displayed-pixel space and converted to original-image
 * pixels on apply, so it stays correct however the image is scaled to fit.
 */
export default function CropBox({
  blob,
  onApply,
  onSkip,
  busy,
}: {
  blob: Blob;
  onApply: (rect: CropRect) => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [display, setDisplay] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const dragging = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    setDisplay({ w, h });
    // Start with a generous inset rather than the whole frame, so it's obvious
    // the edges are meant to be dragged.
    setRect((current) =>
      current ?? { x: w * 0.06, y: h * 0.06, width: w * 0.88, height: h * 0.88 }
    );
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function pointerDown(e: React.PointerEvent, handle: Handle) {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...rect } };
  }

  function pointerMove(e: React.PointerEvent) {
    const drag = dragging.current;
    if (!drag || !display) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const min = 40;
    const s = drag.start;
    let next: CropRect;

    switch (drag.handle) {
      case "move":
        next = {
          ...s,
          x: Math.min(Math.max(0, s.x + dx), display.w - s.width),
          y: Math.min(Math.max(0, s.y + dy), display.h - s.height),
        };
        break;
      case "nw": {
        const x = Math.min(Math.max(0, s.x + dx), s.x + s.width - min);
        const y = Math.min(Math.max(0, s.y + dy), s.y + s.height - min);
        next = { x, y, width: s.x + s.width - x, height: s.y + s.height - y };
        break;
      }
      case "ne": {
        const y = Math.min(Math.max(0, s.y + dy), s.y + s.height - min);
        const right = Math.max(Math.min(display.w, s.x + s.width + dx), s.x + min);
        next = { x: s.x, y, width: right - s.x, height: s.y + s.height - y };
        break;
      }
      case "sw": {
        const x = Math.min(Math.max(0, s.x + dx), s.x + s.width - min);
        const bottom = Math.max(Math.min(display.h, s.y + s.height + dy), s.y + min);
        next = { x, y: s.y, width: s.x + s.width - x, height: bottom - s.y };
        break;
      }
      default: {
        const right = Math.max(Math.min(display.w, s.x + s.width + dx), s.x + min);
        const bottom = Math.max(Math.min(display.h, s.y + s.height + dy), s.y + min);
        next = { x: s.x, y: s.y, width: right - s.x, height: bottom - s.y };
      }
    }

    setRect(next);
  }

  function pointerUp() {
    dragging.current = null;
  }

  function apply() {
    if (!rect || !display || !natural) return;
    const scaleX = natural.w / display.w;
    const scaleY = natural.h / display.h;
    onApply({
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      width: Math.round(rect.width * scaleX),
      height: Math.round(rect.height * scaleY),
    });
  }

  if (!url) return null;

  const handleClass =
    "absolute h-9 w-9 rounded-full border-2 border-white bg-zinc-950 shadow-lg touch-none";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Drag the corners so only the poster is inside the box. Everything outside
        is ignored, which keeps neighbouring columns out of the reading.
      </p>

      <div
        className="relative touch-none select-none overflow-hidden rounded-lg bg-zinc-900"
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt="Photo to crop"
          className="block w-full"
          onLoad={(e) => {
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            });
            measure();
          }}
        />

        {rect && display && (
          <>
            {/* Dim everything outside the selection. */}
            <div
              className="pointer-events-none absolute inset-0 bg-black/55"
              style={{
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                  ${rect.x}px ${rect.y}px,
                  ${rect.x}px ${rect.y + rect.height}px,
                  ${rect.x + rect.width}px ${rect.y + rect.height}px,
                  ${rect.x + rect.width}px ${rect.y}px,
                  ${rect.x}px ${rect.y}px)`,
              }}
            />
            <div
              className="absolute cursor-move border-2 border-white touch-none"
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              onPointerDown={(e) => pointerDown(e, "move")}
            />
            <div className={handleClass} style={{ left: rect.x - 18, top: rect.y - 18 }} onPointerDown={(e) => pointerDown(e, "nw")} />
            <div className={handleClass} style={{ left: rect.x + rect.width - 18, top: rect.y - 18 }} onPointerDown={(e) => pointerDown(e, "ne")} />
            <div className={handleClass} style={{ left: rect.x - 18, top: rect.y + rect.height - 18 }} onPointerDown={(e) => pointerDown(e, "sw")} />
            <div className={handleClass} style={{ left: rect.x + rect.width - 18, top: rect.y + rect.height - 18 }} onPointerDown={(e) => pointerDown(e, "se")} />
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={apply}
          disabled={busy || !rect}
          className="flex-1 rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {busy ? "Reading…" : "Read this area"}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Whole photo
        </button>
      </div>
    </div>
  );
}
