import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { rateLimiter, globalCache } from "~/lib/cache";
import { db } from "~/server/db";
import { isSystemOwner } from "~/lib/auth";
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

/** Creates a minimal standard 44-byte silent WAV header */
function createSilentWavBuffer(): Buffer {
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(24000, 24); // 24kHz
  buf.writeUInt32LE(48000, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(0, 40);
  return buf;
}

/** Merges multiple WAV buffers by combining PCM data and updating the main RIFF header */
export function mergeWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return createSilentWavBuffer();
  if (buffers.length === 1) return buffers[0] ?? createSilentWavBuffer();

  // 44 bytes is the standard WAV header size
  const pcm = buffers.filter((b) => b.length > 44).map((b) => b.subarray(44));
  const totalDataSize = pcm.reduce((sum, b) => sum + b.length, 0);

  const header = Buffer.alloc(44);
  buffers[0].copy(header, 0, 0, 44);
  header.writeUInt32LE(totalDataSize + 36, 4);
  header.writeUInt32LE(totalDataSize, 40);

  return Buffer.concat([header, ...pcm]);
}

/** Merges multiple MP3 buffers by direct concatenation */
export function mergeMp3Buffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

const ADMIN_ROLES = ["admin", "owner", "staff"];
const BETA_ROLES = ["beta_tester", "beta-tester", "beta"];
const CACHE_OPTS = { ttl: 30 * 24 * 60 * 60, tier: "standard" } as const;
const PROSODY_SUFFIX: Record<string, string> = {
  exclamatory: "!",
  inquisitive: "?",
  mysterious: "...",
};

type RoleClaims = { role?: unknown } | undefined;

const json = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

const audioResponse = (buf: Buffer, contentType: string) =>
  new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: { "Content-Type": contentType, "Content-Length": String(buf.length) },
  });

const withHttp = (url: string) => (url && !/^https?:\/\//i.test(url) ? `http://${url}` : url);

/** Read a cached {d, ct} wrapper, falling back to legacy plain-base64 entries. */
function readCached(raw: string | undefined | null): { data: string; ct: string } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { d?: unknown; ct?: string } | null;
    if (typeof p?.d === "string") return { data: p.d, ct: p.ct || "audio/mpeg" };
  } catch {
    /* legacy plain base64 string */
  }
  return { data: raw, ct: "audio/mpeg" };
}

/** System owners, admins/staff and beta testers may use the narrator. */
async function resolveAccess(userId: string, sessionClaims: object | undefined) {
  const claims = sessionClaims as
    { metadata?: RoleClaims; publicMetadata?: RoleClaims } | undefined;
  const clerkRole = claims?.metadata?.role || claims?.publicMetadata?.role;
  const role = typeof clerkRole === "string" ? clerkRole : "";
  let isAdmin = isSystemOwner(userId) || ADMIN_ROLES.includes(role);
  let hasAccess = isAdmin || BETA_ROLES.includes(role);

  if (!isAdmin) {
    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: { role: true },
    });
    if (dbUser) {
      const roleName = dbUser.role?.name || "";
      const roleLevel = dbUser.role?.level ?? 999;
      if (ADMIN_ROLES.includes(roleName) || roleLevel <= 20) {
        isAdmin = true;
        hasAccess = true;
      } else if (BETA_ROLES.includes(roleName) || roleLevel === 90) {
        hasAccess = true;
      }
    }
  }
  return { isAdmin, hasAccess };
}

interface TtsConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  engine: KokoroEngine;
  fastApiUrl: string;
}

interface TtsParams {
  text: string;
  /** Onoma's canonical IPA, which drives phoneme synthesis when present */
  ipa: string;
  voice: string;
  /** client picked a voice (per-name override), so skip the culture map */
  voiceExplicit: boolean;
  culture: string;
  speed: number;
  model: string;
  anglicize: boolean;
  phonemePrefix: string;
  stripStress: boolean;
  prosody: string;
}

type TtsBody = Partial<Record<keyof TtsParams | keyof TtsConfig, unknown>>;

