import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { cardArticleSourceSchema, cardWikiSourceSchema } from "~/lib/cards/card-sources";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import {
  CRAWL_MODES,
  MAX_CRAWL,
  MAX_SCAN,
  crawlImportTitles,
  startManualImport,
} from "~/server/modules/cards/cards.import-crawl";
import {
  MAX_IMPORT_TITLES,
  cancelImportJob,
  importJobItems,
  kickImportRunner,
  listImportJobs,
  retryImportJob,
} from "~/server/modules/cards/cards.import-jobs";
import { adminActor } from "~/server/shared/admin-actor";

const jobInput = z.object({ jobId: z.string().min(1) });

export const cardsAdminImportsRouter = createTRPCRouter({
  searchCategories: adminProcedure
    .input(
      z.object({
        source: cardArticleSourceSchema,
        prefix: z.string().max(100).default(""),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(({ input }) =>
      loreCardDiscovery.searchCategories(input.prefix, input.source, input.limit)
    ),

  categoryCounts: adminProcedure
    .input(
      z.object({
        source: cardArticleSourceSchema,
        categories: z.array(z.string().max(200)).max(50),
      })
    )
    .query(({ input }) => loreCardDiscovery.getCategoriesInfo(input.categories, input.source)),

  // A mutation, though it only reads: a pasted list of titles is too long for a query's URL. A list may also run past
  // one job; the crawl keeps the first MAX_CRAWL and says it cut the rest.
  crawl: adminProcedure
    .input(
      z.object({
        source: cardWikiSourceSchema,
        mode: z.enum(CRAWL_MODES),
        category: z.string().max(200).optional(),
        titles: z.array(z.string().max(300)).max(MAX_SCAN).optional(),
        limit: z.number().int().min(1).max(MAX_CRAWL).default(MAX_CRAWL),
      })
    )
    .mutation(({ ctx, input }) => crawlImportTitles(ctx.db, input)),

  start: adminProcedure
    .input(
      z.object({
        source: cardWikiSourceSchema,
        label: z.string().trim().min(1).max(200),
        titles: z.array(z.string().min(1).max(255)).min(1).max(MAX_IMPORT_TITLES),
      })
    )
    .mutation(({ ctx, input }) => startManualImport(ctx.db, adminActor(ctx), input)),

  jobs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(({ ctx, input }) => listImportJobs(ctx.db, input.limit)),

  items: adminProcedure
    .input(jobInput)
    .query(({ ctx, input }) => importJobItems(ctx.db, input.jobId)),

  cancel: adminProcedure
    .input(jobInput)
    .mutation(({ ctx, input }) => cancelImportJob(ctx.db, input.jobId)),

  retry: adminProcedure.input(jobInput).mutation(async ({ ctx, input }) => {
    await retryImportJob(ctx.db, input.jobId);
    kickImportRunner(ctx.db);
  }),

  /** Start a run now, for a job left waiting (no cron running, or the web process restarted). */
  resume: adminProcedure.mutation(({ ctx }) => {
    kickImportRunner(ctx.db);
  }),
});
