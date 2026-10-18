import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateConfigCache } from "~/lib/config-service";
import { generateSlug } from "~/lib/utils";
import { invalidateCache } from "~/lib/cache";
import {
  DEFAULT_WEIGHTS,
  loadScoringWeights,
  lorewardWeightKey,
  scoreDailyWikiOS,
  TUNABLE_WEIGHTS,
} from "~/lib/lorewards";
import { categorizeTemplate } from "~/lib/wiki-os/templates/template-registry";
import { fetchTemplateData } from "~/lib/wiki-os/templates/template-engine.server";
import { tellBotOfOverride } from "~/lib/lorewards/bot-client";
import { overrideDateSchema } from "~/lib/lorewards/override-form";
import { adminActor } from "~/server/shared/admin-actor";
import { overrideLorewardEntry } from "~/server/modules/cards/cards.trophies";
import { writeConfigKeys } from "./_config-kv";

/** The scorer's tunable weights (WK-8): prose weight is a 0-1 blend, the rest bonuses/multipliers. */
const TunableWeightsInput = z.object({
  proseWeight: z.number().min(0).max(1),
  depthMaxBonus: z.number().min(0).max(5),
  noveltyBonus: z.number().min(0).max(5),
  importanceMaxBonus: z.number().min(0).max(5),
  listPenalty: z.number().min(0).max(5),
  minorOnlyPenalty: z.number().min(0).max(5),
}) satisfies z.ZodType<Record<(typeof TUNABLE_WEIGHTS)[number], number>>;

