import {
  WEBHOOK_AUTHENTICATED_LIMITS,
  WEBHOOK_UNAUTHENTICATED_LIMITS,
  webhookRateLimitScope,
  wikiWebhookAuthFailure,
} from "~/lib/security/wiki-webhook-auth";

const SECRET = "a".repeat(40);

describe("wikiWebhookAuthFailure", () => {
  it("fails closed without a configured secret", () => {
    expect(wikiWebhookAuthFailure(new Headers(), undefined)).toEqual({
      status: 503,
      error: "Webhook not configured",
    });
  });

  it("accepts the header and the Bearer form", () => {
    expect(
      wikiWebhookAuthFailure(new Headers({ "x-wiki-webhook-secret": SECRET }), SECRET)
    ).toBeNull();
    expect(
      wikiWebhookAuthFailure(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET)
    ).toBeNull();
  });

  it("rejects a missing or wrong secret", () => {
    expect(wikiWebhookAuthFailure(new Headers(), SECRET)?.status).toBe(401);
    expect(
      wikiWebhookAuthFailure(new Headers({ "x-wiki-webhook-secret": "b" }), SECRET)?.status
    ).toBe(401);
  });
});

describe("webhookRateLimitScope", () => {
  it("gives a caller with the valid secret a per-secret bucket with the high ceiling", () => {
    const scope = webhookRateLimitScope(null, SECRET, "ip:1.2.3.4");
    expect(scope.identifier).toMatch(/^secret:[0-9a-f]{16}$/);
    expect(scope.limits).toEqual(WEBHOOK_AUTHENTICATED_LIMITS);
    expect(WEBHOOK_AUTHENTICATED_LIMITS.maxRequests).toBe(600);
  });

  it("is stable for one secret, different for another, and independent of the caller identity", () => {
    const a1 = webhookRateLimitScope(null, SECRET, "ip:1.1.1.1");
    const a2 = webhookRateLimitScope(null, SECRET, "anonymous");
    const b = webhookRateLimitScope(null, "b".repeat(40), "ip:1.1.1.1");
    expect(a1.identifier).toBe(a2.identifier);
    expect(a1.identifier).not.toBe(b.identifier);
  });

  it("does not leak the secret into the identifier", () => {
    expect(webhookRateLimitScope(null, SECRET, "anonymous").identifier).not.toContain(SECRET);
  });

  it("keeps everyone without the valid secret on the strict per-client bucket", () => {
    const failure = { status: 401 as const, error: "Unauthorized" };
    expect(webhookRateLimitScope(failure, SECRET, "ip:1.2.3.4")).toEqual({
      identifier: "ip:1.2.3.4",
      limits: WEBHOOK_UNAUTHENTICATED_LIMITS,
    });
    const notConfigured = { status: 503 as const, error: "Webhook not configured" };
    expect(webhookRateLimitScope(notConfigured, undefined, "anonymous")).toEqual({
      identifier: "anonymous",
      limits: WEBHOOK_UNAUTHENTICATED_LIMITS,
    });
  });

  it("makes the strict ceiling much lower than the authenticated one", () => {
    expect(WEBHOOK_UNAUTHENTICATED_LIMITS.maxRequests).toBeLessThan(
      WEBHOOK_AUTHENTICATED_LIMITS.maxRequests / 10
    );
  });
});
