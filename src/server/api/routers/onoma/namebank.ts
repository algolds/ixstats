// src/server/api/routers/onoma/namebank.ts
// Onoma Lab — Stash & NameBank tRPC Router (CRUD, training data, and sharing)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { ActivityGenerator } from "~/lib/activity";
import { StashNoteMetadataSchema } from "~/lib/onoma/types";

export const onomaNameBankRouter = createTRPCRouter({
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
            const raw = JSON.parse(item.note);
            const parsed = StashNoteMetadataSchema.safeParse(raw);
            if (parsed.success) {
              category = parsed.data.category || null;
              role = parsed.data.role || null;
              gender = parsed.data.gender || null;
              setName = parsed.data.setName || null;
              const rawValues = parsed.data.values || [];
              values = rawValues
                .flatMap((v: string) => v.split(/[\r\n,\s]+/))
                .map((v: string) => v.trim())
                .filter(Boolean);
            } else if (raw && typeof raw === "object") {
              const obj = raw as Record<string, unknown>;
              category = typeof obj.category === "string" ? obj.category : null;
              role = typeof obj.role === "string" ? obj.role : null;
              gender = typeof obj.gender === "string" ? obj.gender : null;
              setName = typeof obj.setName === "string" ? obj.setName : null;
              if (Array.isArray(obj.values)) {
                values = obj.values
                  .filter((v): v is string => typeof v === "string")
                  .flatMap((v) => v.split(/[\r\n,\s]+/))
                  .map((v) => v.trim())
                  .filter(Boolean);
              }
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

      // Nullify references in cloned dictionaries to prevent foreign key failure
      await db.nameBank.updateMany({
        where: { clonedFromId: `published_${existing.id}` },
        data: { clonedFromId: null },
      });

      // Delete public published copy if it exists
      await db.nameBank.deleteMany({
        where: {
          id: `published_${existing.id}`,
          userId: ctx.user.id,
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
            userId: ctx.user.id,
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
          await ActivityGenerator.createOnomaShare(ctx.user.id, null, item.pageTitle);
        }

        return published;
      } else {
        // Nullify references in cloned dictionaries to prevent foreign key failure
        await db.nameBank.updateMany({
          where: { clonedFromId: `published_${item.id}` },
          data: { clonedFromId: null },
        });

        return db.nameBank.deleteMany({
          where: {
            id: `published_${item.id}`,
            userId: ctx.user.id,
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
});