export const adminWikiRouter = createTRPCRouter({
  setWikiLink: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        wikiPageTitle: z.string().nullable(),
        wikiSource: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.country.update({
        where: { id: input.countryId },
        data: {
          wikiPageTitle: input.wikiPageTitle,
          wikiSource: input.wikiSource,
          wikiLastSynced: new Date(),
        },
        select: { id: true, name: true, wikiPageTitle: true, wikiSource: true },
      });
      await invalidateCache(["countries."]);
      return result;
    }),

  bulkSetWikiLinks: adminProcedure
    .input(
      z.object({
        links: z
          .array(
            z.object({
              countryId: z.string(),
              wikiPageTitle: z.string(),
              wikiSource: z.enum(["ixwiki", "iiwiki"]).default("ixwiki"),
            })
          )
          .max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.links.map((link) =>
          ctx.db.country.update({
            where: { id: link.countryId },
            data: {
              wikiPageTitle: link.wikiPageTitle,
              wikiSource: link.wikiSource,
              wikiLastSynced: new Date(),
            },
            select: { id: true, name: true },
          })
        )
      );
      await invalidateCache(["countries."]);
      return { updated: results.length, countries: results };
    }),

  deleteWikiArticleAward: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.wikiArticleAward.delete({
        where: { id: input.id },
      });
      await invalidateCache(["wiki."]);
      return deleted;
    }),

  getWikiArticleAwards: adminProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.category) {
        where.category = input.category;
      }
      if (input?.search) {
        where.pageTitle = {
          contains: input.search,
          mode: "insensitive",
        };
      }
      return ctx.db.wikiArticleAward.findMany({
        where,
        orderBy: { awardedAt: "desc" },
      });
    }),

  triggerLorewardScoring: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const result = await scoreDailyWikiOS(input.date);
      return result;
    }),

  saveLorewardWinnerOverride: adminProcedure
    .input(
      z.object({
        date: overrideDateSchema,
        type: z.enum(["daily", "weekly", "monthly"]).default("daily"),
        winnerUser: z.string(),
        winnerPage: z.string(),
        winnerScore: z.number().optional(),
        winnerBytes: z.number().optional(),
        runnerUpUser: z.string().optional().nullable(),
        runnerUpPage: z.string().optional().nullable(),
        runnerUpScore: z.number().optional().nullable(),
        runnerUpBytes: z.number().optional().nullable(),
        status: z.string().default("approved"),
      })
    )
    // The scored result is an override like any other: its places' trophies follow, no sync writes over it, and the
    // bot is told, to announce it, as `lorewards.overrideWinner` tells it (`botSynced` false when it could not be;
    // the override stands)
    .mutation(async ({ ctx, input }) => {
      const { date, type, status, ...fields } = input;
      const result = await overrideLorewardEntry(ctx.db, adminActor(ctx), {
        date,
        type,
        fields,
        status,
      });
      await invalidateCache(["lorewards."]);
      const botSynced = await tellBotOfOverride({ date: result.day, type, ...result.written });
      return { ...result, botSynced };
    }),

  purgeWikiCache: adminProcedure
    .input(z.object({ pageTitle: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.wikiCache.deleteMany({
        where: {
          OR: [{ key: input.pageTitle }, { key: { contains: input.pageTitle } }],
        },
      });
      await invalidateCache(["wiki."]);
      return { clearedCount: result.count };
    }),

  purgeAllWikiCache: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.wikiCache.deleteMany();
    await invalidateCache(["wiki."]);
    return { clearedCount: result.count };
  }),

  getWikiTemplatesList: adminProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.wikiTemplate.findMany({
      orderBy: { name: "asc" },
    });
    return templates;
  }),

  /** The weights daily scoring uses (stored values over the scorer's defaults). */
  getLorewardWeights: adminProcedure.query(async ({ ctx }) => {
    const weights = await loadScoringWeights(ctx.db);
    return Object.fromEntries(TUNABLE_WEIGHTS.map((f) => [f, weights[f]])) as Record<
      (typeof TUNABLE_WEIGHTS)[number],
      number
    >;
  }),

  saveLorewardWeights: adminProcedure
    .input(TunableWeightsInput)
    .mutation(async ({ ctx, input }) => {
      const updates = TUNABLE_WEIGHTS.map((field) => ({
        key: lorewardWeightKey(field),
        value: String(input[field]),
      }));
      await writeConfigKeys(ctx.db, updates, (key) => `Loreward weight parameter for ${key}`);
      invalidateConfigCache();
      return { success: true };
    }),

  createWikiArticleAwardBatch: adminProcedure
    .input(
      z.object({
        pageTitles: z.array(z.string().min(1)),
        category: z.string(),
        name: z.string(),
        description: z.string().optional(),
        recipientUsers: z.array(z.string()).optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = [];
      for (const title of input.pageTitles) {
        const award = await ctx.db.wikiArticleAward.create({
          data: {
            pageTitle: title,
            pageSlug: generateSlug(title),
            category: input.category,
            name: input.name,
            description: input.description ?? null,
            recipientUsers: input.recipientUsers ? input.recipientUsers : undefined,
            metadata: input.metadata ?? null,
          },
        });
        created.push(award);
      }
      await invalidateCache(["wiki."]);
      return created;
    }),

  evaluateWikiMilestones: adminProcedure
    .input(z.object({ pageTitles: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const articles = await ctx.db.wikiArticle.findMany({
        where: {
          source: "ixwiki",
          namespace: 0,
          status: "PUBLISHED",
          ...(input.pageTitles && input.pageTitles.length > 0
            ? { title: { in: input.pageTitles } }
            : {}),
        },
        select: {
          title: true,
          slug: true,
          wordCount: true,
          revisions: { select: { id: true, author: true } },
        },
      });

      const existingAwards = await ctx.db.wikiArticleAward.findMany({
        select: { pageTitle: true, category: true, name: true },
      });
      const existingSet = new Set(
        existingAwards.map((a) => `${a.pageTitle}|${a.category}|${a.name}`)
      );

      const createdAwards: any[] = [];

      for (const row of articles) {
        const pageTitle = row.title;
        const pageLen = (row.wordCount || 0) * 6;
        const editCount = row.revisions.length;
        const contributorCount = new Set(row.revisions.map((r) => r.author).filter(Boolean)).size;

        const addAwardIfNew = async (name: string, category: string, description: string) => {
          const key = `${pageTitle}|${category}|${name}`;
          if (!existingSet.has(key)) {
            const award = await ctx.db.wikiArticleAward.create({
              data: {
                pageTitle,
                pageSlug: generateSlug(pageTitle),
                category,
                name,
                description,
              },
            });
            createdAwards.push(award);
            existingSet.add(key);
          }
        };

        if (pageLen >= 100000) {
          await addAwardIfNew(
            "100k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 100,000 bytes of content."
          );
        } else if (pageLen >= 50000) {
          await addAwardIfNew(
            "50k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 50,000 bytes of content."
          );
        } else if (pageLen >= 10000) {
          await addAwardIfNew(
            "10k Prose Milestone",
            "EDITOR_MILESTONE",
            "Article reached 10,000 bytes of content."
          );
        }

        if (contributorCount >= 3) {
          await addAwardIfNew(
            "Collaborative Effort",
            "COLLABORATION",
            `Article co-authored by ${contributorCount} unique contributors.`
          );
        }

        if (editCount >= 50) {
          await addAwardIfNew(
            "Deep Dive",
            "SPECIAL",
            `Article has been revised ${editCount} times, showing extensive research depth.`
          );
        }
      }

      await invalidateCache(["wiki."]);
      return { createdCount: createdAwards.length, awards: createdAwards };
    }),

  previewLorewardScoring: adminProcedure
    .input(TunableWeightsInput.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { date, ...tunable } = input;
      return scoreDailyWikiOS(date, { ...DEFAULT_WEIGHTS, ...tunable });
    }),

  syncWikiTemplateByName: adminProcedure
    .input(z.object({ name: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const cleanName = input.name.replace(/^Template:/, "").trim();
      const tdMap = await fetchTemplateData([cleanName]);
      const td = tdMap.get(cleanName);
      if (!td) {
        throw new Error(`Template "${cleanName}" not found on wiki.`);
      }
      const category = categorizeTemplate(cleanName, td.description);
      const paramCount = Object.keys(td.params || {}).length;
      const synced = await ctx.db.wikiTemplate.upsert({
        where: { name: cleanName },
        create: {
          name: cleanName,
          description: td.description ?? null,
          category,
          templateData: td as any,
          paramCount,
          lastSynced: new Date(),
        },
        update: {
          description: td.description ?? null,
          category,
          templateData: td as any,
          paramCount,
          lastSynced: new Date(),
        },
      });
      return synced;
    }),

  syncWikiTemplatesByCategory: adminProcedure
    .input(z.object({ category: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const catKey = input.category.trim();
      const articles = await ctx.db.wikiArticle.findMany({
        where: {
          source: "ixwiki",
          namespace: 10,
          categories: {
            some: {
              category: {
                name: { equals: catKey, mode: "insensitive" },
              },
            },
          },
        },
        select: { title: true },
        take: 200,
      });

      if (articles.length === 0) {
        return {
          synced: 0,
          total: 0,
          message: `No templates found in category "${input.category}".`,
        };
      }

      const names = articles.map((r) => r.title.replace(/^Template:/i, ""));
      const tdMap = await fetchTemplateData(names);
      let syncedCount = 0;

      for (const [name, td] of tdMap) {
        const cat = categorizeTemplate(name, td.description);
        await ctx.db.wikiTemplate.upsert({
          where: { name },
          create: {
            name,
            description: td.description ?? null,
            category: cat,
            templateData: td as any,
            paramCount: Object.keys(td.params || {}).length,
            lastSynced: new Date(),
          },
          update: {
            description: td.description ?? null,
            category: cat,
            templateData: td as any,
            paramCount: Object.keys(td.params || {}).length,
            lastSynced: new Date(),
          },
        });
        syncedCount++;
      }

      return { synced: syncedCount, total: names.length };
    }),

  searchMediaWikiTemplates: adminProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) return [];
      const clean = input.query.trim();
      const templates = await ctx.db.wikiTemplate.findMany({
        where: {
          name: { contains: clean, mode: "insensitive" },
        },
        take: 10,
        select: { name: true },
      });
      if (templates.length > 0) return templates.map((t) => t.name);

      const articles = await ctx.db.wikiArticle.findMany({
        where: {
          namespace: 10,
          title: { contains: clean, mode: "insensitive" },
        },
        take: 10,
        select: { title: true },
      });
      return articles.map((a) => a.title.replace(/^Template:/i, ""));
    }),

  searchWikiUsers: adminProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const clean = input.query.trim();
      const users = await ctx.db.user.findMany({
        where: {
          wikiUsername: { contains: clean, mode: "insensitive" },
        },
        take: input.limit,
        select: {
          wikiUsername: true,
        },
      });

      const stats = await ctx.db.lorewardUserStats.findMany({
        where: {
          username: { contains: clean, mode: "insensitive" },
        },
        take: input.limit,
        select: { username: true, totalScore: true },
      });

      const resultsMap = new Map<string, number>();
      for (const u of users) {
        if (u.wikiUsername) resultsMap.set(u.wikiUsername, 0);
      }
      for (const s of stats) {
        resultsMap.set(s.username, s.totalScore);
      }

      return Array.from(resultsMap.entries()).map(([username, editCount]) => ({
        username,
        editCount,
      }));
    }),
});
