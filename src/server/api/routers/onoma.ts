// src/server/api/routers/onoma.ts
// Onoma Lab — tRPC Router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { ActivityGenerator } from "~/lib/activity-generator";

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

export const onomaRouter = createTRPCRouter({
  /**
   * Fetch the saved names or dictionaries for the authenticated user from the global Stash system.
   */
  getNameBank: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["dictionary", "saved-name"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      // Fetch all user's stash items of type name or dictionary
      const userStashItems = await db.stashItem.findMany({
        where: {
          stash: { userId },
          contentType: { in: ["name", "dictionary"] },
        },
        include: {
          stash: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: { savedAt: "desc" },
      });

      // Map StashItem to NameBankEntry structure expected by the frontend
      const mapped = userStashItems.map((item) => {
        let category: string | null = null;
        let role: string | null = null;
        let gender: string | null = null;
        let setName: string | null = null;
        let values: string[] = [];

        if (item.note) {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && typeof parsed === "object") {
              category = parsed.category || null;
              role = parsed.role || null;
              gender = parsed.gender || null;
              setName = parsed.setName || null;
              const rawValues = parsed.values || [];
              values = Array.isArray(rawValues)
                ? rawValues.flatMap((v: string) => v.split(/[\r\n,\s]+/)).map((v: string) => v.trim()).filter(Boolean)
                : typeof rawValues === "string"
                ? rawValues.split(/[\r\n,\s]+/).map((v: string) => v.trim()).filter(Boolean)
                : [];
            }
          } catch {
            // Fallback for legacy comma-separated values
            if (item.contentType === "dictionary") {
              values = item.note
                .split(/[\r\n,\s]+/)
                .map((v) => v.trim())
                .filter(Boolean);
            }
          }
        }

        // Default value for name contentType
        if (item.contentType === "name" && values.length === 0) {
          values = [item.pageTitle];
        }

        return {
          id: item.id,
          userId,
          type: item.contentType === "dictionary" ? "dictionary" : "saved-name",
          title: item.pageTitle,
          values,
          category,
          role,
          gender,
          setName,
          culturalProfile: null,
          isPublic: false,
          countryId: null,
          clonedFromId: null,
          createdAt: item.savedAt,
          updatedAt: item.updatedAt,
          stashId: item.stash.id,
          stashName: item.stash.name,
          stashColor: item.stash.color,
        };
      });

      if (input?.type) {
        return mapped.filter((item) => item.type === input.type);
      }

      return mapped;
    }),

  /**
   * Fetch all shared public dictionaries.
   */
  getPublicDictionaries: publicProcedure
    .input(
      z
        .object({
          category: z.string().nullable().optional(),
          culturalProfile: z.string().nullable().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const items = await db.nameBank.findMany({
        where: {
          type: "dictionary",
          isPublic: true,
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.culturalProfile ? { culturalProfile: input.culturalProfile } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      return items.map((item) => {
        const rawValues = item.values;
        let values: string[] = [];
        if (Array.isArray(rawValues)) {
          values = (rawValues as string[])
            .flatMap((v) => v.split(/[\r\n,\s]+/))
            .map((v) => v.trim())
            .filter(Boolean);
        } else if (typeof rawValues === "string") {
          values = (rawValues as string)
            .split(/[\r\n,\s]+/)
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return {
          ...item,
          values,
        };
      });
    }),

  /**
   * Retrieve real database naming records to train Markov chains in "IxWorld" mode.
   */
  getTrainingData: protectedProcedure
    .input(
      z.object({
        category: z.enum(["country", "city", "province", "person"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      if (input.category === "country") {
        const countries = await db.country.findMany({
          select: { name: true },
          take: 100,
        });
        return countries.map((c) => c.name);
      } else if (input.category === "city") {
        const cities = await db.city.findMany({
          select: { name: true },
          take: 200,
        });
        return cities.map((c) => c.name);
      } else if (input.category === "province") {
        const subdivisions = await db.subdivision.findMany({
          select: { name: true },
          take: 150,
        });
        return subdivisions.map((s) => s.name);
      } else {
        const officials = await db.governmentOfficial.findMany({
          select: { name: true },
          take: 150,
        });
        return officials.map((o) => o.name);
      }
    }),

  /**
   * Save a generated name or custom dictionary directly into a global Stash folder.
   */
  saveToNameBank: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        type: z.enum(["dictionary", "saved-name"]),
        title: z.string().min(1),
        values: z.array(z.string()),
        category: z.string().nullable().optional(),
        culturalProfile: z.string().nullable().optional(),
        role: z.string().nullable().optional(),
        gender: z.string().nullable().optional(),
        setName: z.string().nullable().optional(),
        isPublic: z.boolean().optional(),
        countryId: z.string().nullable().optional(),
        stashId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      // 1. Get or create the stash folder
      let targetStashId = input.stashId;
      if (!targetStashId) {
        let defaultStash = await db.stash.findFirst({
          where: { userId, isDefault: true },
        });
        if (!defaultStash) {
          defaultStash = await db.stash.create({
            data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
          });
        }
        targetStashId = defaultStash.id;
      }

      // 2. Serialize metadata into JSON note
      const rawValues = input.values;
      const cleanValues = rawValues
        .flatMap((v) => v.split(/[\r\n,\s]+/))
        .map((v) => v.trim())
        .filter(Boolean);

      const noteData = {
        category: input.category || null,
        role: input.role || null,
        gender: input.gender || null,
        setName: input.setName || null,
        values: cleanValues,
      };
      const note = JSON.stringify(noteData);
      const pageTitle = input.title;
      const pageSlug = encodeURIComponent(pageTitle.replace(/ /g, "_"));

      let item;
      if (input.id) {
        // Update existing stash item
        const existing = await db.stashItem.findUnique({
          where: { id: input.id },
          include: { stash: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Stash item not found",
          });
        }

        if (existing.stash.userId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not own this entry",
          });
        }

        item = await db.stashItem.update({
          where: { id: input.id },
          data: {
            pageTitle,
            pageSlug,
            note,
            stashId: targetStashId,
          },
          include: { stash: true },
        });
      } else {
        // Create new stash item
        item = await db.stashItem.upsert({
          where: {
            stashId_pageTitle: {
              stashId: targetStashId,
              pageTitle,
            },
          },
          create: {
            stashId: targetStashId,
            pageTitle,
            pageSlug,
            contentType: input.type === "dictionary" ? "dictionary" : "name",
            note,
          },
          update: {
            note,
          },
          include: { stash: true },
        });
      }

      return {
        id: item.id,
        userId,
        type: item.contentType === "dictionary" ? "dictionary" : "saved-name",
        title: item.pageTitle,
        values: input.values,
        category: input.category || null,
        role: input.role || null,
        gender: input.gender || null,
        setName: input.setName || null,
        culturalProfile: null,
        isPublic: false,
        countryId: null,
        clonedFromId: null,
        createdAt: item.savedAt,
        updatedAt: item.updatedAt,
        stashId: item.stash.id,
        stashName: item.stash.name,
        stashColor: item.stash.color,
      };
    }),

  /**
   * Delete a saved name or dictionary from the global Stash system.
   */
  deleteFromNameBank: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const existing = await db.stashItem.findUnique({
        where: { id: input.id },
        include: { stash: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stash item not found",
        });
      }

      if (existing.stash.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this entry",
        });
      }

      // Delete public published copy if it exists
      await db.nameBank.deleteMany({
        where: {
          id: `published_${existing.id}`,
          userId,
        },
      });

      return db.stashItem.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Clone a public dictionary preset into the user's global Stash folder.
   */
  cloneDictionary: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const source = await db.nameBank.findUnique({
        where: { id: input.id },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source template dictionary not found",
        });
      }

      let defaultStash = await db.stash.findFirst({
        where: { userId, isDefault: true },
      });
      if (!defaultStash) {
        defaultStash = await db.stash.create({
          data: { userId, name: "My Stash", color: "#3b82f6", isDefault: true },
        });
      }

      const note = JSON.stringify({
        category: source.category,
        values: source.values,
      });

      const title = `${source.title} (Clone)`;
      const slug = encodeURIComponent(title.replace(/ /g, "_"));

      const item = await db.stashItem.upsert({
        where: {
          stashId_pageTitle: {
            stashId: defaultStash.id,
            pageTitle: title,
          },
        },
        create: {
          stashId: defaultStash.id,
          pageTitle: title,
          pageSlug: slug,
          contentType: "dictionary",
          note,
        },
        update: {
          note,
        },
        include: { stash: true },
      });

      return {
        id: item.id,
        userId,
        type: "dictionary",
        title: item.pageTitle,
        values: source.values as string[],
        category: source.category,
        culturalProfile: null,
        isPublic: false,
        countryId: null,
        clonedFromId: source.id,
        createdAt: item.savedAt,
        updatedAt: item.updatedAt,
        stashId: item.stash.id,
        stashName: item.stash.name,
        stashColor: item.stash.color,
      };
    }),

  /**
   * Toggle the public visibility of a stashed naming dictionary.
   */
  togglePublic: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isPublic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const item = await db.stashItem.findUnique({
        where: { id: input.id },
        include: { stash: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stash item not found",
        });
      }

      if (item.stash.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this entry",
        });
      }

      let category: string | null = null;
      let values: string[] = [];
      if (item.note) {
        try {
          const parsed = JSON.parse(item.note);
          if (parsed && typeof parsed === "object") {
            category = parsed.category || null;
            values = parsed.values || [];
          }
        } catch {}
      }

      if (input.isPublic) {
        const published = await db.nameBank.upsert({
          where: {
            id: `published_${item.id}`,
          },
          create: {
            id: `published_${item.id}`,
            userId,
            type: item.contentType === "dictionary" ? "dictionary" : "saved-name",
            title: item.pageTitle,
            values,
            category,
            isPublic: true,
          },
          update: {
            title: item.pageTitle,
            values,
            category,
            isPublic: true,
          },
        });

        if (item.contentType === "dictionary") {
          await ActivityGenerator.createOnomaShare(userId, null, item.pageTitle);
        }

        return published;
      } else {
        return db.nameBank.deleteMany({
          where: {
            id: `published_${item.id}`,
            userId,
          },
        });
      }
    }),

  /**
   * Record name generation statistics activity log.
   */
  logGeneration: protectedProcedure
    .input(
      z.object({
        count: z.number().min(1),
        category: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;

      const user = await db.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, countryId: true },
      });

      await ActivityGenerator.createOnomaGeneration(
        user?.id || userId,
        user?.countryId,
        input.count,
        input.category
      );

      return { success: true };
    }),

  /**
   * Read the public speech config (Kokoro natural-voice + branding settings).
   * Public so the naming lab can gate the Read Naturally button and apply branding.
   */
  getSpeechConfig: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma." } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
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
    const map = new Map(rows.map((r) => [r.key, r.value]));
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
    const map = new Map(rows.map((r) => [r.key, r.value]));
    let baseUrl = (map.get("onoma.kokoro.baseUrl") || "").trim();
    const apiKey = map.get("onoma.kokoro.apiKey") || "";

    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    if (!baseUrl) return { voices: KOKORO_FALLBACK_VOICES, source: "fallback" as const };
    // kokoro-web serves under /api/v1; tolerate a baseUrl with or without /api.
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
      // kokoro-web returns an array of { id, name, lang, ... }; tolerate { voices: [...] } too.
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
      const map = new Map(rows.map((r) => [r.key, r.value]));
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
    const map = new Map(rows.map((r) => [r.key, r.value]));
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
