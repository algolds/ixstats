/** @jest-environment node */
/**
 * The Onoma TTS proxy route (/api/onoma/tts): a caller must be signed in, within the rate limit and send a JSON
 * body; the narrator is for staff and beta testers only, and only staff may point the server at an engine URL or key
 * of their choosing (SSRF): a beta tester's request is always spoken by the saved voice service.
 */
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/server/db", () => ({
  db: { systemConfig: { findMany: jest.fn() }, user: { findUnique: jest.fn() } },
}));
jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: jest.fn() },
  globalCache: { get: jest.fn(), set: jest.fn() },
}));
jest.mock("~/server/shared/admin-access", () => ({ isAdminClerkUser: jest.fn(async () => true) }));

import { promises as dns } from "dns";
import { NextRequest } from "next/server";
import { GET, POST } from "~/app/api/onoma/tts/route";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { globalCache, rateLimiter } from "~/lib/cache";
import { isAdminClerkUser } from "~/server/shared/admin-access";

// Clerk's auth() is typed as a function with a `protect` helper, not a jest mock.
const mockAuth = auth as unknown as jest.Mock;
const fetchMock = jest.fn();
const lookupSpy = jest.spyOn(dns, "lookup");
const originalFetch = global.fetch;

const SAVED = [
  { key: "onoma.kokoro.enabled", value: "true" },
  { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
  { key: "onoma.kokoro.engine", value: "kokoro-web" },
];
const post = (body: string) =>
  POST(
    new NextRequest("http://localhost/api/onoma/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
  );

beforeAll(() => {
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});
beforeEach(() => {
  jest.clearAllMocks();
  lookupSpy.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  jest.mocked(isAdminClerkUser).mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_123", sessionClaims: {} });
  (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
  (db.systemConfig.findMany as jest.Mock).mockResolvedValue(SAVED);
  (db.user.findUnique as jest.Mock).mockResolvedValue(null);
  (globalCache.get as jest.Mock).mockResolvedValue(null);
  const audio = new TextEncoder().encode("audio");
  fetchMock.mockResolvedValue({
    ok: true,
    arrayBuffer: async () =>
      audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength),
    headers: { get: () => "audio/mpeg" },
  });
});

it("refuses an anonymous caller with 401", async () => {
  mockAuth.mockResolvedValue(null);
  const response = await GET(new NextRequest("http://localhost/api/onoma/tts?text=test"));
  expect(response.status).toBe(401);
  expect((await response.json()).error).toBe("Authentication required");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("refuses a rate-limited caller with 429", async () => {
  (rateLimiter.check as jest.Mock).mockResolvedValue({ success: false });
  const response = await GET(new NextRequest("http://localhost/api/onoma/tts?text=test"));
  expect(response.status).toBe(429);
  expect((await response.json()).error).toBe("Rate limit exceeded");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("answers a POST body of JSON null with 400, not a gateway error", async () => {
  expect((await post("null")).status).toBe(400);
});

describe("a signed-in player who is not staff", () => {
  beforeEach(() => jest.mocked(isAdminClerkUser).mockResolvedValue(false));

  it("is refused the narrator unless a beta tester, and no voice service is called", async () => {
    const response = await GET(new NextRequest("http://localhost/api/onoma/tts?text=test"));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("as a beta tester never makes the server call a URL, engine or key of the request's choosing (SSRF)", async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue({
      role: { name: "beta_tester", level: 90 },
    });
    const response = await post(
      JSON.stringify({
        text: "Imperia",
        ipa: "/ɪmˈpɛɾia/",
        engine: "kokoro-fastapi",
        fastApiUrl: "http://169.254.169.254",
        baseUrl: "http://internal-admin:8080",
        apiKey: "attacker-key",
      })
    );

    expect(response.status).toBe(200);
    const calls: Array<[unknown, unknown]> = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(
      calls.map(([url]) => String(url)).filter((url) => !url.startsWith("http://kokoro-service/"))
    ).toEqual([]);
    expect(
      calls.map(([, init]) => JSON.stringify(init)).filter((init) => init.includes("attacker-key"))
    ).toEqual([]);
  });
});

it("places stress after the initial consonant cluster when calling kokoro-fastapi /dev/generate_from_phonemes", async () => {
  (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
    { key: "onoma.kokoro.enabled", value: "true" },
    { key: "onoma.kokoro.engine", value: "kokoro-fastapi" },
    { key: "onoma.kokoro.fastApiUrl", value: "http://kokoro-fastapi" },
    { key: "onoma.kokoro.voice", value: "af_heart" },
  ]);

  const response = await GET(
    new NextRequest(
      "http://localhost/api/onoma/tts?text=Delepas&ipa=%2F%CB%88delepas%2F&culture=latin"
    )
  );
  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://kokoro-fastapi/dev/generate_from_phonemes",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ phonemes: "dˈɛləpəs", voice: "af_heart" }),
    })
  );
});

describe("admin overrides and error sanitization", () => {
  beforeEach(() => {
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      ...SAVED,
      { key: "onoma.kokoro.apiKey", value: "saved-secret-key" },
    ]);
  });

  it("refuses an override URL pointing to a private or loopback IP with 400", async () => {
    for (const url of [
      "http://127.0.0.1:8080",
      "http://10.0.0.1:8080",
      "http://172.16.0.1:8080",
      "http://192.168.1.1:8080",
      "http://169.254.169.254",
      "http://localhost:8080",
      "http://service.internal",
      "http://[::1]:8080",
    ]) {
      const response = await post(JSON.stringify({ text: "Imperia", baseUrl: url }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "That engine address isn't allowed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses carrier-grade NAT and IPv4-mapped IPv6 literals with 400", async () => {
    for (const url of ["http://100.64.1.1:8080", "http://[::ffff:10.0.0.5]:8080"]) {
      const response = await post(JSON.stringify({ text: "Imperia", baseUrl: url }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "That engine address isn't allowed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a public hostname that resolves to a private address, without calling the engine", async () => {
    lookupSpy.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ] as never);
    const response = await post(
      JSON.stringify({ text: "Imperia", baseUrl: "https://rebind.example.com" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "That engine address isn't allowed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a hostname that does not resolve", async () => {
    lookupSpy.mockRejectedValue(new Error("ENOTFOUND"));
    const response = await post(
      JSON.stringify({ text: "Imperia", baseUrl: "https://nowhere.example.com" })
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses redirects from an override URL, and follows them for the saved engine", async () => {
    await post(JSON.stringify({ text: "Imperia", baseUrl: "https://external-tts.example.com" }));
    expect(lookupSpy).toHaveBeenCalledWith("external-tts.example.com", { all: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].redirect).toBe("error");

    fetchMock.mockClear();
    await post(JSON.stringify({ text: "Imperia two" }));
    expect(fetchMock).toHaveBeenCalled();
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].redirect).toBe("follow");
  });

  it("does not send the saved Authorization header when an override URL is provided without an apiKey", async () => {
    const response = await post(
      JSON.stringify({
        text: "Imperia",
        baseUrl: "https://external-tts.example.com",
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("does not echo upstream body text when the upstream service returns 500", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "INTERNAL_SECRET_TRACEBACK_TOKEN_XYZ",
    });

    const response = await post(JSON.stringify({ text: "Imperia" }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: "The speech engine returned an error" });
    expect(JSON.stringify(body)).not.toContain("INTERNAL_SECRET_TRACEBACK_TOKEN_XYZ");
    errSpy.mockRestore();
  });

  it("refuses a 5,001-character text input with 400", async () => {
    const response = await post(JSON.stringify({ text: "a".repeat(5001) }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses more than 60 sentences with 400", async () => {
    const response = await post(JSON.stringify({ text: "Word. ".repeat(61) }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
