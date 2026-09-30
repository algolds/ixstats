import { createHash } from "crypto";
import { safeEqual } from "./safe-equal";

export { safeEqual };

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

export interface WebhookRateLimitScope {
  identifier: string;
  limits: { maxRequests: number; windowMs: number };
}

/** MediaWiki saves in bursts (imports, bot runs), so a caller holding the secret gets a high ceiling. */
export const WEBHOOK_AUTHENTICATED_LIMITS = { maxRequests: 600, windowMs: 60_000 } as const;

/** Callers without the secret only ever earn a 401/503, so they get a strict ceiling. */
export const WEBHOOK_UNAUTHENTICATED_LIMITS = { maxRequests: 10, windowMs: 60_000 } as const;

/**
 * Which rate-limit bucket a webhook request counts against. A caller that presented the valid
 * secret counts against a per-secret bucket (a hash, so the secret never reaches Redis keys or logs),
 * not against the shared `ip:`/`anonymous` bucket that MediaWiki's proxy-less loopback requests would
 * all land in. Everyone else counts against `fallbackIdentifier` (see resolveRateLimitIdentifier).
 */
export function webhookRateLimitScope(
  authFailure: WebhookAuthFailure | null,
  secret: string | undefined,
  fallbackIdentifier: string
): WebhookRateLimitScope {
  if (authFailure || !secret) {
    return { identifier: fallbackIdentifier, limits: WEBHOOK_UNAUTHENTICATED_LIMITS };
  }
  const digest = createHash("sha256").update(secret).digest("hex").slice(0, 16);
  return { identifier: `secret:${digest}`, limits: WEBHOOK_AUTHENTICATED_LIMITS };
}
