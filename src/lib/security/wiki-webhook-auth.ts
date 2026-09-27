import { createHash, timingSafeEqual } from "crypto";

/** Constant-time comparison. Hashing first gives equal lengths, so no length leak and no throw. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export interface WebhookAuthFailure {
  status: 401 | 503;
  error: string;
}

/**
 * Checks the shared secret MediaWiki sends to the wiki sync webhooks, as
 * `x-wiki-webhook-secret: <secret>` or `Authorization: Bearer <secret>`.
 * Returns null when authorized. Fails closed (503) when no secret is configured.
 */
export function wikiWebhookAuthFailure(
  headers: Headers,
  expected: string | undefined
): WebhookAuthFailure | null {
  if (!expected) return { status: 503, error: "Webhook not configured" };
  const bearer = /^Bearer\s+(.+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  const presented = headers.get("x-wiki-webhook-secret") ?? bearer;
  if (!presented || !safeEqual(presented, expected)) {
    return { status: 401, error: "Unauthorized" };
  }
  return null;
}
