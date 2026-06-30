// src/app/api/onoma/tts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { rateLimiter } from "~/lib/rate-limiter";
import { globalCache } from "~/lib/advanced-cache-system";
import { db } from "~/server/db";
import { isSystemOwner } from "~/lib/system-owner-constants";
import crypto from "crypto";
import { ipaToSpokenText } from "~/lib/onoma/branding-utils";
import { ipaToKokoroPhonemes, anglicizeForSpeech } from "~/lib/onoma/kokoro-phonemes";

type KokoroEngine = "kokoro-fastapi" | "kokoro-web";

/** Splits paragraphs into individual sentences respecting abbreviations and decimals */
export function splitIntoSentences(text: string): string[] {
  const abbrevs =
    /\b(St|Dr|Mr|Mrs|Ms|Gen|Col|Lt|Gov|Sen|Rep|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|v|No)\. *$/i;
  const rawSegments = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
  const sentences: string[] = [];

  let current = "";
  for (const segment of rawSegments) {
    current += segment;
    const trimmed = current.trim();
    if (abbrevs.test(trimmed) || /\b\d+\.$/.test(trimmed)) {
      continue;
    }
    sentences.push(trimmed);
    current = "";
  }
  if (current.trim()) {
    sentences.push(current.trim());
  }
  return sentences.map((s) => s.trim()).filter(Boolean);
}

/** Merges multiple WAV buffers by combining PCM data and updating the main RIFF header */
export function mergeWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  let totalDataSize = 0;
  buffers.forEach((buf) => {
    // 44 bytes is standard WAV header size
    if (buf.length > 44) totalDataSize += buf.length - 44;
  });

  const merged = Buffer.alloc(44 + totalDataSize);
  buffers[0].copy(merged, 0, 0, 44);

  const totalFileSize = 44 + totalDataSize - 8;
  merged.writeUInt32LE(totalFileSize, 4);
  merged.writeUInt32LE(totalDataSize, 40);

  let offset = 44;
  buffers.forEach((buf) => {
    if (buf.length > 44) {
      buf.copy(merged, offset, 44, buf.length);
      offset += buf.length - 44;
    }
  });

  return merged;
}

/** Merges multiple MP3 buffers by direct concatenation */
export function mergeMp3Buffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

/** Parse and validate the engine config value (defaults to the fastapi path). */
function parseEngine(raw: string | undefined): KokoroEngine {
  return raw === "kokoro-web" ? "kokoro-web" : "kokoro-fastapi";
}

