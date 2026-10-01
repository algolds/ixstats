/**
 * page-views.ts — the read-only data behind the pages the `/wiki/<path>` route renders besides an
 * article: `?action=info`, `Special:AllPages` / `PrefixIndex`, `Category:` member lists and `File:`
 * pages. Thin: input validation, then the domain service in `~/lib/wiki-os/core`.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { CATEGORY_PAGE_SIZE, CategoryService } from "~/lib/wiki-os/core/category-service";
import { getFileInfo } from "~/lib/wiki-os/core/file-page-service";
import { getPageInfo } from "~/lib/wiki-os/core/page-info-service";
import { listPages } from "~/lib/wiki-os/core/page-list-service";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";

export const wikiosPageViewsRouter = createTRPCRouter({
  /** The facts `?action=info` shows about a page; a deleted page is "not found" to a reader who may not see it. */
  getPageInfo: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      const info = await getPageInfo(input.title);
      if (!info) {
        throw new TRPCError({ code: "NOT_FOUND", message: `"${input.title}" does not exist.` });
      }
      return info;
    }),

  /** `Special:AllPages` and `Special:PrefixIndex`: the pages of a namespace in title order. */
  listPages: publicProcedure
    .input(
      z.object({
        namespace: z.number().int().min(0).max(32767).default(0),
        prefix: z.string().max(255).default(""),
        from: z.string().max(255).default(""),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(({ input }) => listPages(input)),

  /** One page of a category's members, in MediaWiki's order. */
  getCategoryPage: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(500),
        /** The sort key to start at, or (with `after`) the sort key of the last member of the previous page. */
        from: z.string().max(255).default(""),
        /** The title of the last member of the previous page: start strictly after it. */
        after: z.string().max(255).default(""),
      })
    )
    .query(({ input }) =>
      CategoryService.getMemberPage(input.category, {
        from: input.from,
        after: input.after,
        limit: CATEGORY_PAGE_SIZE,
      })
    ),

  /** The file behind a `File:` page or `Special:FilePath`; null when WikiOS knows no such file. */
  getFileInfo: publicProcedure
    .input(z.object({ file: z.string().min(1).max(255) }))
    .query(({ input }) => getFileInfo(input.file)),
});
