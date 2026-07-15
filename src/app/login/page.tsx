"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError("Wrong password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="text-center text-lg font-semibold">Out Tonight</h1>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          Enter
        </button>
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </form>
    </main>
  );
}