function paramsFromBody(body: TtsBody, d: TtsParams): TtsParams {
  return {
    text: (body.text as string) || "",
    ipa: (body.ipa as string) || d.ipa,
    voice: (body.voice as string) || d.voice,
    voiceExplicit: !!body.voice,
    culture: (body.culture as string) || d.culture,
    speed: body.speed != null ? Number(body.speed) : d.speed,
    model: (body.model as string) || d.model,
    anglicize: body.anglicize !== undefined ? Boolean(body.anglicize) : d.anglicize,
    phonemePrefix: (body.phonemePrefix as string | undefined) ?? d.phonemePrefix,
    stripStress: body.stripStress !== undefined ? Boolean(body.stripStress) : d.stripStress,
    prosody: (body.prosody as string | undefined) ?? d.prosody,
  };
}

function paramsFromQuery(q: URLSearchParams, d: TtsParams): TtsParams {
  return {
    text: q.get("text") || "",
    ipa: q.get("ipa") || "",
    voice: q.get("voice") || d.voice,
    voiceExplicit: !!q.get("voice"),
    culture: q.get("culture") || "",
    speed: q.get("speed") ? Number(q.get("speed")) : d.speed,
    model: q.get("model") || d.model,
    anglicize: q.get("anglicize") ? q.get("anglicize") !== "false" : d.anglicize,
    phonemePrefix: q.get("phonemePrefix") || d.phonemePrefix,
    stripStress: q.get("stripStress") ? q.get("stripStress") === "true" : d.stripStress,
    prosody: q.get("prosody") || d.prosody,
  };
}

/** Phoneme-native kokoro-fastapi synthesis; null when unavailable so the caller falls back. */
async function synthesizeFastApi(
  p: TtsParams,
  fastApiUrl: string,
  headers: Record<string, string>
): Promise<{ buf: Buffer; ct: string } | null> {
  let ipa = p.anglicize ? anglicizeForSpeech(p.ipa) : p.ipa;
  if (p.stripStress) ipa = ipa.replace(/[ˈˌ]/g, "");
  let { phonemes } = ipaToKokoroPhonemes(ipa);
  if (!phonemes) return null;
  phonemes = p.phonemePrefix + phonemes + (PROSODY_SUFFIX[p.prosody] ?? "");

  try {
    const res = await fetch(`${fastApiUrl.replace(/\/$/, "")}/dev/generate_from_phonemes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phonemes, voice: p.voice }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    return {
      buf: Buffer.from(await res.arrayBuffer()),
      ct: res.headers.get("content-type") || "audio/wav",
    };
  } catch (e) {
    console.warn(
      `[Kokoro FastAPI Segment] Failed, falling back to kokoro-web: ${e instanceof Error ? e.message : e}`
    );
    return null;
  }
}

/** Plain-text kokoro-web (or fastapi OpenAI-compatible) synthesis; returns an error response on failure. */
async function synthesizeWeb(
  p: TtsParams,
  sentence: string,
  config: TtsConfig,
  baseUrl: string,
  headers: Record<string, string>
): Promise<{ buf: Buffer; ct: string } | NextResponse> {
  if (!baseUrl) return json("Kokoro natural voice service fallback is not configured", 503);

  const cleanBaseUrl = baseUrl
    .replace(/\/$/, "")
    .replace(/\/api$/, "")
    .replace(/\/v1$/, "");
  const ttsUrl =
    config.engine === "kokoro-fastapi"
      ? `${cleanBaseUrl}/v1/audio/speech`
      : `${cleanBaseUrl}/api/v1/audio/speech`;
  const input = (ipaToSpokenText(p.ipa) || sentence) + (PROSODY_SUFFIX[p.prosody] ?? "");

  const response = await fetch(ttsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: p.model,
      voice: p.voice,
      input,
      response_format: "mp3",
      speed: p.speed,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Kokoro TTS API Segment Error] status=${response.status}`, errorText);
    return json(`Kokoro API returned error status ${response.status} for segment`, 502, {
      details: errorText.substring(0, 200),
    });
  }
  return { buf: Buffer.from(await response.arrayBuffer()), ct: "audio/mpeg" };
}

