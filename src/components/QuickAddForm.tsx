"use client";

import { useState } from "react";

export default function QuickAddForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("loading");
    setMessage(null);

    const res = await fetch("/api/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Something went wrong");
      return;
    }

    setStatus("idle");
    setMessage(data.status === "duplicate" ? "Already saved" : `Saved: ${data.title}`);
    setUrl("");
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          required
          placeholder="Paste an event link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {status === "loading" ? "Adding…" : "Add"}
        </button>
      </div>
      {message && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      )}
    </form>
  );
}
