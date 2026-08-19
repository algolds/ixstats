// src/server/api/routers/onoma/speech.ts
// Onoma Lab — Speech, Kokoro Natural Voice & Brand Config tRPC Router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";

// Per-culture Kokoro voice assignments, stored as a JSON string in systemConfig.
function parseVoiceMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Fallback voice catalog used when the Kokoro server can't be reached.
const KOKORO_FALLBACK_VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sarah",
  "am_adam",
  "am_michael",
  "bf_emma",
  "bf_isabella",
  "bm_george",
  "bm_lewis",
];

export const onomaSpeechRouter = createTRPCRouter({
  /**
   * Read the public speech config (Kokoro natural-voice + branding settings).
   * Public so the naming lab can gate the Read Naturally button and apply branding.
   */
  getSpeechConfig: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma." } },
    });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
    const kokoroEnabled = map.get("onoma.kokoro.enabled") === "true";
    const kokoroVoice = map.get("onoma.kokoro.voice") || "af_heart";
    const kokoroModel = map.get("onoma.kokoro.model") || "model_q8f16";
    const kokoroSpeedVal = map.get("onoma.kokoro.speed");
    const kokoroSpeed =
      kokoroSpeedVal != null && kokoroSpeedVal !== "" ? Number(kokoroSpeedVal) : 1.0;
    const kokoroVoiceMap = parseVoiceMap(map.get("onoma.kokoro.voiceMap"));
    const kokoroEngine =
      (map.get("onoma.kokoro.engine") as "kokoro-fastapi" | "kokoro-web") || "kokoro-fastapi";

    const brandVariation = map.get("onoma.brand.variation") || "nucleus";
    const brandNucleusSymbol = map.get("onoma.brand.nucleusSymbol") || "ə";
    const brandFlankingStyle = map.get("onoma.brand.flankingStyle") || "brackets";
    const brandFontFamily = map.get("onoma.brand.fontFamily") || "Inter";

    return {
      kokoro: {
        enabled: kokoroEnabled,
        voice: kokoroVoice,
        speed: kokoroSpeed,
        model: kokoroModel,
        voiceMap: kokoroVoiceMap,
        engine: kokoroEngine,
      },
      brand: {
        variation: brandVariation,
        nucleusSymbol: brandNucleusSymbol,
        flankingStyle: brandFlankingStyle,
        fontFamily: brandFontFamily,
      },
    };
  }),

  /** Admin: get the Kokoro natural voice config including secrets. */
  getKokoroAdminConfig: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma.kokoro." } },
    });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
    const speedVal = map.get("onoma.kokoro.speed");
    return {
      enabled: map.get("onoma.kokoro.enabled") === "true",
      baseUrl: map.get("onoma.kokoro.baseUrl") || "",
      apiKey: map.get("onoma.kokoro.apiKey") || "",
      model: map.get("onoma.kokoro.model") || "model_q8f16",
      voice: map.get("onoma.kokoro.voice") || "af_heart",
      speed: speedVal != null && speedVal !== "" ? Number(speedVal) : 1.0,
      voiceMap: parseVoiceMap(map.get("onoma.kokoro.voiceMap")),
      engine:
        (map.get("onoma.kokoro.engine") as "kokoro-fastapi" | "kokoro-web") || "kokoro-fastapi",
      fastApiUrl: map.get("onoma.kokoro.fastApiUrl") || "",
    };
  }),

  /**
   * Public: list the voices available from the configured Kokoro server.
   * Returns the live catalog when reachable, otherwise a small fallback list so
   * the admin grid and studio picker always have something to show.
   */
  getKokoroVoices: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma.kokoro." } },
    });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
    let baseUrl = (map.get("onoma.kokoro.baseUrl") || "").trim();
    const apiKey = map.get("onoma.kokoro.apiKey") || "";

    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    if (!baseUrl) return { voices: KOKORO_FALLBACK_VOICES, source: "fallback" as const };
    const apiBase = baseUrl.replace(/\/$/, "").replace(/\/api$/, "");

    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(`${apiBase}/api/v1/audio/voices`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as { voices?: unknown })?.voices)
          ? (data as { voices: unknown[] }).voices
          : [];
      const voices = list
        .map((v) => (typeof v === "string" ? v : (v as { id?: unknown })?.id))
        .filter((v): v is string => typeof v === "string");
      return voices.length > 0
        ? { voices, source: "server" as const }
        : { voices: KOKORO_FALLBACK_VOICES, source: "fallback" as const };
    } catch {
      return { voices: KOKORO_FALLBACK_VOICES, source: "fallback" as const };
    }
  }),

  /**
   * Public: suggest IPA phonemization from Kokoro's own G2P (/dev/phonemize).
   */
  suggestPhonemes: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.systemConfig.findMany({
        where: { key: { in: ["onoma.kokoro.fastApiUrl", "onoma.kokoro.apiKey"] } },
      });
      const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
      let fastApiUrl = (map.get("onoma.kokoro.fastApiUrl") || "").trim();
      const apiKey = map.get("onoma.kokoro.apiKey") || "";

      if (!fastApiUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "kokoro-fastapi is not configured",
        });
      }

      if (!/^https?:\/\//i.test(fastApiUrl)) {
        fastApiUrl = `http://${fastApiUrl}`;
      }

      const cleanFastApiUrl = fastApiUrl.replace(/\/$/, "");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      try {
        const res = await fetch(`${cleanFastApiUrl}/dev/phonemize`, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: input.text, language: "en-us" }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          throw new Error(`FastAPI returned status ${res.status}`);
        }

        const data = (await res.json()) as { phonemes?: string | string[] };
        const ph = data.phonemes;
        const normalized = Array.isArray(ph) ? ph.join(" ") : typeof ph === "string" ? ph : "";
        return { phonemes: normalized ? `/${normalized}/` : "" };
      } catch (err: any) {
        console.error("[Suggest Phonemes Error]", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to suggest phonemes: ${err.message || err}`,
        });
      }
    }),

  /**
   * Public: Query health status of both engines.
   */
  getEngineHealth: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma.kokoro." } },
    });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
    let baseUrl = (map.get("onoma.kokoro.baseUrl") || "").trim();
    let fastApiUrl = (map.get("onoma.kokoro.fastApiUrl") || "").trim();
    const apiKey = map.get("onoma.kokoro.apiKey") || "";

    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    if (fastApiUrl && !/^https?:\/\//i.test(fastApiUrl)) fastApiUrl = `http://${fastApiUrl}`;

    const health: { fastapi: "up" | "down" | "unconfigured"; web: "up" | "down" | "unconfigured" } =
      {
        fastapi: "unconfigured",
        web: "unconfigured",
      };

    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    if (fastApiUrl) {
      try {
        const cleanFastApiUrl = fastApiUrl.replace(/\/$/, "");
        const res = await fetch(`${cleanFastApiUrl}/`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(3000),
        });
        health.fastapi = res.ok || res.status === 404 ? "up" : "down";
      } catch {
        health.fastapi = "down";
      }
    }

    if (baseUrl) {
      try {
        const cleanBaseUrl = baseUrl.replace(/\/$/, "").replace(/\/api$/, "");
        const res = await fetch(`${cleanBaseUrl}/api/v1/audio/voices`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(3000),
        });
        health.web = res.ok ? "up" : "down";
      } catch {
        health.web = "down";
      }
    }

    return health;
  }),

  /**
   * Public: Actively ping / wake up the Hugging Face / Kokoro server.
   * If the Space is sleeping or cold-starting, waits with a 45s timeout to wake it up.
   */
  wakeKokoroServer: publicProcedure.mutation(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma.kokoro." } },
    });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value ?? ""]));
    let baseUrl = (map.get("onoma.kokoro.baseUrl") || "").trim();
    let fastApiUrl = (map.get("onoma.kokoro.fastApiUrl") || "").trim();
    const apiKey = map.get("onoma.kokoro.apiKey") || "";
    const engine =
      (map.get("onoma.kokoro.engine") as "kokoro-fastapi" | "kokoro-web") || "kokoro-fastapi";

    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    if (fastApiUrl && !/^https?:\/\//i.test(fastApiUrl)) fastApiUrl = `http://${fastApiUrl}`;

    const targetUrl =
      engine === "kokoro-fastapi" ? fastApiUrl || baseUrl : baseUrl || fastApiUrl;
    if (!targetUrl) {
      return {
        status: "unconfigured" as const,
        message: "No Kokoro / HuggingFace server URL is configured.",
        latencyMs: 0,
        targetUrl: "",
      };
    }

    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const startTime = Date.now();
    try {
      const cleanUrl = targetUrl.replace(/\/$/, "");
      const pingEndpoint =
        engine === "kokoro-fastapi"
          ? `${cleanUrl}/`
          : `${cleanUrl.replace(/\/api$/, "")}/api/v1/audio/voices`;

      const res = await fetch(pingEndpoint, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(45000),
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok || res.status === 404) {
        return {
          status: "awake" as const,
          message: `Server is active and responsive (${latencyMs}ms).`,
          latencyMs,
          targetUrl,
        };
      } else if (res.status === 503 || res.status === 504) {
        return {
          status: "waking" as const,
          message: `Server received wake ping (HTTP ${res.status}). Booting container...`,
          latencyMs,
          targetUrl,
        };
      } else {
        return {
          status: "down" as const,
          message: `Server returned HTTP status ${res.status}.`,
          latencyMs,
          targetUrl,
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        status: "down" as const,
        message: `Connection timed out or failed: ${err?.message || err}`,
        latencyMs,
        targetUrl,
      };
    }
  }),

  /** Admin: persist the Kokoro config keys. */
  updateKokoroConfig: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        baseUrl: z.string().url().or(z.string().length(0)),
        apiKey: z.string(),
        model: z.string(),
        voice: z.string(),
        speed: z.number().min(0.2).max(5.0),
        voiceMap: z.record(z.string(), z.string()).optional(),
        engine: z.enum(["kokoro-fastapi", "kokoro-web"]).default("kokoro-fastapi"),
        fastApiUrl: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entries = [
        {
          key: "onoma.kokoro.enabled",
          value: String(input.enabled),
          desc: "Kokoro natural voice: enabled",
        },
        {
          key: "onoma.kokoro.baseUrl",
          value: input.baseUrl,
          desc: "Kokoro natural voice: API base URL",
        },
        { key: "onoma.kokoro.apiKey", value: input.apiKey, desc: "Kokoro natural voice: API key" },
        { key: "onoma.kokoro.model", value: input.model, desc: "Kokoro natural voice: TTS model" },
        {
          key: "onoma.kokoro.voice",
          value: input.voice,
          desc: "Kokoro natural voice: default voice",
        },
        {
          key: "onoma.kokoro.speed",
          value: String(input.speed),
          desc: "Kokoro natural voice: play speed multiplier",
        },
        {
          key: "onoma.kokoro.voiceMap",
          value: JSON.stringify(input.voiceMap ?? {}),
          desc: "Kokoro natural voice: per-culture voice assignments",
        },
        {
          key: "onoma.kokoro.engine",
          value: input.engine,
          desc: "Kokoro natural voice: TTS engine (kokoro-fastapi or kokoro-web)",
        },
        {
          key: "onoma.kokoro.fastApiUrl",
          value: input.fastApiUrl,
          desc: "Kokoro natural voice: kokoro-fastapi base URL",
        },
      ];
      await ctx.db.$transaction(
        entries.map((e) =>
          ctx.db.systemConfig.upsert({
            where: { key: e.key },
            update: { value: e.value, updatedAt: new Date() },
            create: { key: e.key, value: e.value, description: e.desc },
          })
        )
      );
      return { success: true };
    }),

  /** Admin: persist the Onoma brand configuration. */
  updateBrandConfig: adminProcedure
    .input(
      z.object({
        variation: z.string().max(32),
        nucleusSymbol: z.string().max(8),
        flankingStyle: z.string().max(32),
        fontFamily: z.string().max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entries = [
        {
          key: "onoma.brand.variation",
          value: input.variation,
          desc: "Onoma brand logo variation",
        },
        {
          key: "onoma.brand.nucleusSymbol",
          value: input.nucleusSymbol,
          desc: "Onoma brand nucleus phonetic symbol",
        },
        {
          key: "onoma.brand.flankingStyle",
          value: input.flankingStyle,
          desc: "Onoma brand flanking notation style",
        },
        {
          key: "onoma.brand.fontFamily",
          value: input.fontFamily,
          desc: "Onoma brand typography font family",
        },
      ];
      await ctx.db.$transaction(
        entries.map((e) =>
          ctx.db.systemConfig.upsert({
            where: { key: e.key },
            update: { value: e.value, updatedAt: new Date() },
            create: { key: e.key, value: e.value, description: e.desc },
          })
        )
      );
      return { success: true };
    }),
});
