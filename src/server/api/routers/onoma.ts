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
import { CULTURE_VOICE, DEFAULT_SPEECH_CONFIG } from "~/lib/onoma/speech";

// SystemConfig keys for Onoma pronunciation settings (admin-tunable).
const SPEECH_KEYS = ["speed", "pitch", "amplitude", "wordgap", "variant"] as const;

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
        let values: string[] = [];

        if (item.note) {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && typeof parsed === "object") {
              category = parsed.category || null;
              values = parsed.values || [];
            }
          } catch {
            // Fallback for legacy comma-separated values
            if (item.contentType === "dictionary") {
              values = item.note
                .split(",")
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

      return db.nameBank.findMany({
        where: {
          type: "dictionary",
          isPublic: true,
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.culturalProfile ? { culturalProfile: input.culturalProfile } : {}),
        },
        orderBy: { createdAt: "desc" },
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
      const noteData = {
        category: input.category || null,
        values: input.values,
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
   * Read the admin-tuned pronunciation config (meSpeak params + per-culture voices).
   * Public so the client speech engine can apply it. Falls back to defaults.
   */
  getSpeechConfig: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.systemConfig.findMany({
      where: { key: { startsWith: "onoma." } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, d: number) => {
      const v = map.get(`onoma.speech.${k}`);
      return v != null && v !== "" ? Number(v) : d;
    };
    const voices: Record<string, string> = {};
    for (const culture of Object.keys(CULTURE_VOICE)) {
      voices[culture] = map.get(`onoma.voice.${culture}`) || CULTURE_VOICE[culture];
    }
    const kokoroEnabled = map.get("onoma.kokoro.enabled") === "true";
    const kokoroVoice = map.get("onoma.kokoro.voice") || "af_heart";
    const kokoroModel = map.get("onoma.kokoro.model") || "model_q8f16";
    const kokoroSpeedVal = map.get("onoma.kokoro.speed");
    const kokoroSpeed =
      kokoroSpeedVal != null && kokoroSpeedVal !== "" ? Number(kokoroSpeedVal) : 1.0;

    const brandVariation = map.get("onoma.brand.variation") || "nucleus";
    const brandNucleusSymbol = map.get("onoma.brand.nucleusSymbol") || "ə";
    const brandFlankingStyle = map.get("onoma.brand.flankingStyle") || "brackets";
    const brandFontFamily = map.get("onoma.brand.fontFamily") || "Inter";

    return {
      speed: num("speed", DEFAULT_SPEECH_CONFIG.speed),
      pitch: num("pitch", DEFAULT_SPEECH_CONFIG.pitch),
      amplitude: num("amplitude", DEFAULT_SPEECH_CONFIG.amplitude),
      wordgap: num("wordgap", DEFAULT_SPEECH_CONFIG.wordgap),
      variant: map.get("onoma.speech.variant") ?? DEFAULT_SPEECH_CONFIG.variant,
      voices,
      kokoro: {
        enabled: kokoroEnabled,
        voice: kokoroVoice,
        speed: kokoroSpeed,
        model: kokoroModel,
      },
      brand: {
        variation: brandVariation,
        nucleusSymbol: brandNucleusSymbol,
        flankingStyle: brandFlankingStyle,
        fontFamily: brandFontFamily,
      },
    };
  }),

  /** Admin: persist the pronunciation config. */
  updateSpeechConfig: adminProcedure
    .input(
      z.object({
        speed: z.number().min(80).max(450),
        pitch: z.number().min(0).max(99),
        amplitude: z.number().min(0).max(200),
        wordgap: z.number().min(0).max(50),
        variant: z.string().max(8),
        voices: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entries: Array<{ key: string; value: string }> = [
        ...SPEECH_KEYS.map((k) => ({ key: `onoma.speech.${k}`, value: String(input[k]) })),
        ...Object.entries(input.voices).map(([culture, voice]) => ({
          key: `onoma.voice.${culture}`,
          value: voice,
        })),
      ];
      await ctx.db.$transaction(
        entries.map((e) =>
          ctx.db.systemConfig.upsert({
            where: { key: e.key },
            update: { value: e.value, updatedAt: new Date() },
            create: { key: e.key, value: e.value, description: `Onoma pronunciation: ${e.key}` },
          })
        )
      );
      return { success: true };
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
    };
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
