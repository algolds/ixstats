import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { invalidateConfigCache } from "~/lib/config-service";
import { generateSlug } from "~/lib/utils";
import { invalidateCache } from "~/lib/cache";
import { scoreDailyWikiOS } from "~/lib/lorewards";
import type { ScoringWeights } from "~/lib/lorewards";
import { fetchTemplateData, categorizeTemplate } from "~/lib/wiki-os/templates/template-registry";

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

  resyncWikiCache: adminProcedure
    .input(z.object({ countryId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.countryId) {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { name: true },
        });
        if (country) {
          await ctx.db.wikiCache.deleteMany({ where: { countryName: country.name } });
          await ctx.db.country.update({
            where: { id: input.countryId },
            data: { wikiLastSynced: new Date() },
          });
        }
        await invalidateCache(["countries."]);
        return { cleared: 1 };
      }
      // Clear all wiki cache
      const result = await ctx.db.wikiCache.deleteMany();
      await ctx.db.country.updateMany({
        data: { wikiLastSynced: new Date() },
      });
      await invalidateCache(["countries."]);
      return { cleared: result.count };
    }),

  createWikiArticleAward: adminProcedure
    .input(
      z.object({
        pageTitle: z.string(),
        category: z.string(),
        name: z.string(),
        description: z.string().optional(),
        recipientUsers: z.array(z.string()).optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const award = await ctx.db.wikiArticleAward.create({
        data: {
          pageTitle: input.pageTitle,
          pageSlug: generateSlug(input.pageTitle),
          category: input.category,
          name: input.name,
          description: input.description ?? null,
          recipientUsers: input.recipientUsers ? input.recipientUsers : undefined,
          metadata: input.metadata ?? null,
        },
      });
      await invalidateCache(["wiki."]);
      return award;
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
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.lorewardEntry.upsert({
        where: {
          date_type: {
            date: input.date,
            type: input.type,
          },
        },
        create: {
          date: input.date,
          type: input.type,
          winnerUser: input.winnerUser,
          winnerPage: input.winnerPage,
          winnerScore: input.winnerScore ?? null,
          winnerBytes: input.winnerBytes ?? null,
          runnerUpUser: input.runnerUpUser ?? null,
          runnerUpPage: input.runnerUpPage ?? null,
          runnerUpScore: input.runnerUpScore ?? null,
          runnerUpBytes: input.runnerUpBytes ?? null,
          status: input.status,
        },
        update: {
          winnerUser: input.winnerUser,
          winnerPage: input.winnerPage,
          winnerScore: input.winnerScore ?? null,
          winnerBytes: input.winnerBytes ?? null,
          runnerUpUser: input.runnerUpUser ?? null,
          runnerUpPage: input.runnerUpPage ?? null,
          runnerUpScore: input.runnerUpScore ?? null,
          runnerUpBytes: input.runnerUpBytes ?? null,
          status: input.status,
          syncedAt: new Date(),
        },
      });
      await invalidateCache(["lorewards."]);
      return entry;
    }),

  pushLorewardToBot: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        winner: z.object({
          user: z.string(),
          page: z.string(),
          score: z.number(),
          bytesAdded: z.number(),
        }),
        runnerUp: z
          .object({
            user: z.string(),
            page: z.string(),
            score: z.number(),
            bytesAdded: z.number(),
          })
          .optional()
          .nullable(),
        candidates: z
          .array(
            z.object({
              user: z.string(),
              page: z.string(),
              score: z.number(),
              bytesAdded: z.number(),
            })
          )
          .optional(),
        editCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      try {
        const response = await fetch(`${botUrl}/bot/lorewards/announce`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`Bot API returned HTTP ${response.status}`);
        }
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        console.error("Failed to push loreward to bot:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to notify bot: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
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

  getLorewardWeights: adminProcedure.query(async ({ ctx }) => {
    const keys = [
      "lorewardWeight_bytesAdded",
      "lorewardWeight_proseRatio",
      "lorewardWeight_editDepth",
      "lorewardWeight_collaborationBonus",
      "lorewardWeight_newArticleBonus",
    ];
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const weights = configs.reduce(
      (acc, config) => {
        acc[config.key] = parseFloat(config.value);
        return acc;
      },
      {
        lorewardWeight_bytesAdded: 1.0,
        lorewardWeight_proseRatio: 1.5,
        lorewardWeight_editDepth: 1.2,
        lorewardWeight_collaborationBonus: 1.3,
        lorewardWeight_newArticleBonus: 1.5,
      } as Record<string, number>
    );
    return weights;
  }),

  saveLorewardWeights: adminProcedure
    .input(
      z.object({
        lorewardWeight_bytesAdded: z.number(),
        lorewardWeight_proseRatio: z.number(),
        lorewardWeight_editDepth: z.number(),
        lorewardWeight_collaborationBonus: z.number(),
        lorewardWeight_newArticleBonus: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) => ({
        key,
        value: value.toString(),
      }));
      await ctx.db.$transaction(
        updates.map((cfg) =>
          ctx.db.systemConfig.upsert({
            where: { key: cfg.key },
            update: { value: cfg.value, updatedAt: new Date() },
            create: {
              key: cfg.key,
              value: cfg.value,
              description: `Loreward weight parameter for ${cfg.key}`,
            },
          })
        )
      );
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
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        proseWeight: z.number(),
        collaborativeBonus: z.number(),
        depthMaxBonus: z.number(),
        noveltyBonus: z.number(),
        importanceMaxBonus: z.number(),
      })
    )
    .query(async ({ input }) => {
      const tempWeights: ScoringWeights = {
        proseWeight: input.proseWeight,
        collaborativeBonus: input.collaborativeBonus,
        depthMaxBonus: input.depthMaxBonus,
        noveltyBonus: input.noveltyBonus,
        importanceMaxBonus: input.importanceMaxBonus,
        listPenalty: 0.3,
        minorOnlyPenalty: 0.2,
        minSingleEdit: 1000,
      };
      const result = await scoreDailyWikiOS(input.date, tempWeights);
      return result;
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
