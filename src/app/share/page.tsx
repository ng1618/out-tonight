"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { ScrapedEvent } from "@/lib/scrape";
import { ingestEvent } from "@/lib/client/store";

function extractUrl(text: string | null): string | null {
  const match = text?.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

function ShareHandler() {
  const params = useSearchParams();
  const [status, setStatus] = useState("Saving…");

  useEffect(() => {
    const shared = params.get("url") ?? extractUrl(params.get("text"));
    if (!shared) {
      setStatus("No link found in what was shared.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/fetch-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: shared }),
        });
        const data = (await res.json()) as { events?: ScrapedEvent[] };
        const scraped = data.events?.[0];
        if (!res.ok || !scraped) {
          setStatus("Couldn't read that link.");
          return;
        }

        const result = await ingestEvent({
          title: scraped.title,
          url: scraped.url ?? shared,
          source: "quick-add",
          startTime: scraped.startTime,
          imageUrl: scraped.imageUrl,
          venueName: scraped.externalVenue ?? null,
          address: scraped.address,
          lat: scraped.lat,
          lng: scraped.lng,
        });

        setStatus(
          result.status === "duplicate" ? "Already saved." : `Saved: ${scraped.title}`
        );
      } catch {
        setStatus("Offline — try again with a connection.");
      }
    })();
  }, [params]);

  return <p className="text-sm">{status}</p>;
}

export default function SharePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Suspense fallback={<p className="text-sm">Saving…</p>}>
        <ShareHandler />
      </Suspense>
      <Link href="/" className="text-sm underline">
        Back to feed
      </Link>
    </main>
  );
}
