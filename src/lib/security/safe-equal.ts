import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for secrets (API keys, bearer tokens, webhook secrets).
 * Hashing first gives equal lengths, so it neither leaks the length nor throws.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when `authorization` is exactly `Bearer <secret>`, compared in constant time. */
export function bearerMatches(authorization: string | null | undefined, secret: string): boolean {
  return !!authorization && safeEqual(authorization, `Bearer ${secret}`);
}
