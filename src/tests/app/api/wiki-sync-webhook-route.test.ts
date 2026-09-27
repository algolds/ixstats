/** @jest-environment node */
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

jest.mock("~/env", () => ({ env: {} }));
jest.mock("~/lib/wiki-os/services/auto-sync-service", () => ({
  syncSinglePage: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/inbound-sync", () => ({
  InboundMediaWikiSyncService: { pollRecentChanges: jest.fn().mockResolvedValue({ polled: 0 }) },
}));

import { POST } from "~/app/api/wiki/sync-webhook/route";
import {
  GET as inboundGet,
  POST as inboundPost,
} from "~/app/api/wikios/inbound-sync/route";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { InboundMediaWikiSyncService } from "~/lib/wiki-os/adapters/mediawiki/inbound-sync";
import { env } from "~/env";

const SECRET = randomBytes(24).toString("hex");
const setSecret = (value: string | undefined) =>
  Object.assign(env, { WIKI_SYNC_WEBHOOK_SECRET: value });

const request = (url: string, headers: Record<string, string>, body?: object) =>
  new NextRequest(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

const webhook = (headers: Record<string, string>, body: object = { title: "Main_Page" }) =>
  request("http://localhost:3000/api/wiki/sync-webhook", headers, body);

describe("POST /api/wiki/sync-webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSecret(SECRET);
    jest.mocked(rateLimiter.check).mockResolvedValue({
      success: true,
      remaining: 10,
      resetAt: new Date(),
    });
  });

  it("rejects a request without the secret", async () => {
    const res = await POST(webhook({}));
    expect(res.status).toBe(401);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it.each([
    ["same length", "x".repeat(SECRET.length)],
    ["different length", "short"],
  ])("rejects a wrong secret (%s)", async (_label, wrong) => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": wrong }));
    expect(res.status).toBe(401);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured", async () => {
    setSecret(undefined);
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(503);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("syncs the page with the correct secret", async () => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(200);
    expect(syncSinglePage).toHaveBeenCalledWith("Main_Page");
  });

  it("accepts the secret as a Bearer token", async () => {
    const res = await POST(webhook({ Authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    jest.mocked(rateLimiter.check).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date(),
    });
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(429);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("rejects a title longer than 255 characters", async () => {
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }, { title: "a".repeat(300) }));
    expect(res.status).toBe(400);
    expect(syncSinglePage).not.toHaveBeenCalled();
  });

  it("does not echo internal error messages", async () => {
    jest.mocked(syncSinglePage).mockRejectedValueOnce(new Error("db password is hunter2"));
    const res = await POST(webhook({ "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Sync failed" });
  });
});

describe("/api/wikios/inbound-sync", () => {
  const url = "http://localhost:3000/api/wikios/inbound-sync";

  beforeEach(() => {
    jest.clearAllMocks();
    setSecret(SECRET);
  });

  it("rejects a header-less POST", async () => {
    const res = await inboundPost(request(url, {}, { realm: "ixwiki" }));
    expect(res.status).toBe(401);
    expect(InboundMediaWikiSyncService.pollRecentChanges).not.toHaveBeenCalled();
  });

  it("rejects the old hard-coded fallback token", async () => {
    const res = await inboundPost(
      request(url, { Authorization: "Bearer dev-bot-secret-key-12345" }, { realm: "ixwiki" })
    );
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated GET without polling", async () => {
    const res = await inboundGet(request(url, {}));
    expect(res.status).toBe(401);
    expect(InboundMediaWikiSyncService.pollRecentChanges).not.toHaveBeenCalled();
  });

  it("fails closed when no secret is configured", async () => {
    setSecret(undefined);
    const res = await inboundGet(request(url, { "x-wiki-webhook-secret": SECRET }));
    expect(res.status).toBe(503);
  });

  it("polls with the correct secret", async () => {
    const res = await inboundPost(
      request(url, { "x-wiki-webhook-secret": SECRET }, { realm: "ixwiki" })
    );
    expect(res.status).toBe(200);
    expect(InboundMediaWikiSyncService.pollRecentChanges).toHaveBeenCalledWith("ixwiki", 50);
  });
});
