"use client";
/**
 * Web Push subscription for this browser (SL-5). Turning push on asks for notification
 * permission, registers `/push-sw.js` (scope `/push/`, so it never controls pages), subscribes
 * with the server's VAPID public key and saves the subscription; turning it off unsubscribes and
 * forgets it on the server.
 */
import { withBasePath } from "~/lib/base-path";

const SW_PATH = "/push-sw.js";
const SW_SCOPE = "/push/";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export interface SavedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/** Subscribes this browser; resolves null when permission is refused or push is unsupported. */
export async function subscribeToPush(vapidPublicKey: string): Promise<SavedSubscription | null> {
  if (!pushSupported()) return null;
  if ((await Notification.requestPermission()) !== "granted") return null;
  const registration = await navigator.serviceWorker.register(withBasePath(SW_PATH), {
    scope: withBasePath(SW_SCOPE),
  });
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(vapidPublicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

/** Unsubscribes this browser; resolves the endpoint it had, if any. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(withBasePath(SW_SCOPE));
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => false);
  return endpoint;
}
