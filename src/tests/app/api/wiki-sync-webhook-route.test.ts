/** @jest-environment node */
/**
 * The wiki sync webhooks (POST /api/wiki/sync-webhook, /api/wikios/inbound-sync). Each fails closed without a
 * configured secret, takes the secret as a header or a Bearer token compared in constant time, and refuses anything
 * else, including the old hard-coded fallback token. A caller with the valid secret gets a per-secret bucket with a
 * high ceiling (its identifier never carries the secret); everyone else is counted on a strict per-client bucket keyed
 * off the trusted IP, and answered 429 once it is spent. Roadmap M0 item 18 (PL-20): API routes never compare a token
 * with === / !==.
 *
 * Folds wiki-webhook-auth and safe-equal.
 */
import { randomBytes } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";

jest.mock("~/env", () => ({ env: {} }));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  syncSinglePage: jest.fn().mockResolvedValue(true),
  runAutoSyncCycle: jest.fn().mockResolvedValue({ pagesChecked: 0 }),
}));
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: jest.fn() },
}));

import { POST } from "~/app/api/wiki/sync-webhook/route";
import { GET as inboundGet, POST as inboundPost } from "~/app/api/wikios/inbound-sync/route";
import { runAutoSyncCycle, syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { bearerMatches, safeEqual } from "~/lib/security/safe-equal";
import {
  WEBHOOK_AUTHENTICATED_LIMITS,
  WEBHOOK_UNAUTHENTICATED_LIMITS,
  webhookRateLimitScope,
} from "~/lib/security/wiki-webhook-auth";
import { env } from "~/env";

const SECRET = randomBytes(24).toString("hex");
const STRICT = { maxRequests: 10, windowMs: 60_000 };
const ok = { success: true, remaining: 10, resetAt: new Date() };
const exhausted = { success: false, remaining: 0, resetAt: new Date() };
const setSecret = (value: string | undefined) =>
  Object.assign(env, { WIKI_SYNC_WEBHOOK_SECRET: value });

const request = (url: string, headers: Record<string, string>, body?: object) =>
  new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
const WEBHOOK = "http://localhost:3000/api/wiki/sync-webhook";
const INBOUND = "http://localhost:3000/api/wikios/inbound-sync";
const webhook = (headers: Record<string, string>, body: object = { title: "Main_Page" }) =>
  POST(request(WEBHOOK, headers, body));

beforeEach(() => {
  jest.clearAllMocks();
  setSecret(SECRET);
  jest.mocked(rateLimiter.check).mockResolvedValue(ok);
});

describe.each([
  {
    route: "POST /api/wiki/sync-webhook",
    namespace: "wiki-sync-webhook",
    call: (headers: Record<string, string>) => webhook(headers),
    work: () => jest.mocked(syncSinglePage),
  },
  {
    route: "POST /api/wikios/inbound-sync",
    namespace: "wikios-inbound-sync",
    call: (headers: Record<string, string>) =>
      inboundPost(request(INBOUND, headers, { realm: "ixwiki" })),
    work: () => jest.mocked(runAutoSyncCycle),
  },
])("$route", ({ namespace, call, work }) => {
  it("counts a request without the secret on the strict bucket of the trusted IP, then answers 401", async () => {
    const res = await call({ "cf-connecting-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" });
    expect(res.status).toBe(401);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:2.2.2.2", namespace, STRICT);
    expect(work()).not.toHaveBeenCalled();
  });

  it.each([
    ["of the same length", "x".repeat(SECRET.length)],
    ["of a different length", "short"],
  ])(
    "refuses a wrong secret %s on the client's strict bucket, not a secret bucket",
    async (_case, wrong) => {
      const res = await call({ "x-wiki-webhook-secret": wrong, "x-real-ip": "4.4.4.4" });
      expect(res.status).toBe(401);
      expect(rateLimiter.check).toHaveBeenCalledWith("ip:4.4.4.4", namespace, STRICT);
      expect(work()).not.toHaveBeenCalled();
    }
  );

  it("fails closed when no secret is configured, still on the strict bucket", async () => {
    setSecret(undefined);
    const res = await call({ "x-wiki-webhook-secret": SECRET, "cf-connecting-ip": "5.5.5.5" });
    expect(res.status).toBe(503);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:5.5.5.5", namespace, STRICT);
    expect(work()).not.toHaveBeenCalled();
  });

  it.each([
    ["the header", { "x-wiki-webhook-secret": SECRET }],
    ["a Bearer token", { Authorization: `Bearer ${SECRET}` }],
  ])(
    "runs with the secret as %s, on a per-secret bucket of 600 that never carries the secret",
    async (_form, headers) => {
      const res = await call(headers);
      expect(res.status).toBe(200);
      expect(work()).toHaveBeenCalledTimes(1);
      const [identifier, used, limits] = jest.mocked(rateLimiter.check).mock.calls[0]!;
      expect(identifier).toMatch(/^secret:[0-9a-f]{16}$/);
      expect(identifier).not.toContain(SECRET);
      expect([used, limits]).toEqual([namespace, { maxRequests: 600, windowMs: 60_000 }]);
    }
  );

  it.each([
    ["the per-secret bucket", { "x-wiki-webhook-secret": SECRET }],
    ["the strict bucket, instead of 401", { "cf-connecting-ip": "2.2.2.2" }],
  ])("answers 429 and does no work once %s is spent", async (_bucket, headers) => {
    jest.mocked(rateLimiter.check).mockResolvedValue(exhausted);
    expect((await call(headers)).status).toBe(429);
    expect(work()).not.toHaveBeenCalled();
  });
});

describe("POST /api/wiki/sync-webhook", () => {
  it("rejects a title longer than 255 characters", async () => {
    const res = await webhook({ "x-wiki-webhook-secret": SECRET }, { title: "a".repeat(300) });
    expect(res.status).toBe(400);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("does not echo internal error messages", async () => {
    jest.mocked(syncSinglePage).mockRejectedValueOnce(new Error("db password is hunter2"));
    const res = await webhook({ "x-wiki-webhook-secret": SECRET });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Sync failed" });
  });
});

describe("/api/wikios/inbound-sync", () => {
  it("rejects the old hard-coded fallback token", async () => {
    const res = await inboundPost(
      request(INBOUND, { Authorization: "Bearer dev-bot-secret-key-12345" }, { realm: "ixwiki" })
    );
    expect(res.status).toBe(401);
  });

  it("polls on a GET only with the secret, and then runs the shared recent-changes cycle", async () => {
    expect((await inboundGet(request(INBOUND, {}))).status).toBe(401);
    expect(runAutoSyncCycle).not.toHaveBeenCalled();
    expect((await inboundGet(request(INBOUND, { Authorization: `Bearer ${SECRET}` }))).status).toBe(
      200
    );
    expect(runAutoSyncCycle).toHaveBeenCalledWith(25);
    await inboundPost(request(INBOUND, { "x-wiki-webhook-secret": SECRET }, { realm: "ixwiki" }));
    expect(runAutoSyncCycle).toHaveBeenLastCalledWith(50);
  });

  it("never puts the secret in the bucket key", async () => {
    await inboundPost(request(INBOUND, { "x-wiki-webhook-secret": SECRET }, {}));
    const [identifier] = jest.mocked(rateLimiter.check).mock.calls[0] ?? [];
    expect(identifier).toBeDefined();
    expect(identifier).not.toContain(SECRET);
  });

  it("uses the same bucket wherever the request claims to come from", async () => {
    await inboundPost(
      request(INBOUND, { "x-wiki-webhook-secret": SECRET, "x-forwarded-for": "1.1.1.1" }, {})
    );
    await inboundGet(
      request(INBOUND, {
        Authorization: `Bearer ${SECRET}`,
        "cf-connecting-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      })
    );
    const [first, second] = jest.mocked(rateLimiter.check).mock.calls.map(([id]) => id);
    expect(first).toBeDefined();
    expect(first).toBe(second);
  });

  it("counts a wrong secret against the strict bucket of the client, not a secret bucket", async () => {
    const res = await inboundPost(
      request(
        INBOUND,
        { "x-wiki-webhook-secret": "x".repeat(SECRET.length), "x-real-ip": "4.4.4.4" },
        {}
      )
    );
    expect(res.status).toBe(401);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:4.4.4.4", "wikios-inbound-sync", STRICT);
  });

  it("uses the strict per-client bucket when no secret is configured", async () => {
    setSecret(undefined);
    const res = await inboundGet(
      request(INBOUND, { "x-wiki-webhook-secret": SECRET, "cf-connecting-ip": "5.5.5.5" })
    );
    expect(res.status).toBe(503);
    expect(rateLimiter.check).toHaveBeenCalledWith("ip:5.5.5.5", "wikios-inbound-sync", STRICT);
  });

  it("keeps its own rate-limit namespace, apart from the page-sync webhook's", async () => {
    await inboundPost(request(INBOUND, { "x-wiki-webhook-secret": SECRET }, {}));
    await webhook({ "x-wiki-webhook-secret": SECRET });
    expect(jest.mocked(rateLimiter.check).mock.calls.map(([, ns]) => ns)).toEqual([
      "wikios-inbound-sync",
      "wiki-sync-webhook",
    ]);
  });
});

describe("the secret and its bucket", () => {
  it("is one bucket per secret, whoever calls, with a strict ceiling far below the authenticated one", () => {
    const a1 = webhookRateLimitScope(null, SECRET, "ip:1.1.1.1");
    expect(webhookRateLimitScope(null, SECRET, "anonymous").identifier).toBe(a1.identifier);
    expect(webhookRateLimitScope(null, "b".repeat(40), "ip:1.1.1.1").identifier).not.toBe(
      a1.identifier
    );
    expect(WEBHOOK_UNAUTHENTICATED_LIMITS.maxRequests).toBeLessThan(
      WEBHOOK_AUTHENTICATED_LIMITS.maxRequests / 10
    );
  });

  it("is compared in constant time: only an identical string, and only exactly `Bearer <secret>`", () => {
    expect([safeEqual("s3cret", "s3cret"), safeEqual("s3cret", "s3creT")]).toEqual([true, false]);
    expect([safeEqual("s3cret", "s3cret-longer"), safeEqual("", "s3cret")]).toEqual([false, false]);
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    for (const header of ["Bearer wrong", "s3cret", null, undefined]) {
      expect([header, bearerMatches(header, "s3cret")]).toEqual([header, false]);
    }
  });

  it("is never compared with === / !== in an API route (bearer tokens, API keys, cron secrets)", () => {
    const sourceFiles = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) ? [path] : [];
      });
    const offenders = sourceFiles(join(process.cwd(), "src/app/api")).filter((file) => {
      const src = readFileSync(file, "utf8");
      return (
        /[!=]==\s*`Bearer \$\{/.test(src) ||
        /[!=]==\s*(CRON_SECRET|expectedApiKey|botSecret|cronSecret)\b/.test(src) ||
        /\b(token|apiKey|apiKeyHeader(\.trim\(\))?)\s*[!=]==\s*(CRON_SECRET|expectedApiKey)\b/.test(
          src
        )
      );
    });
    expect(offenders).toEqual([]);
  });
});
