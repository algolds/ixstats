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
import {
  cleanRawValues,
  mapStashItemToEntry,
  mapStandaloneItemToEntry,
  parseStashItemNote,
} from "./namebank-helpers";

export const onomaNameBankRouter = createTRPCRouter({
  /**
   * Fetch saved names or dictionaries for the authenticated user (supporting both global Stash and standalone Onoma NameBank).
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

      // 1. Fetch user's global stash items of type name or dictionary
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

      // 2. Fetch standalone NameBank records
      const standaloneItems = await db.nameBank.findMany({
        where: {
          userId: ctx.user.id,
          type: input?.type ? input.type : undefined,
        },
        orderBy: { createdAt: "desc" },
      });

      // Map records using shared helpers
      const stashMapped = userStashItems.map((item) => mapStashItemToEntry(item, userId));

      const standaloneMapped = standaloneItems
        .filter(
          (item) =>
            !userStashItems.some(
              (si) =>
                si.pageTitle === item.title &&
                (si.contentType === item.type ||
                  (si.contentType === "name" && item.type === "saved-name"))
            )
        )
        .map((item) => mapStandaloneItemToEntry(item, userId));

      const combined = [...stashMapped, ...standaloneMapped];

      if (input?.type) {
        return combined.filter((item) => item.type === input.type);
      }

      return combined;
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

      return items.map((item) => ({
        ...item,
        values: cleanRawValues(item.values),
      }));
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
   * Save a generated name or custom dictionary directly into a global Stash folder or standalone Onoma NameBank.
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
        lexiconDefinition: z
          .object({
            partOfSpeech: z.string(),
            root: z.string(),
            meaning: z.string(),
            origin: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.auth.userId;
      const cleanValues = cleanRawValues(input.values);

      // Handle standalone save mode if explicitly requested
      if (input.stashId === "standalone") {
        if (input.id) {
          const updated = await db.nameBank.update({
            where: { id: input.id },
            data: {
              title: input.title,
              values: cleanValues,
              category: input.category,
              culturalProfile: input.culturalProfile,
              isPublic: input.isPublic ?? false,
            },
          });
          return {
            ...mapStandaloneItemToEntry(updated, userId),
            role: input.role || null,
            gender: input.gender || null,
            setName: input.setName || null,
            lexiconDefinition: input.lexiconDefinition || null,
          };
        }

        const created = await db.nameBank.create({
          data: {
            userId: ctx.user.id,
            type: input.type,
            title: input.title,
            values: cleanValues,
            category: input.category,
            culturalProfile: input.culturalProfile,
            isPublic: input.isPublic ?? false,
            countryId: input.countryId,
          },
        });

        return {
          ...mapStandaloneItemToEntry(created, userId),
          role: input.role || null,
          gender: input.gender || null,
          setName: input.setName || null,
          lexiconDefinition: input.lexiconDefinition || null,
        };
      }

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
        role: input.role || null,
        gender: input.gender || null,
        setName: input.setName || null,
        values: cleanValues,
        lexiconDefinition: input.lexiconDefinition || null,
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
          // If not in stashItem, try updating standalone nameBank
          const standalone = await db.nameBank.findFirst({
            where: { id: input.id, userId: ctx.user.id },
          });
          if (standalone) {
            const updated = await db.nameBank.update({
              where: { id: input.id },
              data: {
                title: input.title,
                values: cleanValues,
                category: input.category,
                culturalProfile: input.culturalProfile,
                isPublic: input.isPublic ?? false,
              },
            });
            return {
              ...mapStandaloneItemToEntry(updated, userId),
              role: input.role || null,
              gender: input.gender || null,
              setName: input.setName || null,
              lexiconDefinition: input.lexiconDefinition || null,
            };
          }

          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entry not found",
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

      return mapStashItemToEntry(item, userId);
    }),

  /**
   * Delete a saved name or dictionary from the global Stash system or standalone NameBank.
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
        // Fallback: Check if it's a standalone NameBank record
        const standalone = await db.nameBank.findFirst({
          where: { id: input.id, userId: ctx.user.id },
        });
        if (standalone) {
          return db.nameBank.delete({
            where: { id: input.id },
          });
        }

        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
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
        ...mapStashItemToEntry(item, userId),
        clonedFromId: source.id,
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

      const parsed = parseStashItemNote(item.note, item.contentType);

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
            values: parsed.values,
            category: parsed.category,
            isPublic: true,
          },
          update: {
            title: item.pageTitle,
            values: parsed.values,
            category: parsed.category,
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
