import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import {
  getUserContribs,
  getUserInfo,
  getBacklinks,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";

import { LinkGraphService } from "~/lib/wiki-os/core";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";

export const wikiosUserTalkRouter = createTRPCRouter({
  /**
   * Get pages that link to the given page (backlinks / "What Links Here").
   * Native PostgreSQL Link Graph queried in O(1) time (<1ms).
   */
  getBacklinks: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertTitleVisible(ctx, input.title);
      // 1. Fast-path: Native PostgreSQL Directed Link Graph (<1ms)
      const nativeLinks = await LinkGraphService.getBacklinks(input.title, "ixwiki", input.limit);
      if (nativeLinks.length > 0) {
        return {
          links: nativeLinks.map((l) => ({
            pageid: 0,
            title: l.title,
            redirect: false,
          })),
          continueToken: null,
        };
      }

      // 2. Fallback: the bridge (PostgreSQL)
      const result: any = await getBacklinks(
        input.title,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined
      );

      const links = Array.isArray(result)
        ? result.map((r: any) => ({
            title: r.page_title || r.title || "Unknown",
            ns: r.page_namespace ?? r.ns ?? 0,
          }))
        : (result?.links ?? []);

      const hasMore = Array.isArray(result) ? false : !!result?.hasMore;

      return {
        links,
        continueToken: hasMore && links.length > 0 ? String(links.length) : null,
      };
    }),

  /**
   * Get user contributions.
   */
  getUserContribs: publicProcedure
    .input(
      z.object({
        user: z.string().min(1).max(200),
        limit: z.number().min(1).max(100).default(50),
        offset: z.string().optional(),
        namespace: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const ns = input.namespace ?? 0;
      // 1. Direct PostgreSQL + Action API fast path
      const contribs = await getUserContribs(
        input.user,
        input.limit,
        input.offset ? parseInt(input.offset, 10) : undefined,
        ns
      ).catch(() => []);

      if (contribs && contribs.length > 0) {
        return {
          contribs: contribs.map((c: any) => ({
            revid: c.rev_id || c.revid || 0,
            title: c.page_title || c.title || "",
            timestamp: c.rev_timestamp || c.timestamp || new Date().toISOString(),
            size: c.rev_len || c.size || 0,
            comment: c.rev_comment ?? c.comment ?? "",
            minor: Boolean(c.rev_minor_edit ?? c.minor),
            diff: c.diff ?? 0,
            isNew: Boolean(c.is_new ?? c.isNew),
            parked: c.parked === true,
          })),
          continueToken:
            contribs.length >= input.limit && contribs.length > 0
              ? String(contribs[contribs.length - 1]?.rev_id || "")
              : null,
        };
      }

      // 2. PostgreSQL native revisions fallback (case-insensitive)
      const cleanUser = input.user.trim();
      const nativeRevisions = await ctx.db.wikiRevision
        .findMany({
          where: {
            author: { equals: cleanUser, mode: "insensitive" },
            article: { namespace: ns, status: "PUBLISHED" },
          },
          include: {
            article: { select: { title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
        })
        .catch(() => []);

      const hasMore = nativeRevisions.length > input.limit;
      const sliced = hasMore ? nativeRevisions.slice(0, input.limit) : nativeRevisions;

      const fallbackContribs = sliced.map((rev) => ({
        revid: toRevisionRef(rev),
        title: rev.article?.title ?? "Untitled",
        timestamp: rev.createdAt.toISOString(),
        comment: rev.summary ?? "",
        size: rev.byteSize,
        minor: rev.minor,
        isNew: !rev.parentRevisionId,
        parked: rev.parked,
      }));

      return {
        contribs: fallbackContribs,
        continueToken: null,
      };
    }),

  /** Get MediaWiki user info: edit count, registration date, groups. */
  getUserInfo: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      // PostgreSQL (revisions and the rights engine), not a MediaWiki call
      return getUserInfo(input.username);
    }),
});
