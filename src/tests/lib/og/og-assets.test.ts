/** @jest-environment node */
/**
 * OG image assets (`src/lib/og/og-assets.server.ts`): stored image paths become absolute URLs on
 * the site origin, and an image is fetched up front and handed to satori only when it is a type
 * satori draws. A failed, slow, oversized or unsupported image gives null (the card falls back to
 * initials or the tint) instead of failing the whole image. The URLs are user-stored and the routes
 * public, so only allow-listed hosts are fetched, never localhost or an IP, never via a redirect.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  absoluteAssetUrl,
  fetchOgImage,
  isAllowedImageUrl
} from "~/lib/og/og-assets.server";

const ORIGIN = new URL("https://ixwiki.com");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new TextEncoder().encode("GIF89a....");
const WEBP = new TextEncoder().encode("RIFF....WEBPVP8 ");
describe("absoluteAssetUrl", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });
  it("refuses empty values and non-http schemes", () => {
    expect(absoluteAssetUrl(null, ORIGIN)).toBeNull();
    expect(absoluteAssetUrl("  ", ORIGIN)).toBeNull();
    expect(absoluteAssetUrl("data:image/png;base64,AAAA", ORIGIN)).toBeNull();
    expect(absoluteAssetUrl("blob:https://x/1", ORIGIN)).toBeNull();
    expect(absoluteAssetUrl("file:///etc/passwd", ORIGIN)).toBeNull();
  });
});

describe("isAllowedImageUrl", () => {
  const APP = new URL("https://app.ixstates.test");
  const allowed = (url: string, app = APP) => isAllowedImageUrl(new URL(url), app);
  it("allows plain http only for the app's own origin (dev)", () => {
    const dev = new URL("http://dev.ixstates.test:3000");
    expect(allowed("http://dev.ixstates.test:3000/images/a.png", dev)).toBe(true);
    expect(allowed("http://ixwiki.com/images/a.png")).toBe(false);
    expect(allowed("http://upload.wikimedia.org/a.png")).toBe(false);
  });

  it("refuses other hosts, lookalikes, odd ports and credentials", () => {
    expect(allowed("https://evil.example/a.png")).toBe(false);
    expect(allowed("https://ixwiki.com.evil.example/a.png")).toBe(false);
    expect(allowed("https://sub.img.clerk.com/a.png")).toBe(false);
    expect(allowed("https://ixwiki.com:8443/a.png")).toBe(false);
    expect(allowed("https://user:pw@ixwiki.com/a.png")).toBe(false);
  });

  it("refuses localhost and IP literals even when they are the app's origin", () => {
    expect(allowed("http://localhost:3000/a.png", new URL("http://localhost:3000"))).toBe(false);
    expect(allowed("https://foo.localhost/a.png")).toBe(false);
    expect(allowed("http://127.0.0.1/a.png", new URL("http://127.0.0.1"))).toBe(false);
    expect(allowed("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(allowed("http://2130706433/a.png")).toBe(false);
    expect(allowed("http://[::1]/a.png")).toBe(false);
  });
});
describe("fetchOgImage", () => {
  const fetchMock = jest.fn<typeof fetch>();
  const realFetch = global.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const respond = (body: Uint8Array, init: ResponseInit = {}) =>
    fetchMock.mockResolvedValue(new Response(new Uint8Array(body), init));
  it("gives null for loopback, IP-literal and disallowed hosts, without fetching", async () => {
    respond(PNG);
    for (const url of [
      "http://localhost:3000/a.png",
      "http://127.0.0.1/a.png",
      "http://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/a.png",
      "https://evil.example/a.png",
    ]) {
      await expect(fetchOgImage(url, ORIGIN)).resolves.toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses redirects: the fetch errors on one and the card falls back", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.redirect === "error") throw new TypeError("fetch failed: unexpected redirect");
      return new Response(PNG);
    });
    await expect(fetchOgImage("/moved.png", ORIGIN)).resolves.toBeNull();
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("gives null for an image declared over the size cap", async () => {
    respond(PNG, { headers: { "Content-Length": String(50 * 1024 * 1024) } });
    await expect(fetchOgImage("/huge.png", ORIGIN)).resolves.toBeNull();
  });

  it("stops reading a chunked body once it passes the size cap", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    chunk.set(PNG);
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 50) controller.close();
        else controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValue(new Response(body));
    await expect(fetchOgImage("/chunked.png", ORIGIN)).resolves.toBeNull();
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10);
  });
});
