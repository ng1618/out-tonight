"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton() {
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  async function handleEnable() {
    setMessage(null);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Notifications permission denied");
      return;
    }

    const keyRes = await fetch("/api/push/vapid-public-key");
    if (!keyRes.ok) {
      setMessage("Push isn't configured on the server yet");
      return;
    }
    const { key } = await keyRes.json();

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    setSubscribed(true);
  }

  if (!supported) {
    return <p className="text-sm text-zinc-500">Push notifications aren&apos;t supported here.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleEnable}
        disabled={subscribed}
        className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {subscribed ? "Notifications enabled" : "Enable reminders for events I'm going to"}
      </button>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
