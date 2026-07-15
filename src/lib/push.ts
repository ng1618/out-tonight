import webpush from "web-push";
import { getDb } from "./db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:example@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = { title: string; body: string; url?: string };

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  ensureConfigured();
  const db = getDb();
  const subs = db.prepare("SELECT * FROM push_subscriptions").all() as {
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
        }
      }
    })
  );
}
