import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { rateLimiter } from "~/lib/rate-limiter";
import { globalCache } from "~/lib/advanced-cache-system";

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

jest.mock("~/lib/rate-limiter", () => ({
  rateLimiter: {
    check: jest.fn(),
  },
}));

jest.mock("~/lib/advanced-cache-system", () => ({
  globalCache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock("~/lib/system-owner-constants", () => ({
  isSystemOwner: jest.fn(() => false),
}));

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
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Authentication required");
  });

  test("should block rate-limited requests with 429", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: false });

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe("Rate limit exceeded");
  });

  test("should return 503 if Kokoro is not enabled in DB", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "false" },
    ]);

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toContain("not enabled");
  });

  test("should return cached audio on cache hit", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
    ]);
    const mockAudioBase64 = Buffer.from("dummy-audio").toString("base64");
    (globalCache.get as jest.Mock).mockResolvedValue(mockAudioBase64);

    const request = new NextRequest("http://localhost/api/onoma/tts?text=test");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    const arrayBuffer = await response.arrayBuffer();
    expect(Buffer.from(arrayBuffer).toString()).toBe("dummy-audio");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should proxy to Kokoro and store in cache on cache miss", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
      { key: "onoma.kokoro.apiKey", value: "secret-key" },
    ]);
    (globalCache.get as jest.Mock).mockResolvedValue(null);

    const mockResponseText = "generated-audio";
    const uint8 = new TextEncoder().encode(mockResponseText);
    const cleanArrayBuffer = uint8.buffer.slice(
      uint8.byteOffset,
      uint8.byteOffset + uint8.byteLength
    );

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => cleanArrayBuffer,
    });

    const request = new NextRequest(
      "http://localhost/api/onoma/tts?text=hello&voice=af_heart&speed=1.2"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");

    // Verify fetch call parameters
    expect(global.fetch).toHaveBeenCalledWith(
      "http://kokoro-service/api/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-key",
        },
        body: JSON.stringify({
          model: "model_q8f16",
          voice: "af_heart",
          input: "hello",
          response_format: "mp3",
          speed: 1.2,
        }),
      })
    );

    // Verify cache storage (stores base64 representation)
    expect(globalCache.set).toHaveBeenCalledWith(
      expect.stringContaining("onoma:tts:"),
      Buffer.from(cleanArrayBuffer).toString("base64"),
      expect.objectContaining({
        ttl: 30 * 24 * 60 * 60,
      })
    );
  });

  test("should return 502 if Kokoro fetch fails", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
    ]);
    (globalCache.get as jest.Mock).mockResolvedValue(null);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Container Error",
    });

    const request = new NextRequest("http://localhost/api/onoma/tts?text=hello");
    const response = await GET(request);

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("returned error status 500");
    expect(data.details).toBe("Internal Container Error");
  });

  test("should prepend http:// to baseUrl if it lacks a protocol", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "admin_123" });
    (rateLimiter.check as jest.Mock).mockResolvedValue({ success: true });
    (db.user.findUnique as jest.Mock).mockResolvedValue({
      role: { name: "admin", level: 10 },
    });
    (db.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { key: "onoma.kokoro.enabled", value: "true" },
      { key: "onoma.kokoro.baseUrl", value: "http://kokoro-service" },
    ]);
    (globalCache.get as jest.Mock).mockResolvedValue(null);

    const mockResponseText = "generated-audio";
    const uint8 = new TextEncoder().encode(mockResponseText);
    const cleanArrayBuffer = uint8.buffer.slice(
      uint8.byteOffset,
      uint8.byteOffset + uint8.byteLength
    );

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => cleanArrayBuffer,
    });

    const request = new NextRequest("http://localhost/api/onoma/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-override": "true",
      },
      body: JSON.stringify({
        text: "hello",
        baseUrl: "localhost:3000",
        voice: "af_heart",
        speed: 1.0,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/audio/speech",
      expect.any(Object)
    );
  });
});