/** Read a cached {d, ct} wrapper, falling back to legacy plain-base64 entries. */
function readCached(raw: string | undefined | null): { data: string; ct: string } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === "object" && typeof (p as { d?: unknown }).d === "string") {
      return { data: (p as { d: string }).d, ct: (p as { ct?: string }).ct || "audio/mpeg" };
    }
  } catch {
    /* legacy plain base64 string */
  }
  return { data: raw, ct: "audio/mpeg" };
}

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
    // Phoneme-native engine + its base URL. kokoro-fastapi is primary; kokoro-web
    // (the re-spelling path) stays as fallback so the swap is rollback-safe.
    let engine = parseEngine(map.get("onoma.kokoro.engine"));
    let fastApiUrl = map.get("onoma.kokoro.fastApiUrl") || "";

    // Per-culture voice assignments (JSON in systemConfig).
    let voiceMap: Record<string, string> = {};
    try {
      const parsed = JSON.parse(map.get("onoma.kokoro.voiceMap") || "{}");
      if (parsed && typeof parsed === "object") voiceMap = parsed;
    } catch {
      /* ignore malformed map */
    }

    // Extract input parameters
    let text = "";
    let ipa = ""; // Onoma's canonical IPA — drives phoneme synthesis when present
    let voice = defaultVoice;
    let voiceExplicit = false; // client picked a voice (per-name override) → skip culture map
    let culture = "";
    let speed = defaultSpeed;
    let model = defaultModel;
    let anglicize = true;
    let phonemePrefix = "";
    let stripStress = false;
    let prosody = "neutral";

    if (request.method === "POST") {
      try {
        const body = await request.json();
        text = body.text || "";
        if (body.ipa) ipa = body.ipa;
        if (body.voice) {
          voice = body.voice;
          voiceExplicit = true;
        }
        if (body.culture) culture = body.culture;
        if (body.speed != null) speed = Number(body.speed);
        if (body.model) model = body.model;
        if (body.anglicize !== undefined) anglicize = Boolean(body.anglicize);
        if (body.phonemePrefix !== undefined) phonemePrefix = body.phonemePrefix;
        if (body.stripStress !== undefined) stripStress = Boolean(body.stripStress);
        if (body.prosody !== undefined) prosody = body.prosody;

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
      ipa = searchParams.get("ipa") || "";
      if (searchParams.get("voice")) {
        voice = searchParams.get("voice")!;
        voiceExplicit = true;
      }
      culture = searchParams.get("culture") || "";
      if (searchParams.get("speed")) speed = Number(searchParams.get("speed"));
      if (searchParams.get("model")) model = searchParams.get("model")!;
      if (searchParams.get("anglicize")) anglicize = searchParams.get("anglicize") !== "false";
      if (searchParams.get("phonemePrefix")) phonemePrefix = searchParams.get("phonemePrefix")!;
      if (searchParams.get("stripStress")) stripStress = searchParams.get("stripStress") === "true";
      if (searchParams.get("prosody")) prosody = searchParams.get("prosody")!;
    }

    if (!text) {
      return NextResponse.json({ error: "Text parameter is required" }, { status: 400 });
    }

    // Apply the per-culture voice unless the client explicitly chose a voice.
    if (!voiceExplicit && culture) {
      const primaryCulture = culture.split("+")[0].toLowerCase().trim();
      if (voiceMap[primaryCulture]) voice = voiceMap[primaryCulture];
    }

    let normalizedBaseUrl = baseUrl.trim();
    let normalizedFastApiUrl = fastApiUrl.trim();

    if (!enabled) {
      return NextResponse.json(
        { error: "Kokoro natural voice service is not enabled" },
        { status: 503 }
      );
    }
    if (!normalizedBaseUrl && !normalizedFastApiUrl) {
      return NextResponse.json(
        { error: "Kokoro natural voice service is not configured" },
        { status: 503 }
      );
    }

    if (normalizedBaseUrl && !/^https?:\/\//i.test(normalizedBaseUrl)) {
      normalizedBaseUrl = `http://${normalizedBaseUrl}`;
    }
    if (normalizedFastApiUrl && !/^https?:\/\//i.test(normalizedFastApiUrl)) {
      normalizedFastApiUrl = `http://${normalizedFastApiUrl}`;
    }

    // Cache key for the entire request to see if we have a full hit
    const cacheKey =
      "onoma:tts:" +
      crypto
        .createHash("sha1")
        .update(`${engine}|${text}|${ipa}|${voice}|${speed}|${model}|${anglicize}|${phonemePrefix}|${stripStress}|${prosody}`)
        .digest("hex");

    // Only skip cache if we are testing overrides explicitly
    const isTestingOverrides =
      request.method === "POST" &&
      isAdmin &&
      (request.headers.get("x-test-override") === "true" ||
        baseUrl !== (map.get("onoma.kokoro.baseUrl") || ""));

    if (!isTestingOverrides) {
      const cached = readCached(await globalCache.get<string>(cacheKey));
      if (cached) {
        const audioBuffer = Buffer.from(cached.data, "base64");
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": cached.ct,
            "Content-Length": String(audioBuffer.length),
          },
        });
      }
    }

    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) authHeaders["Authorization"] = `Bearer ${apiKey}`;

    // Split incoming text into sentences
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      return NextResponse.json(
        { error: "Text parameter contains no speakable content" },
        { status: 400 }
      );
    }

    const audioBuffers: Buffer[] = [];
    let isWav = !!(engine === "kokoro-fastapi" && ipa && normalizedFastApiUrl);

    for (const sentence of sentences) {
      // Generate individual cache key per sentence segment
      const segmentCacheKey =
        "onoma:tts:segment:" +
        crypto
          .createHash("sha1")
          .update(`${engine}|${sentence}|${ipa}|${voice}|${speed}|${model}|${anglicize}|${phonemePrefix}|${stripStress}|${prosody}`)
          .digest("hex");

      let sentenceBuf: Buffer | null = null;
      let sentenceCt = isWav ? "audio/wav" : "audio/mpeg";

      // 1. Check cache for segment
      if (!isTestingOverrides) {
        const cached = readCached(await globalCache.get<string>(segmentCacheKey));
        if (cached) {
          sentenceBuf = Buffer.from(cached.data, "base64");
          sentenceCt = cached.ct;
          if (sentenceCt === "audio/wav") isWav = true;
          else if (sentenceCt === "audio/mpeg") isWav = false;
        }
      }

      // 2. Synthesize segment if cache miss
      if (!sentenceBuf) {
        if (engine === "kokoro-fastapi" && ipa && normalizedFastApiUrl) {
          let processedIpa = ipa;
          if (anglicize) {
            processedIpa = anglicizeForSpeech(processedIpa);
          }
          if (stripStress) {
            processedIpa = processedIpa.replace(/[ˈˌ]/g, "");
          }
          let { phonemes } = ipaToKokoroPhonemes(processedIpa);
          
          // Apply prosody inflection to phonemes
          if (phonemes) {
            if (prosody === "exclamatory") phonemes += "!";
            else if (prosody === "inquisitive") phonemes += "?";
            else if (prosody === "mysterious") phonemes += "...";
          }

          if (phonemePrefix && phonemes) {
            phonemes = phonemePrefix + phonemes;
          }

          if (phonemes) {
            try {
              const fastApiBase = normalizedFastApiUrl.replace(/\/$/, "");
              const fastRes = await fetch(`${fastApiBase}/dev/generate_from_phonemes`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ phonemes, voice }),
                signal: AbortSignal.timeout(60000),
              });
              if (fastRes.ok) {
                sentenceBuf = Buffer.from(await fastRes.arrayBuffer());
                sentenceCt = fastRes.headers.get("content-type") || "audio/wav";
                isWav = sentenceCt.includes("wav");
              }
            } catch (e: any) {
              console.warn(
                `[Kokoro FastAPI Segment] Failed, falling back to kokoro-web: ${e?.message}`
              );
            }
          }
        }

        // Fallback or kokoro-web plain-text synthesis
        if (!sentenceBuf) {
          if (!normalizedBaseUrl) {
            return NextResponse.json(
              { error: "Kokoro natural voice service fallback is not configured" },
              { status: 503 }
            );
          }
          const cleanBaseUrl = normalizedBaseUrl
            .replace(/\/$/, "")
            .replace(/\/api$/, "")
            .replace(/\/v1$/, "");
          const ttsUrl =
            engine === "kokoro-fastapi"
              ? `${cleanBaseUrl}/v1/audio/speech`
              : `${cleanBaseUrl}/api/v1/audio/speech`;
          
          let input = ipaToSpokenText(ipa) || sentence;
          if (prosody === "exclamatory") input += "!";
          else if (prosody === "inquisitive") input += "?";
          else if (prosody === "mysterious") input += "...";

          const reqBody = { model, voice, input, response_format: "mp3", speed };

          const response = await fetch(ttsUrl, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(reqBody),
            signal: AbortSignal.timeout(60000),
          });

          if (response.ok) {
            sentenceBuf = Buffer.from(await response.arrayBuffer());
            sentenceCt = "audio/mpeg";
            isWav = false;
          } else {
            const errorText = await response.text();
            console.error(`[Kokoro TTS API Segment Error] status=${response.status}`, errorText);
            return NextResponse.json(
              {
                error: `Kokoro API returned error status ${response.status} for segment`,
                details: errorText.substring(0, 200),
              },
              { status: 502 }
            );
          }
        }

        // Write segment to cache
        if (sentenceBuf && !isTestingOverrides) {
          await globalCache.set(
            segmentCacheKey,
            JSON.stringify({ d: sentenceBuf.toString("base64"), ct: sentenceCt }),
            { ttl: 30 * 24 * 60 * 60, tier: "standard" }
          );
        }
      }

      if (sentenceBuf) {
        audioBuffers.push(sentenceBuf);
      }
    }

    // Merge audio buffers based on the resolved content type
    const finalBuffer = isWav ? mergeWavBuffers(audioBuffers) : mergeMp3Buffers(audioBuffers);
    const contentType = isWav ? "audio/wav" : "audio/mpeg";

    // Save full paragraph result back to cache for direct future hits
    if (!isTestingOverrides && finalBuffer.length > 0) {
      await globalCache.set(
        cacheKey,
        JSON.stringify({ d: finalBuffer.toString("base64"), ct: contentType }),
        { ttl: 30 * 24 * 60 * 60, tier: "standard" }
      );
    }

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(finalBuffer.length),
      },
    });
  } catch (error: any) {
    console.warn(
      "[Kokoro TTS Proxy Connection Failure/Timeout] falling back. Error:",
      error?.message || error
    );
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
