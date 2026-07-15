"use client";

import { useCallback, useEffect, useState } from "react";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import type { HomeLocationRow } from "@/lib/types";

export default function SettingsPage() {
  const [homes, setHomes] = useState<HomeLocationRow[]>([]);
  const [label, setLabel] = useState("");
  const [place, setPlace] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/home-locations");
    setHomes(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/home-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, place, radiusKm }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setLabel("");
    setPlace("");
    load();
  }

  async function updateRadius(id: number, value: number) {
    await fetch(`/api/home-locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radiusKm: value }),
    });
    load();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/home-locations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Home locations</h1>
      <p className="text-sm text-zinc-500">
        Events within a location&apos;s radius show up in the feed. Straight-line
        distance, as a stand-in for drive time.
      </p>

      <div className="flex flex-col gap-2">
        {homes.map((home) => (
          <div
            key={home.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="min-w-0">
              <p className="font-medium">{home.label}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="number"
                  defaultValue={home.radius_km}
                  onBlur={(e) => updateRadius(home.id, Number(e.target.value))}
                  className="w-16 rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-800 dark:bg-zinc-900"
                />
                km radius
              </div>
            </div>
            <button
              onClick={() => handleDelete(home.id)}
              className="flex-shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          required
          placeholder="Label, e.g. Darmstadt"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          required
          placeholder="Place to geocode, e.g. Darmstadt, Germany"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
          <span className="text-sm text-zinc-500">km radius</span>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          Add location
        </button>
      </form>

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <h2 className="text-lg font-semibold">Notifications</h2>
      <PushSubscribeButton />
    </div>
  );
}