async function loadConfig() {
  const rows = await db.systemConfig.findMany({
    where: { key: { startsWith: "onoma.kokoro." } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const get = (k: string) => map.get(`onoma.kokoro.${k}`);

  let voiceMap: Record<string, string> = {};
  try {
    const parsed = JSON.parse(get("voiceMap") || "{}");
    if (parsed && typeof parsed === "object") voiceMap = parsed;
  } catch {
    /* ignore malformed map */
  }

  const speed = get("speed");
  const config: TtsConfig = {
    enabled: get("enabled") === "true",
    baseUrl: get("baseUrl") || "",
    apiKey: get("apiKey") || "",
    // kokoro-fastapi is primary; kokoro-web (the re-spelling path) stays as fallback so the swap is rollback-safe.
    engine: get("engine") === "kokoro-web" ? "kokoro-web" : "kokoro-fastapi",
    fastApiUrl: get("fastApiUrl") || "",
  };
  const defaults: TtsParams = {
    text: "",
    ipa: "",
    voice: get("voice") || "af_heart",
    voiceExplicit: false,
    culture: "",
    speed: speed != null && speed !== "" ? Number(speed) : 1.0,
    model: get("model") || "model_q8f16",
    anglicize: true,
    phonemePrefix: "",
    stripStress: false,
    prosody: "neutral",
  };
  return { config, defaults, voiceMap, savedBaseUrl: config.baseUrl };
}

/** Engine overrides (the admin panel's unsaved values) are honoured for admins only. */
function applyAdminOverrides(config: TtsConfig, body: TtsBody) {
  if (body.engine) config.engine = body.engine === "kokoro-web" ? "kokoro-web" : "kokoro-fastapi";
  if (body.fastApiUrl) config.fastApiUrl = body.fastApiUrl as string;
  if (body.baseUrl) config.baseUrl = body.baseUrl as string;
  // An empty key means "use the saved one" (the admin form never holds it).
  if (body.apiKey) config.apiKey = body.apiKey as string;
  // In test mode we bypass the "enabled" switch
  config.enabled = true;
}

interface SegmentContext {
  p: TtsParams;
  config: TtsConfig;
  baseUrl: string;
  fastApiUrl: string;
  headers: Record<string, string>;
  keyFor: (prefix: string, text: string) => string;
  useCache: boolean;
}

const readCache = async (key: string, enabled: boolean) =>
  enabled ? readCached(await globalCache.get<string>(key)) : null;

/** Synthesizes (or loads from cache) every sentence; returns an error response on failure. */
async function synthesizeSentences(sentences: string[], ctx: SegmentContext) {
  const { p, config, baseUrl, fastApiUrl, headers, keyFor, useCache } = ctx;
  const useFastApi = config.engine === "kokoro-fastapi" && !!p.ipa && !!fastApiUrl;
  const buffers: Buffer[] = [];
  let isWav = useFastApi;

  for (const sentence of sentences) {
    const segmentKey = keyFor("onoma:tts:segment:", sentence);
    const cached = await readCache(segmentKey, useCache);
    if (cached) {
      buffers.push(Buffer.from(cached.data, "base64"));
      if (cached.ct === "audio/wav") isWav = true;
      else if (cached.ct === "audio/mpeg") isWav = false;
      continue;
    }

    const segment =
      (useFastApi && (await synthesizeFastApi(p, fastApiUrl, headers))) ||
      (await synthesizeWeb(p, sentence, config, baseUrl, headers));
    if (segment instanceof NextResponse) return segment;

    isWav = segment.ct.includes("wav");
    buffers.push(segment.buf);
    if (useCache) {
      await globalCache.set(
        segmentKey,
        JSON.stringify({ d: segment.buf.toString("base64"), ct: segment.ct }),
        CACHE_OPTS
      );
    }
  }
  return { buffers, isWav };
}

/** Parses and validates the request into synthesis parameters; returns an error response when invalid. */
async function prepareRequest(request: NextRequest, isAdmin: boolean) {
  const { config, defaults, voiceMap, savedBaseUrl } = await loadConfig();

  let p: TtsParams;
  if (request.method === "POST") {
    let body: TtsBody;
    try {
      body = await request.json();
    } catch {
      return json("Invalid JSON body", 400);
    }
    p = paramsFromBody(body, defaults);
    if (isAdmin) applyAdminOverrides(config, body);
  } else {
    p = paramsFromQuery(new URL(request.url).searchParams, defaults);
  }

  if (!p.text) return json("Text parameter is required", 400);

  // Apply the per-culture voice unless the client explicitly chose a voice.
  const primaryCulture = p.culture.split("+")[0].toLowerCase().trim();
  if (!p.voiceExplicit && p.culture && voiceMap[primaryCulture]) p.voice = voiceMap[primaryCulture];

  const baseUrl = withHttp(config.baseUrl.trim());
  const fastApiUrl = withHttp(config.fastApiUrl.trim());

  if (!config.enabled) return json("Kokoro natural voice service is not enabled", 503);
  if (!baseUrl && !fastApiUrl) return json("Kokoro natural voice service is not configured", 503);

  // Only skip cache if we are testing overrides explicitly
  const isTestingOverrides =
    request.method === "POST" &&
    isAdmin &&
    (request.headers.get("x-test-override") === "true" || config.baseUrl !== savedBaseUrl);

  return { p, config, baseUrl, fastApiUrl, useCache: !isTestingOverrides };
}

async function handleTts(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return json("Authentication required", 401);

    const limit = await rateLimiter.check(userId, "onoma-tts");
    if (!limit.success) return json("Rate limit exceeded", 429);

    const { isAdmin, hasAccess } = await resolveAccess(userId, session.sessionClaims);
    if (!hasAccess) {
      return json(
        "Narrator feature is currently restricted to system owners, administrators, and beta testers.",
        403
      );
    }

    const prepared = await prepareRequest(request, isAdmin);
    if (prepared instanceof NextResponse) return prepared;
    const { p, config, baseUrl, fastApiUrl, useCache } = prepared;

    const keyFor = (prefix: string, text: string) =>
      prefix +
      crypto
        .createHash("sha1")
        .update(
          `${config.engine}|${text}|${p.ipa}|${p.voice}|${p.speed}|${p.model}|${p.anglicize}|${p.phonemePrefix}|${p.stripStress}|${p.prosody}`
        )
        .digest("hex");
    const cacheKey = keyFor("onoma:tts:", p.text);

    const cachedFull = await readCache(cacheKey, useCache);
    if (cachedFull) return audioResponse(Buffer.from(cachedFull.data, "base64"), cachedFull.ct);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const sentences = splitIntoSentences(p.text);
    if (sentences.length === 0) return json("Text parameter contains no speakable content", 400);

    const result = await synthesizeSentences(sentences, {
      p,
      config,
      baseUrl,
      fastApiUrl,
      headers,
      keyFor,
      useCache,
    });
    if (result instanceof NextResponse) return result;

    const { buffers, isWav } = result;

    const finalBuffer = isWav ? mergeWavBuffers(buffers) : mergeMp3Buffers(buffers);
    const contentType = isWav ? "audio/wav" : "audio/mpeg";

    if (useCache && finalBuffer.length > 0) {
      await globalCache.set(
        cacheKey,
        JSON.stringify({ d: finalBuffer.toString("base64"), ct: contentType }),
        CACHE_OPTS
      );
    }

    return audioResponse(finalBuffer, contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn(
      "[Kokoro TTS Proxy Connection Failure/Timeout] falling back. Error:",
      message || error
    );
    return json("Failed to connect to Kokoro natural voice service", 502, {
      details: message || "Timeout or network failure",
    });
  }
}

export const GET = handleTts;
export const POST = handleTts;
