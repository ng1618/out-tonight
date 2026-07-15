import Link from "next/link";
import { quickAddFromUrl } from "@/lib/ingest";

function extractUrl(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawUrl = typeof params.url === "string" ? params.url : undefined;
  const rawText = typeof params.text === "string" ? params.text : undefined;
  const sharedUrl = rawUrl || extractUrl(rawText);

  if (!sharedUrl) {
    return (
      <Shell>
        <p>No link found in what was shared.</p>
      </Shell>
    );
  }

  const result = await quickAddFromUrl(sharedUrl);

  return (
    <Shell>
      {result.status === "inserted" && <p>Saved: {result.title}</p>}
      {result.status === "duplicate" && <p>Already saved that one.</p>}
      {result.status === "fetch_failed" && <p>Couldn&apos;t load that link.</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
      <Link href="/" className="text-sm underline">
        Back to feed
      </Link>
    </main>
  );
}
