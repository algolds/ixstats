/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: jest.fn() },
}));

import { rateLimiter } from "~/lib/cache";

type Handler = (request: NextRequest) => Promise<Response>;
let discordGET: Handler;
let nsGET: Handler;

const IXTWITTER = "557223534418722818";
const OTHER_CHANNEL = "999999999999999999";
const MESSAGE = "1234567890123456789";

/** A minimal PNG: signature and an IHDR stating 2x2. */
const png = (): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(new ArrayBuffer(33));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set([0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 2], 12);
  return bytes;
};

const ok = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

const discordUrl = (channel: string, file = "a.png") =>
  `https://cdn.discordapp.com/attachments/${channel}/${MESSAGE}/${file}?ex=1`;

const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });

const discord = (url: string, headers?: Record<string, string>) =>
  discordGET(get(`/api/proxy-discord-image?url=${encodeURIComponent(url)}`, headers));

const calledUrls = (fetchMock: jest.SpiedFunction<typeof fetch>) =>
  fetchMock.mock.calls.map(([input]) => String(input));

beforeAll(async () => {
  process.env.DISCORD_BOT_TOKEN = "bot-token";
  delete process.env.DISCORD_IXTWITTER_CHANNEL_ID;
  discordGET = (await import("~/app/api/proxy-discord-image/route")).GET as Handler;
  nsGET = (await import("~/app/api/proxy-ns-image/route")).GET as Handler;
});

describe("image proxy routes", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: true, resetAt: new Date(Date.now() + 60_000) } as never);
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("serves an image with the sniffed type, not the upstream one, and the safety headers", async () => {
    fetchMock.mockResolvedValue(ok(png(), { "content-type": "text/html" }));
    const res = await discord(discordUrl(IXTWITTER));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png());
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("refuses a body that is not an image (the placeholder instead)", async () => {
    fetchMock.mockImplementation(async () =>
      ok("<html><script>alert(1)</script></html>", { "content-type": "image/png" })
    );
    const res = await discord(discordUrl(OTHER_CHANNEL));
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(await res.text()).toContain("Content unavailable");
  });

  it("does not follow a redirect off the allowlist", async () => {
    fetchMock.mockResolvedValueOnce(redirect("https://evil.example/x.png"));
    fetchMock.mockResolvedValue(ok(png()));
    const res = await discord(discordUrl(OTHER_CHANNEL));
    expect(await res.text()).toContain("Content unavailable");
    expect(calledUrls(fetchMock).some((u) => u.includes("evil.example"))).toBe(false);
  });

  it("follows a redirect that stays on the allowlist", async () => {
    fetchMock.mockResolvedValueOnce(redirect("https://media.discordapp.net/attachments/x/y/a.png"));
    fetchMock.mockResolvedValueOnce(ok(png()));
    const res = await discord(discordUrl(OTHER_CHANNEL));
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("refuses a body past the size cap", async () => {
    fetchMock.mockImplementation(async () =>
      ok(png(), { "content-length": String(50 * 1024 * 1024) })
    );
    const res = await discord(discordUrl(OTHER_CHANNEL));
    expect(await res.text()).toContain("Content unavailable");
  });

  it("never asks the bot for a message outside the imported channels", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    await discord(discordUrl(OTHER_CHANNEL, "stale.png"));
    expect(calledUrls(fetchMock).some((u) => u.startsWith("https://discord.com/api"))).toBe(false);
  });

  it("refreshes an expired link of an IxTwitter message through the bot", async () => {
    const fresh = `https://cdn.discordapp.com/attachments/${IXTWITTER}/${MESSAGE}/fresh.png?ex=2`;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://discord.com/api")) {
        return ok(JSON.stringify({ attachments: [{ filename: "fresh.png", url: fresh }] }));
      }
      return url.includes("ex=2") ? ok(png()) : new Response(null, { status: 404 });
    });
    const res = await discord(discordUrl(IXTWITTER, "fresh.png"));
    expect(res.headers.get("content-type")).toBe("image/png");
    const api = fetchMock.mock.calls.find(([u]) => String(u).startsWith("https://discord.com"));
    expect(String(api?.[0])).toBe(
      `https://discord.com/api/v10/channels/${IXTWITTER}/messages/${MESSAGE}`
    );
  });

  it("does not fetch a refreshed link that points off the allowlist", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://discord.com/api")) {
        return ok(
          JSON.stringify({
            attachments: [{ filename: "odd.png", url: "https://evil.example/odd.png" }],
          })
        );
      }
      return new Response(null, { status: 404 });
    });
    const res = await discord(discordUrl(IXTWITTER, "odd.png"));
    expect(await res.text()).toContain("Content unavailable");
    expect(calledUrls(fetchMock).some((u) => u.includes("evil.example"))).toBe(false);
  });

  it("serves a safe SVG inline only to an image load, and as a download otherwise", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>';
    fetchMock.mockImplementation(async () => ok(svg, { "content-type": "image/svg+xml" }));
    const asImage = await discord(discordUrl(OTHER_CHANNEL, "a.svg"), {
      "sec-fetch-dest": "image",
    });
    expect(asImage.headers.get("content-disposition")).toBe("inline");
    const visited = await discord(discordUrl(OTHER_CHANNEL, "a.svg"), {
      "sec-fetch-dest": "document",
    });
    expect(visited.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(visited.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("refuses a scripted SVG", async () => {
    fetchMock.mockImplementation(async () =>
      ok('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', {
        "content-type": "image/svg+xml",
      })
    );
    const res = await discord(discordUrl(OTHER_CHANNEL, "a.svg"), { "sec-fetch-dest": "image" });
    expect(await res.text()).toContain("Content unavailable");
  });

  it("answers 429 past the rate limit without fetching", async () => {
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: false, resetAt: new Date(Date.now() + 30_000) } as never);
    const res = await discord(discordUrl(IXTWITTER));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the NationStates proxy refuses a redirect off its allowlist", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data"));
    const res = await nsGET(
      get(
        `/api/proxy-ns-image?url=${encodeURIComponent("https://www.nationstates.net/images/flags/a.png")}`
      )
    );
    expect(res.status).toBe(307);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("the NationStates proxy serves a raster with its sniffed type", async () => {
    fetchMock.mockResolvedValueOnce(ok(png(), { "content-type": "application/octet-stream" }));
    const res = await nsGET(
      get(
        `/api/proxy-ns-image?url=${encodeURIComponent("https://www.nationstates.net/images/flags/a.png")}`
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
