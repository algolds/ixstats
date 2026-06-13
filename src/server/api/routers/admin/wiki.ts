// src/server/api/routers/admin.ts
// FIXED: Complete admin router with proper functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
} from "~/server/api/trpc";
import {
  invalidateConfigCache,
} from "~/lib/config-service";


import { generateSlug } from "~/lib/slug-utils";
import { invalidateCache } from "~/lib/trpc-cache";
import { scoreDailyWikiOS } from "~/lib/lorewards-scoring";
import type { ScoringWeights } from "~/lib/lorewards-scoring";
import * as mysql from "mysql2/promise";
import { getWikiDbPool } from "~/lib/wiki-bridge";
import { fetchTemplateData, categorizeTemplate } from "~/lib/wiki-os/template-registry";

export const adminWikiRouter = createTRPCRouter({
  // Internal calculation formulas management
  // Get global statistics for SDI interface

  // Get stash statistics (real DB values)

  // Get ThinkPages statistics (real DB values)

  // Get system status

  // Get bot status with health check

  // Get system configuration (includes all economic control parameters)

  // Save system configuration (all economic control parameters)

  // Set custom time via bot or local override

  // Bot control operations

  // Get calculation logs

  // Analyze import file

  // Import roster data

  // Sync epoch time with imported data

  // Force recalculation of all countries

  // Get system health

  // --- Clerk User-Country Mapping Endpoints ---
  // Note: User procedures are commented out until User model is properly configured


  // Sync with Discord bot

  // === ADMIN USER/COUNTRY MANAGEMENT ENDPOINTS ===

  // List all users and their claimed countries

  // List all countries and their assigned users

  // Assign a user to a country (admin override)

  // Unassign a user from a country (admin override)

  // Get navigation settings (wiki/cards/labs visibility)

  // Update navigation settings (wiki/cards/labs visibility)

  // ============================================================================
  // GOD MODE - DIRECT COUNTRY DATA MANIPULATION
  // ============================================================================

  // ============================================================================
  // DIPLOMATIC OPTIONS MANAGEMENT
  // ============================================================================

  // ============================================================================
  // PHASE 2: COUNTRY GRID & UPCOMING EVENTS
  // ============================================================================

  // ============================================================================
  // STORYTELLER / WORLD EVENTS
  // ============================================================================

  // Event Chains

  // ─── Wiki Link Management ──────────────────────────────────────────

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
      const db = getWikiDbPool();

      let query = `
        SELECT 
          p.page_id, 
          p.page_title, 
          p.page_len, 
          COUNT(r.rev_id) as edit_count, 
          COUNT(DISTINCT r.rev_actor) as contributor_count
        FROM page p
        LEFT JOIN revision r ON r.rev_page = p.page_id
        WHERE p.page_namespace = 0 AND p.page_is_redirect = 0
      `;
      const queryParams: any[] = [];
      if (input.pageTitles && input.pageTitles.length > 0) {
        const titles = input.pageTitles.map((t) => t.trim().replace(/ /g, "_"));
        query += ` AND p.page_title IN (${titles.map(() => "?").join(",")}) `;
        queryParams.push(...titles);
      }
      query += ` GROUP BY p.page_id, p.page_title, p.page_len `;

      const [rows] = await db.execute<mysql.RowDataPacket[]>(query, queryParams);

      const existingAwards = await ctx.db.wikiArticleAward.findMany({
        select: { pageTitle: true, category: true, name: true },
      });
      const existingSet = new Set(
        existingAwards.map((a) => `${a.pageTitle}|${a.category}|${a.name}`)
      );

      const createdAwards: any[] = [];

      for (const row of rows) {
        const pageTitle = String(row.page_title).replace(/_/g, " ");
        const pageLen = Number(row.page_len);
        const editCount = Number(row.edit_count);
        const contributorCount = Number(row.contributor_count);

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
      const db = getWikiDbPool();
      const catKey = input.category.trim().replace(/ /g, "_");

      const [rows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT p.page_title 
         FROM page p
         JOIN categorylinks cl ON cl.cl_from = p.page_id
         WHERE p.page_namespace = 10 AND cl.cl_to = ?`,
        [catKey]
      );

      if (rows.length === 0) {
        return {
          synced: 0,
          total: 0,
          message: `No templates found in category "${input.category}".`,
        };
      }

      const names = rows.map((r) => String(r.page_title).replace(/_/g, " "));
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
    .query(async ({ input }) => {
      if (!input.query.trim()) return [];
      const db = getWikiDbPool();
      const searchKey = `%${input.query.trim().replace(/ /g, "_")}%`;
      const [rows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT page_title 
         FROM page 
         WHERE page_namespace = 10 AND page_is_redirect = 0 AND page_title LIKE ?
         LIMIT 10`,
        [searchKey]
      );
      return rows.map((r) => String(r.page_title).replace(/_/g, " "));
    }),

  getCronSchedules: adminProcedure.query(async ({ ctx }) => {
    const keys = [
      "cronSchedule_lorewardsScoring",
      "cronSchedule_passiveIncome",
      "cronSchedule_cardValue",
    ];
    const configs = await ctx.db.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const schedules = configs.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {
        cronSchedule_lorewardsScoring: "0 6 * * *",
        cronSchedule_passiveIncome: "0 0 * * *",
        cronSchedule_cardValue: "0 */6 * * *",
      } as Record<string, string>
    );
    return schedules;
  }),

  saveCronSchedules: adminProcedure
    .input(
      z.object({
        cronSchedule_lorewardsScoring: z.string(),
        cronSchedule_passiveIncome: z.string(),
        cronSchedule_cardValue: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates = Object.entries(input).map(([key, value]) => ({
        key,
        value: value.trim(),
      }));
      await ctx.db.$transaction(
        updates.map((cfg) =>
          ctx.db.systemConfig.upsert({
            where: { key: cfg.key },
            update: { value: cfg.value, updatedAt: new Date() },
            create: {
              key: cfg.key,
              value: cfg.value,
              description: `Cron schedule expression for ${cfg.key}`,
            },
          })
        )
      );
      invalidateConfigCache();
      return { success: true };
    }),

  searchWikiUsers: adminProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = getWikiDbPool();
      try {
        const patternUnderscore = `%${input.query.trim().replace(/ /g, "_")}%`;
        const patternSpace = `%${input.query.trim().replace(/_/g, " ")}%`;
        const [rows] = await db.execute<mysql.RowDataPacket[]>(
          `SELECT user_name, user_editcount 
           FROM user 
           WHERE user_name LIKE ? OR user_name LIKE ?
           ORDER BY user_editcount DESC 
           LIMIT ?`,
          [patternUnderscore, patternSpace, input.limit]
        );
        return (rows ?? []).map((row) => ({
          username: String(row.user_name),
          editCount: Number(row.user_editcount) || 0,
        }));
      } catch (err) {
        console.error("Failed to search MediaWiki users:", err);
        return [];
      }
    })
});

// getWikiDbPool is now imported from "~/lib/wiki-bridge"
