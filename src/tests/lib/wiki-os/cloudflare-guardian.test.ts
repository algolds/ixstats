/** @jest-environment node */
/**
 * Plan 413 (item 7): the edge-cache purge asks for the encoded canonical URLs of a page and reads
 * Cloudflare's answer.
 */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";

const mockFetch = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.CLOUDFLARE_API_TOKEN = "token";
  process.env.CLOUDFLARE_ZONE_ID = "zone";
  process.env.NEXT_PUBLIC_APP_URL = "https://ixwiki.com/";
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  global.fetch = realFetch;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
  delete process.env.NEXT_PUBLIC_APP_URL;
  jest.restoreAllMocks();
});

const answer = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe("CloudflareGuardian.purgeArticleEdgeCache", () => {
  it("purges the page's canonical, percent-encoded URLs, not the title as typed", async () => {
    mockFetch.mockReturnValue(answer(200, { success: true, errors: [] }));

    await CloudflareGuardian.purgeArticleEdgeCache("foo bar/Café", "ixwiki");

    const [url, init] = mockFetch.mock.calls[0]! as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.cloudflare.com/client/v4/zones/zone/purge_cache");
    expect(init.headers.Authorization).toBe("Bearer token");
    const body = JSON.parse(init.body) as { files: string[] };
    // one purge type per request: `files` alone, no `tags`
    expect(Object.keys(body)).toEqual(["files"]);
    expect(body.files).toEqual([
      "https://ixwiki.com/wiki/Foo_bar/Caf%C3%A9",
      "https://ixwiki.com/projects/ixstates/wiki/Foo_bar/Caf%C3%A9",
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("logs a refused purge, with Cloudflare's reason, from the status or from success: false", async () => {
    mockFetch.mockReturnValueOnce(
      answer(403, { success: false, errors: [{ message: "Invalid token" }] })
    );
    await CloudflareGuardian.purgeArticleEdgeCache("Foo");
    expect(console.warn).toHaveBeenLastCalledWith(
      expect.stringContaining("refused (HTTP 403)"),
      "Invalid token"
    );

    mockFetch.mockReturnValueOnce(answer(200, { success: false, errors: [] }));
    await CloudflareGuardian.purgeArticleEdgeCache("Foo");
    expect(console.warn).toHaveBeenLastCalledWith(
      expect.stringContaining("refused (HTTP 200)"),
      "no reason given"
    );
  });

  it("never throws: a network failure is a warning", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    await expect(CloudflareGuardian.purgeArticleEdgeCache("Foo")).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does nothing without credentials, and for a title that cannot be a page", async () => {
    await CloudflareGuardian.purgeArticleEdgeCache("");
    delete process.env.CLOUDFLARE_API_TOKEN;
    await CloudflareGuardian.purgeArticleEdgeCache("Foo");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
