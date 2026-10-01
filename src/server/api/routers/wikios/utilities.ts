/**
 * utilities.ts — WikiOS Utilities & Health Diagnostics tRPC Router
 *
 * Provides high-speed PostgreSQL telemetry, link integrity scans, orphan detection,
 * dead-end checks, broken redirect sweeps, and governance audit logs.
 */

import { z } from "zod/v4";
import { adminProcedure, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { getWikiPermissions } from "~/lib/wiki-os/rights";
import { getSiteStats } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getInboundSyncStatus } from "~/lib/wiki-os/services/auto-sync-service";
import {
  discardMirrorJob,
  getMirrorStatus,
  requeueMirrorJob,
} from "~/lib/wiki-os/services/mirror-admin";
import { refusals } from "~/lib/wiki-os/permissions";

const mirrorJobInput = z.object({ id: z.string().min(1).max(64) });

export const wikiosUtilitiesRouter = createTRPCRouter({
  /**
   * High-Level Health & Ecosystem Telemetry (<5ms)
   */
  getHealthTelemetry: publicProcedure
    .input(z.object({ realm: z.string().default("ixwiki") }).optional())
    .query(async ({ input }) => {
      const realm = input?.realm || "ixwiki";

      const [
        pgArticles,
        pgArchived,
        pgAssets,
        pgRevisions,
        pgLinks,
        siteStats,
        orphans,
        deadEnds,
        brokenRedirects,
        inboundSync,
      ] = await Promise.all([
        db.wikiArticle
          .count({
            where: { source: realm, status: "PUBLISHED", namespace: 0 },
          })
          .catch(() => 0),
        db.wikiArticle
          .count({
            where: { source: realm, status: "ARCHIVED" },
          })
          .catch(() => 0),
        db.wikiAsset.count().catch(() => 0),
        db.wikiRevision.count().catch(() => 0),
        db.wikiLink.count().catch(() => 0),
        getSiteStats().catch(() => ({
          articles: 0,
          images: 0,
          edits: 0,
          pages: 0,
          users: 0,
          activeUsers: 0,
        })),
        PageManagementService.getOrphanPages(10, realm),
        PageManagementService.getDeadEndPages(10, realm),
        PageManagementService.getBrokenRedirects(10, realm),
        getInboundSyncStatus().catch(() => ({
          status: "UNKNOWN" as const,
          lastRunAt: null,
          failures: 0,
          lastError: null,
          repushSkipped: [],
        })),
      ]);

      const totalArticles = Math.max(siteStats.articles || 0, pgArticles || 0);
      const totalAssets = Math.max(siteStats.images || 0, pgAssets || 0);
      const totalRevisions = Math.max(siteStats.edits || 0, pgRevisions || 0);
      const totalPages = Math.max(siteStats.pages || 0, totalArticles);

      return {
        totalArticles,
        archivedArticles: pgArchived || 0,
        totalAssets,
        totalRevisions,
        totalLinks: pgLinks || 0,
        totalPages,
        orphanCount: orphans.length,
        deadEndCount: deadEnds.length,
        brokenRedirectCount: brokenRedirects.length,
        inboundSyncStatus: inboundSync.status,
        inboundSync,
        integrityScore:
          brokenRedirects.length === 0 ? 100 : Math.max(90, 100 - brokenRedirects.length),
      };
    }),

  /**
   * The outbound mirror's outbox for administrators: jobs by state, how long the oldest has waited, whether
   * the worker is stopped or has no bot account, and the last dead jobs (MediaWiki is out of sync for those titles).
   */
  getMirrorStatus: adminProcedure.query(() => getMirrorStatus()),

  /** Try a dead mirror job again from its first attempt. */
  requeueMirrorJob: adminProcedure.input(mirrorJobInput).mutation(async ({ input }) => {
    await refusals(requeueMirrorJob(input.id));
    return { success: true as const };
  }),

  /** Give up on a dead mirror job, so the jobs behind it for its title can run. */
  discardMirrorJob: adminProcedure.input(mirrorJobInput).mutation(async ({ input }) => {
    await refusals(discardMirrorJob(input.id));
    return { success: true as const };
  }),

  /**
   * Diagnostic: Orphan Articles (0 incoming links)
   */
  getOrphanArticles: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      return PageManagementService.getOrphanPages(input.limit, input.realm);
    }),

  /**
   * Diagnostic: Dead-End Articles (0 outgoing links)
   */
  getDeadEndArticles: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      return PageManagementService.getDeadEndPages(input.limit, input.realm);
    }),

  /**
   * Diagnostic: Broken Redirects
   */
  getBrokenRedirects: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      return PageManagementService.getBrokenRedirects(input.limit, input.realm);
    }),

  /**
   * Diagnostic: Shortest Published Articles (<150 bytes)
   */
  getShortestArticles: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input }) => {
      const articles = await db.wikiArticle.findMany({
        where: {
          source: input.realm,
          status: "PUBLISHED",
          namespace: 0,
          redirectTargetSlug: null,
        },
        orderBy: { wordCount: "asc" },
        take: input.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          wordCount: true,
          readingTime: true,
          updatedAt: true,
        },
      });

      return articles;
    }),

  /**
   * Diagnostic: Longest Published Articles
   */
  getLongestArticles: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input }) => {
      const articles = await db.wikiArticle.findMany({
        where: {
          source: input.realm,
          status: "PUBLISHED",
          namespace: 0,
          redirectTargetSlug: null,
        },
        orderBy: { wordCount: "desc" },
        take: input.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          wordCount: true,
          readingTime: true,
          updatedAt: true,
        },
      });

      return articles;
    }),

  /**
   * Governance: Soft-Deleted & Archived Articles
   */
  getArchivedArticles: publicProcedure
    .input(
      z.object({
        realm: z.string().default("ixwiki"),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      // The list of deleted pages is for those who may browse them; everyone else sees none.
      if (!(await getWikiPermissions(ctx)).rights.has("browsearchive")) return [];
      return db.wikiArticle.findMany({
        where: {
          source: input.realm,
          status: "ARCHIVED",
        },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          updatedAt: true,
        },
      });
    }),

  /**
   * Governance: System Event & Action Audit Logs
   */
  getAuditLogs: publicProcedure
    .input(
      z.object({
        action: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const where: { action?: string } = {};
      if (input.action && input.action !== "all") {
        where.action = input.action;
      }

      const [logs, total] = await Promise.all([
        db.wikiLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
          // Public: the actor is named by `actorName`; never the internal `userId` (plan 409 writes it).
          select: {
            id: true,
            logType: true,
            action: true,
            title: true,
            actorName: true,
            comment: true,
            params: true,
            createdAt: true,
          },
        }),
        db.wikiLog.count({ where }),
      ]);

      return {
        logs,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),
});
