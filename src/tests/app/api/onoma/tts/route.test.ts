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
jest.mock("~/lib/auth", () => ({ isSystemOwner: jest.fn(() => true) }));

import { NextRequest } from "next/server";
import { GET, POST } from "~/app/api/onoma/tts/route";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { globalCache, rateLimiter } from "~/lib/cache";
import { isSystemOwner } from "~/lib/auth";

// Clerk's auth() is typed as a function with a `protect` helper, not a jest mock.
const mockAuth = auth as unknown as jest.Mock;
const fetchMock = jest.fn();
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
  jest.mocked(isSystemOwner).mockReturnValue(true);
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
  beforeEach(() => jest.mocked(isSystemOwner).mockReturnValue(false));

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
