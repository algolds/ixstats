// src/app/api/onoma/tts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { rateLimiter } from "~/lib/rate-limiter";
import { globalCache } from "~/lib/advanced-cache-system";
import { db } from "~/server/db";
import { isSystemOwner } from "~/lib/system-owner-constants";
import crypto from "crypto";

async function handleTts(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate Limit
    const limit = await rateLimiter.check(userId, "onoma-tts");
    if (!limit.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Determine if admin (to allow config overrides in test calls)
    let isAdmin = isSystemOwner(userId);
    if (!isAdmin) {
      const role = (session.sessionClaims?.metadata as any)?.role;
      if (["admin", "owner", "staff"].includes(role)) {
        isAdmin = true;
      }
    }
    if (!isAdmin) {
      const dbUser = await db.user.findUnique({
        where: { clerkUserId: userId },
        include: { role: true },
      });
      if (dbUser) {
        const roleName = dbUser.role?.name || "";
        const roleLevel = dbUser.role?.level ?? 999;
        if (["owner", "admin", "staff"].includes(roleName) || roleLevel <= 20) {
          isAdmin = true;
        }
      }
    }

    // Read config from DB
    const rows = await db.systemConfig.findMany({
      where: { key: { startsWith: "onoma.kokoro." } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    let enabled = map.get("onoma.kokoro.enabled") === "true";
    let baseUrl = map.get("onoma.kokoro.baseUrl") || "";
    let apiKey = map.get("onoma.kokoro.apiKey") || "";
    let defaultModel = map.get("onoma.kokoro.model") || "model_q8f16";
    let defaultVoice = map.get("onoma.kokoro.voice") || "af_heart";
    const defaultSpeedVal = map.get("onoma.kokoro.speed");
    let defaultSpeed =
      defaultSpeedVal != null && defaultSpeedVal !== "" ? Number(defaultSpeedVal) : 1.0;

    // Extract input parameters
    let text = "";
    let voice = defaultVoice;
    let speed = defaultSpeed;
    let model = defaultModel;

    if (request.method === "POST") {
      try {
        const body = await request.json();
        text = body.text || "";
        if (body.voice) voice = body.voice;
        if (body.speed != null) speed = Number(body.speed);
        if (body.model) model = body.model;

        // Allow overrides for baseUrl and apiKey only if Admin
        if (isAdmin) {
          if (body.baseUrl) baseUrl = body.baseUrl;
          if (body.apiKey !== undefined) apiKey = body.apiKey;
          // In test mode we bypass the "enabled" switch
          enabled = true;
        }
      } catch (e) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    } else {
      // GET request
      const { searchParams } = new URL(request.url);
      text = searchParams.get("text") || "";
      if (searchParams.get("voice")) voice = searchParams.get("voice")!;
      if (searchParams.get("speed")) speed = Number(searchParams.get("speed"));
      if (searchParams.get("model")) model = searchParams.get("model")!;
    }

    if (!text) {
      return NextResponse.json({ error: "Text parameter is required" }, { status: 400 });
    }

    let normalizedBaseUrl = baseUrl.trim();
    if (!enabled || !normalizedBaseUrl) {
      return NextResponse.json(
        { error: "Kokoro natural voice service is not enabled or configured" },
        { status: 503 }
      );
    }

    if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
      normalizedBaseUrl = `http://${normalizedBaseUrl}`;
    }

    // Cache Lookup
    const cacheKey =
      "onoma:tts:" +
      crypto.createHash("sha1").update(`${text}|${voice}|${speed}|${model}`).digest("hex");

    // Only skip cache if we are testing overrides explicitly
    const isTestingOverrides =
      request.method === "POST" &&
      isAdmin &&
      (request.headers.get("x-test-override") === "true" ||
        baseUrl !== (map.get("onoma.kokoro.baseUrl") || ""));

    if (!isTestingOverrides) {
      const cachedBase64 = await globalCache.get<string>(cacheKey);
      if (cachedBase64) {
        const audioBuffer = Buffer.from(cachedBase64, "base64");
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBuffer.length),
          },
        });
      }
    }

    // Miss: Fetch from Kokoro API
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Normalize endpoint URL nicely
    const cleanBaseUrl = normalizedBaseUrl.replace(/\/$/, "");
    const ttsUrl = cleanBaseUrl.endsWith("/api")
      ? `${cleanBaseUrl}/v1/audio/speech`
      : cleanBaseUrl.endsWith("/api/v1")
        ? `${cleanBaseUrl}/audio/speech`
        : `${cleanBaseUrl}/api/v1/audio/speech`;

    const response = await fetch(ttsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: "mp3",
        speed,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Kokoro TTS API Error] status=${response.status} response=${errorText}`);
      return NextResponse.json(
        {
          error: `Kokoro API returned error status ${response.status}`,
          details: errorText.substring(0, 200),
        },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Save to cache (30 days TTL)
    if (!isTestingOverrides) {
      await globalCache.set(cacheKey, audioBuffer.toString("base64"), {
        ttl: 30 * 24 * 60 * 60,
        tier: "standard",
      });
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (error: any) {
    console.error("[Kokoro TTS Proxy Error]", error);
    return NextResponse.json(
      {
        error: "Failed to connect to Kokoro natural voice service",
        details: error.message || "Timeout or network failure",
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleTts(request);
}

export async function POST(request: NextRequest) {
  return handleTts(request);
}
