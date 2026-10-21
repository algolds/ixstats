import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

import { NextRequest } from "next/server";
import {
  GET,
  POST
} from "~/app/api/onoma/tts/route";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { rateLimiter } from "~/lib/cache";
import { globalCache } from "~/lib/cache";

// Mock external dependencies
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("~/server/db", () => ({
  db: {
    systemConfig: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("~/lib/cache", () => ({
  rateLimiter: {
    check: jest.fn(),
  },
  globalCache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock("~/lib/auth", () => ({
  isSystemOwner: jest.fn(() => true),
}));

// Clerk's auth() is typed as a function with a `protect` helper, not a jest mock.
const mockAuth = auth as unknown as jest.Mock;

describe("TTS Proxy API Route (/api/onoma/tts)", () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);
  });

  test("should block unauthenticated requests with 401", async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Authentication required");
  });

  test("should block rate-limited requests with 429", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: false });

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe("Rate limit exceeded");
  });
  test("a POST body of JSON null is a 400, not a gateway error", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
    ]);

    const request = new NextRequest("http://localhost/api/onoma/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
  test("an admin test uses the unsaved kokoro-fastapi engine and URL from the request", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    // Saved config: kokoro-web, no FastAPI URL.
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.engine", value: "kokoro-web" },
    ]);
    (globalCache.get as jest.Mock).mockResolvedValue(null);

    const uint8 = new TextEncoder().encode("audio");
    const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => ab,
      headers: { get: (h: string) => (h === "content-type" ? "audio/wav" : null) },
    });

    const request = new NextRequest("http://localhost/api/onoma/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Imperia",
        ipa: "/ɪmˈpɛɾia/",
        engine: "kokoro-fastapi",
        fastApiUrl: "http://fastapi-service:8880",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://fastapi-service:8880/dev/generate_from_phonemes",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("an admin test with a blank apiKey uses the saved key", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
      { key: "onoma.kokoro.engine", value: "kokoro-web" },
      { key: "onoma.kokoro.apiKey", value: "saved-key" },
    ]);
    (globalCache.get as jest.Mock).mockResolvedValue(null);

    const uint8 = new TextEncoder().encode("audio");
    const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => ab,
      headers: { get: () => "audio/mpeg" },
    });

    const request = new NextRequest("http://localhost/api/onoma/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", apiKey: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://kokoro-service/api/v1/audio/speech",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer saved-key" }),
      })
    );
  });
});
