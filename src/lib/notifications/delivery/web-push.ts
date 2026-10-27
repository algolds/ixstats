/**
 * Web Push sender (SL-5) built on node:crypto, with no dependency:
 *
 * - VAPID authentication (RFC 8292): an ES256 JWT for the push service's origin, sent as
 *   `Authorization: vapid t=<jwt>, k=<public key>`.
 * - Payload encryption (RFC 8291, `aes128gcm` from RFC 8188): an ephemeral ECDH key, the
 *   subscription's `p256dh` and `auth` secret, HKDF-SHA-256 and AES-128-GCM, as one record.
 *
 * Subscriptions are only accepted for known push services (`isAllowedPushEndpoint`), so the
 * server never POSTs to an address a user made up.
 */
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";
import type { PushConfig } from "./config";
import type { FetchLike } from "./email";

const RECORD_SIZE = 4096;
/** Push services browsers use (Chrome/Edge/Opera, Firefox, Safari, legacy Edge). */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
}

const fromB64u = (text: string) => Buffer.from(text, "base64url");

/** True for an https endpoint on a known push service. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** HKDF-Expand for a single block (every length here is at most 32 bytes). */
function expand(prk: Buffer, info: Buffer, length: number): Buffer {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/** Left-pads a big-endian scalar to `length` bytes (ECDH may drop leading zero bytes). */
function pad(buffer: Buffer, length: number): Buffer {
  return buffer.length >= length
    ? buffer
    : Buffer.concat([Buffer.alloc(length - buffer.length), buffer]);
}

/**
 * Encrypts `payload` for one subscription (RFC 8291). `salt` and `senderPrivateKey` are for
 * tests (RFC 8291 Appendix A); real sends use fresh random values.
 */
export function encryptPushPayload(
  payload: Buffer,
  keys: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  testing: { salt?: Buffer; senderPrivateKey?: Buffer } = {}
): Buffer {
  const receiverPublic = fromB64u(keys.p256dh);
  const authSecret = fromB64u(keys.auth);
  const ecdh = createECDH("prime256v1");
  if (testing.senderPrivateKey) ecdh.setPrivateKey(testing.senderPrivateKey);
  else ecdh.generateKeys();
  const senderPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(receiverPublic);
  const salt = testing.salt ?? randomBytes(16);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "latin1"),
    receiverPublic,
    senderPublic,
  ]);
  const ikm = expand(hmac(authSecret, sharedSecret), keyInfo, 32);
  const prk = hmac(salt, ikm);
  const cek = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "latin1"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0", "latin1"), 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // A single record: the payload, then the 0x02 "last record" delimiter.
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(senderPublic.length, 20);
  return Buffer.concat([header, senderPublic, encrypted]);
}

/** `Authorization` header value for a push to `endpoint` (RFC 8292). */
export function vapidAuthorization(
  endpoint: string,
  config: PushConfig,
  now: Date = new Date()
): string {
  const publicKey = fromB64u(config.publicKey);
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: pad(fromB64u(config.privateKey), 32).toString("base64url"),
      x: publicKey.subarray(1, 33).toString("base64url"),
      y: publicKey.subarray(33, 65).toString("base64url"),
    },
    format: "jwk",
  });
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${signature.toString("base64url")}, k=${config.publicKey}`;
}

export interface PushResult {
  ok: boolean;
  /** The push service says the subscription no longer exists; delete it. */
  gone: boolean;
  status: number;
}

/** Sends one push. Never throws: an unreachable service is `{ ok: false, gone: false }`. */
export async function sendWebPush(
  config: PushConfig,
  subscription: PushSubscriptionKeys,
  message: PushMessage,
  options: { urgency?: "very-low" | "low" | "normal" | "high"; fetchImpl?: FetchLike } = {}
): Promise<PushResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) return { ok: false, gone: true, status: 0 };
  try {
    const body = encryptPushPayload(Buffer.from(JSON.stringify(message)), subscription);
    const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    const res = await fetchImpl(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(subscription.endpoint, config),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(24 * 60 * 60),
        Urgency: options.urgency ?? "normal",
      },
      body: new Uint8Array(body),
    });
    return { ok: res.ok, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch (error) {
    console.warn("[NotificationPush] Push service unreachable:", error);
    return { ok: false, gone: false, status: 0 };
  }
}
