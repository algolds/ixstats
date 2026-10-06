import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { requireWikiUserIds } from "~/lib/wiki-os/auth";
import { ActivityGenerator } from "~/lib/activity";
import {
  cleanRawValues,
  mapStashItemToEntry,
  mapStandaloneItemToEntry,
  parseStashItemNote,
} from "./namebank-helpers";
import { getOrCreateDefaultStash } from "~/server/shared/default-stash";

const SaveToNameBankSchema = z.object({
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
});
type SaveToNameBankInput = z.infer<typeof SaveToNameBankSchema>;

const TRAINING_SOURCES = {
  country: {
    take: 100,
    load: (db: PrismaClient, take: number) => db.country.findMany({ select: { name: true }, take }),
  },
  city: {
    take: 200,
    load: (db: PrismaClient, take: number) => db.city.findMany({ select: { name: true }, take }),
  },
  province: {
    take: 150,
    load: (db: PrismaClient, take: number) =>
      db.subdivision.findMany({ select: { name: true }, take }),
  },
  person: {
    take: 150,
    load: (db: PrismaClient, take: number) =>
      db.governmentOfficial.findMany({ select: { name: true }, take }),
  },
};

function assertOwnsStashItem(item: { stash: { userId: string } }, userId: string) {
  if (item.stash.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this entry" });
  }
}

/** Standalone NameBank row as the client reads it, plus the stash-only fields from the request. */
function standaloneEntry(
  row: Parameters<typeof mapStandaloneItemToEntry>[0],
  userId: string,
  input: SaveToNameBankInput
) {
  return {
    ...mapStandaloneItemToEntry(row, userId),
    role: input.role || null,
    gender: input.gender || null,
    setName: input.setName || null,
    lexiconDefinition: input.lexiconDefinition || null,
  };
}

const updateStandalone = (
  db: PrismaClient,
  id: string,
  input: SaveToNameBankInput,
  values: string[]
) =>
  db.nameBank.update({
    where: { id },
    data: {
      title: input.title,
      values,
      category: input.category,
      culturalProfile: input.culturalProfile,
      isPublic: input.isPublic ?? false,
    },
  });

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
      const { take, load } = TRAINING_SOURCES[input.category];
      const rows = await load(ctx.db, take);
      return rows.map((r) => r.name);
    }),

  /**
   * Save a generated name or custom dictionary directly into a global Stash folder or standalone Onoma NameBank.
   */
  saveToNameBank: rateLimitedMutationProcedure
    .input(SaveToNameBankSchema)
    .mutation(async ({ ctx, input }) => {
      // An entry may be tagged to a country only by someone who may write to that country.
      if (input.countryId) await assertCountryWriteAccess(ctx, input.countryId);
      const { db } = ctx;
      const userId = ctx.auth.userId;
      const cleanValues = cleanRawValues(input.values);

      // Handle standalone save mode if explicitly requested
      if (input.stashId === "standalone") {
        if (input.id) {
          const owned = await db.nameBank.findFirst({
            where: { id: input.id, userId: ctx.user.id },
            select: { id: true },
          });
          if (!owned) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
          }
          return standaloneEntry(
            await updateStandalone(db, owned.id, input, cleanValues),
            userId,
            input
          );
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
        return standaloneEntry(created, userId, input);
      }

      // 1. Get or create the stash folder (a caller-supplied stash must be the caller's own)
      let targetStashId = input.stashId;
      if (targetStashId) {
        const ownStash = await db.stash.findFirst({
          where: { id: targetStashId, userId: { in: requireWikiUserIds(ctx) } },
          select: { id: true },
        });
        if (!ownStash) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this stash" });
        }
      } else {
        targetStashId = (await getOrCreateDefaultStash(ctx.db, requireWikiUserIds(ctx), userId)).id;
      }

      // 2. Serialize metadata into JSON note
      const note = JSON.stringify({
        category: input.category || null,
        role: input.role || null,
        gender: input.gender || null,
        setName: input.setName || null,
        values: cleanValues,
        lexiconDefinition: input.lexiconDefinition || null,
      });
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
            return standaloneEntry(
              await updateStandalone(db, input.id, input, cleanValues),
              userId,
              input
            );
          }
          throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
        }
        assertOwnsStashItem(existing, userId);

        item = await db.stashItem.update({
          where: { id: input.id },
          data: { pageTitle, pageSlug, note, stashId: targetStashId },
          include: { stash: true },
        });
      } else {
        // Create new stash item
        const contentType = input.type === "dictionary" ? "dictionary" : "name";
        item = await db.stashItem.upsert({
          where: {
            stashId_contentType_pageTitle: {
              stashId: targetStashId,
              contentType,
              pageTitle,
            },
          },
          create: {
            stashId: targetStashId,
            pageTitle,
            pageSlug,
            contentType,
            note,
          },
          update: { note },
          include: { stash: true },
        });
      }

      return mapStashItemToEntry(item, userId);
    }),

  /**
   * Delete a saved name or dictionary from the global Stash system or standalone NameBank.
   */
  deleteFromNameBank: rateLimitedMutationProcedure
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

      assertOwnsStashItem(existing, userId);

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
  cloneDictionary: rateLimitedMutationProcedure
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

      const defaultStash = await getOrCreateDefaultStash(ctx.db, requireWikiUserIds(ctx), userId);

      const note = JSON.stringify({
        category: source.category,
        values: source.values,
      });

      const title = `${source.title} (Clone)`;
      const slug = encodeURIComponent(title.replace(/ /g, "_"));

      const item = await db.stashItem.upsert({
        where: {
          stashId_contentType_pageTitle: {
            stashId: defaultStash.id,
            contentType: "dictionary",
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
  togglePublic: rateLimitedMutationProcedure
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

      assertOwnsStashItem(item, userId);

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
  logGeneration: rateLimitedMutationProcedure
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
