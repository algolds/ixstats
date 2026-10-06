/**
 * Email and Web Push delivery configuration (SL-5). Each channel is off unless its environment
 * variables are set; nothing is sent and the Settings switches stay hidden while it is off.
 *
 * Email (an HTTP email API that accepts Resend's JSON shape):
 * - `EMAIL_API_KEY`: bearer token for the API. Required.
 * - `EMAIL_FROM`: sender, e.g. `IxStats <notifications@example.com>`. Required.
 * - `EMAIL_API_URL`: endpoint; defaults to `https://api.resend.com/emails`.
 *
 * Web Push (VAPID, RFC 8292):
 * - `VAPID_PUBLIC_KEY`: uncompressed P-256 public key, base64url (65 bytes). Required.
 * - `VAPID_PRIVATE_KEY`: the matching private scalar, base64url (32 bytes). Required.
 * - `VAPID_SUBJECT`: contact for push services, `mailto:` or `https:`. Required.
 *
 * Links in emails are made absolute with `APP_URL` (else `NEXT_PUBLIC_APP_URL`).
 */

export const DEFAULT_EMAIL_API_URL = "https://api.resend.com/emails";

export interface EmailConfig {
  apiKey: string;
  from: string;
  apiUrl: string;
}

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

type Env = Record<string, string | undefined>;

const value = (env: Env, key: string) => env[key]?.trim() || null;

export function emailConfig(env: Env = process.env): EmailConfig | null {
  const apiKey = value(env, "EMAIL_API_KEY");
  const from = value(env, "EMAIL_FROM");
  if (!apiKey || !from) return null;
  return { apiKey, from, apiUrl: value(env, "EMAIL_API_URL") ?? DEFAULT_EMAIL_API_URL };
}

export function pushConfig(env: Env = process.env): PushConfig | null {
  const publicKey = value(env, "VAPID_PUBLIC_KEY");
  const privateKey = value(env, "VAPID_PRIVATE_KEY");
  const subject = value(env, "VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

/** The site origin (and base path) for absolute links, or null when unknown. */
export function appBaseUrl(env: Env = process.env): string | null {
  const url = value(env, "APP_URL") ?? value(env, "NEXT_PUBLIC_APP_URL");
  return url ? url.replace(/\/+$/, "") : null;
}

/** What the Settings page may offer: a channel's switch is shown only when it is configured. */
export function deliveryChannels(env: Env = process.env) {
  const push = pushConfig(env);
  return {
    email: emailConfig(env) !== null,
    push: push !== null,
    vapidPublicKey: push?.publicKey ?? null,
  };
}
