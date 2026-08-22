// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getRecentChanges as getWikiBridgeRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getForumTrendingThreads } from "~/server/modules/forum";

// Input schemas
const activityFilterSchema = z.object({
  limit: z.number().min(1).max(80).default(20),
  cursor: z.string().optional(),
  filter: z
    .enum(["all", "achievements", "diplomatic", "economic", "social", "meta"])
    .default("all"),
  category: z.enum(["all", "game", "platform", "social"]).default("all"),
  userId: z.string().optional(),
});

const createActivitySchema = z.object({
  type: z.enum(["achievement", "diplomatic", "economic", "social", "meta"]),
  category: z.enum(["game", "platform", "social"]).default("game"),
  userId: z.string().optional(),
  countryId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
    )
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  visibility: z.enum(["public", "followers", "friends"]).default("public"),
  relatedCountries: z.array(z.string()).optional(),
});

const engagementActionSchema = z.object({
  activityId: z.string(),
  action: z.string(),
  userId: z.string(),
});

const commentActionSchema = z.object({
  activityId: z.string(),
  userId: z.string(),
  content: z.string().min(1).max(2000),
});

const getUserEngagementSchema = z.object({
  activityIds: z.array(z.string()),
  userId: z.string(),
});

export const activitiesTrendingRouter = createTRPCRouter({
  // Test mutation to debug parameter passing

  // Get global activity feed

  // Get feed from countries the user follows

  // Get user-specific activity feed

  // Create new activity

  // Handle engagement actions (like, unlike, share, view)

  // Add comment to activity

  // Get comments for an activity

  // Get user engagement state for activities

  // Get trending topics based on activity data
  getTrendingTopics: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(5),
        timeRange: z.enum(["1h", "6h", "24h", "7d"]).default("24h"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Calculate time range
        const now = new Date();
        let fromDate: Date;

        switch (input.timeRange) {
          case "1h":
            fromDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case "6h":
            fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case "24h":
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "7d":
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get trending activities with weighted engagement scoring
        const activities = await ctx.db.activityFeed.findMany({
          where: {
            createdAt: { gte: fromDate },
            visibility: "public",
          },
          select: {
            id: true,
            title: true,
            type: true,
            likes: true,
            comments: true,
            shares: true,
            views: true,
            createdAt: true,
          },
          take: 200,
        });

        // Calculate engagement score with weighted metrics
        const trendingActivities = activities
          .map((activity) => {
            // Weighted scoring: reshares worth 3x, comments worth 2x, likes worth 1x
            const engagementScore =
              activity.shares * 3 +
              activity.comments * 2 +
              activity.likes * 1 +
              activity.views * 0.1; // Views have minimal weight

            // Time decay factor (newer content gets bonus)
            const hoursSinceCreated =
              (Date.now() - activity.createdAt.getTime()) / (1000 * 60 * 60);
            const timeDecayFactor = Math.max(0.1, 1 - hoursSinceCreated / 24); // Decay over 24 hours

            const finalScore = engagementScore * timeDecayFactor;

            return {
              ...activity,
              engagementScore: finalScore,
              participants: activity.likes + activity.comments + activity.shares,
            };
          })
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, input.limit);

        // Transform to trending topics format
        const topics = trendingActivities.map((activity) => ({
          id: activity.id,
          title: activity.title,
          category: activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
          participants: activity.participants,
          trend: "up" as const,
        }));

        return topics;
      } catch (error) {
        console.error("Error fetching trending topics:", error);
        return [];
      }
    }),

  // Get activity statistics

  // Get country-specific activity feed combining ActivityFeed and ThinkPages posts

  // Country Follow System
  // Follow a country

  // Unfollow a country

  // Get countries that a country is following

  // Get countries that follow a country (followers)

  // Check if a country is following another

  // Get follow statistics for a country

  /**
   * Unified trending — cross-platform trending topics scored by engagement.
   * Aggregates: ThinkPages posts, forum threads, wiki page activity, IxStats activities.
   * Scoring: weighted engagement with time decay (newer content ranks higher).
   */
  getUnifiedTrending: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      type TrendingItem = {
        id: string;
        title: string;
        source: "thinkpages" | "forum" | "wiki" | "ixstats" | "crisis";
        score: number;
        engagement: { views: number; replies: number; likes: number; reposts: number };
        author?: string;
        url?: string;
        excerpt?: string;
        timestamp: string;
        isNew?: boolean;
      };

      const now = Date.now();
      const last48h = new Date(now - 48 * 60 * 60 * 1000);
      const items: TrendingItem[] = [];

      // Time decay: content from 0h ago = 1.0x, 48h ago = 0.1x
      const timeDecay = (ts: Date | string) => {
        const d = typeof ts === "string" ? new Date(ts) : ts;
        const time = isNaN(d.getTime()) ? now : d.getTime();
        return Math.max(0.1, 1 - (now - time) / (48 * 60 * 60 * 1000));
      };

      // ── 1. ThinkPages trending posts ──
      try {
        const posts = await ctx.db.thinkpagesPost.findMany({
          where: { visibility: "public", createdAt: { gte: last48h } },
          orderBy: { impressions: "desc" },
          take: 30,
          include: {
            account: { select: { username: true, displayName: true, verified: true } },
          },
        });

        for (const post of posts) {
          const raw =
            post.repostCount * 3 + post.replyCount * 2 + post.likeCount + post.impressions * 0.01;
          const score = raw * timeDecay(post.createdAt);
          let title = `@${post.account?.username ?? "unknown"}`;
          const cleanContent = post.content
            .replace(/<!--\s*sports-bulletin:[\s\S]*?-->/gi, "")
            .trim();
          const previewText = cleanContent || "Sports News Bulletin";
          let excerpt = previewText.length > 100 ? previewText.slice(0, 97) + "..." : previewText;
          let targetUrl = `/thinkpages/post/${post.id}`;
          const bulletinMatch = post.content.match(/<!--\s*sports-bulletin:([\s\S]*?)-->/i);
          if (bulletinMatch && bulletinMatch[1]) {
            try {
              const data = JSON.parse(bulletinMatch[1].trim());
              const emoji = data.sportEmoji || "⚽";
              const leagueName = data.league?.name || "League";
              if (data.isChampionBulletin) {
                title = `${emoji} ${leagueName} Champion Crowned!`;
                excerpt = `Congratulations to ${data.championName || "the champions"}!`;
                if (data.championId) targetUrl = `/myclub/${data.championId}`;
              } else if (data.isPlayoffBulletin) {
                title = `${emoji} ${leagueName} ${data.roundName || "Playoff"}`;
                excerpt = data.llmSummary
                  ? data.llmSummary.slice(0, 95) + "..."
                  : "Playoff round results and highlights";
                if (data.league?.id) targetUrl = `/myleague/${data.league.id}`;
              } else {
                title = `${emoji} ${leagueName} ${data.matchDay ? `— Matchday ${data.matchDay}` : ""}`;
                excerpt = data.llmSummary
                  ? data.llmSummary.slice(0, 95) + "..."
                  : "Latest matchday results and table movers";
                if (data.league?.id) targetUrl = `/myleague/${data.league.id}`;
              }
            } catch (_err) {
              title = `⚽ ${post.account?.displayName || "Sports News"}`;
            }
          } else if (post.account?.username === "SportsNews") {
            const firstLine = cleanContent.split("\n")[0] || "";
            title = firstLine ? firstLine.replace(/\*\*/g, "").slice(0, 40) : "⚽ Sports Bulletin";
          }

          items.push({
            id: `tp-${post.id}`,
            title,
            source: "thinkpages",
            score,
            engagement: {
              views: post.impressions,
              replies: post.replyCount,
              likes: post.likeCount,
              reposts: post.repostCount,
            },
            author: post.account?.displayName ?? post.account?.username,
            url: targetUrl,
            excerpt,
            timestamp: post.isAutoGenerated
              ? post.ixTimeTimestamp.toISOString()
              : post.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] ThinkPages failed:", error);
      }

      // ── 2. Forum threads ──
      try {
        const threads = await getForumTrendingThreads(25);
        for (const thread of threads) {
          // Forum engagement: views are significant, replies = comments
          const raw = thread.replyCount * 2 + thread.viewCount * 0.05;
          const score = raw * timeDecay(thread.timestamp);
          items.push({
            id: `forum-${thread.threadId}`,
            title: thread.title,
            source: "forum",
            score,
            engagement: {
              views: thread.viewCount,
              replies: thread.replyCount,
              likes: 0,
              reposts: 0,
            },
            author: thread.author,
            url: thread.url,
            timestamp: thread.timestamp.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Forum failed:", error);
      }

      // ── 3. Wiki trending pages ──
      try {
        // Build trending pages from recent changes (aggregated by title)
        const recentEdits = await getWikiBridgeRecentChanges(100);
        const pageMap = new Map<
          string,
          {
            title: string;
            editCount: number;
            uniqueEditors: Set<string>;
            totalBytesChanged: number;
            isNew: boolean;
            latestEdit: Date;
          }
        >();
        for (const rc of recentEdits) {
          const editDate = new Date(rc.timestamp);
          const validDate = isNaN(editDate.getTime()) ? new Date() : editDate;
          const existing = pageMap.get(rc.title);
          if (existing) {
            existing.editCount++;
            existing.uniqueEditors.add(rc.user);
            existing.totalBytesChanged += Math.abs(rc.newLen - rc.oldLen);
            if (rc.type === "new") existing.isNew = true;
            if (validDate > existing.latestEdit) {
              existing.latestEdit = validDate;
            }
          } else {
            pageMap.set(rc.title, {
              title: rc.title,
              editCount: 1,
              uniqueEditors: new Set([rc.user]),
              totalBytesChanged: Math.abs(rc.newLen - rc.oldLen),
              isNew: rc.type === "new",
              latestEdit: validDate,
            });
          }
        }
        const pages = [...pageMap.values()]
          .map((p) => ({ ...p, uniqueEditors: p.uniqueEditors.size }))
          .sort((a, b) => b.editCount - a.editCount)
          .slice(0, 25);
        for (const page of pages) {
          // Wiki engagement: edits = activity signal, multiple editors = collaborative interest
          // Byte changes proxy for content depth; new pages get a bonus
          const raw =
            page.editCount * 5 +
            page.uniqueEditors * 10 +
            Math.min(page.totalBytesChanged / 500, 20) +
            (page.isNew ? 15 : 0);
          const score = raw * timeDecay(page.latestEdit);
          items.push({
            id: `wiki-${page.title}`,
            title: page.title,
            source: "wiki",
            score,
            engagement: {
              views: 0,
              replies: 0,
              likes: 0,
              reposts: 0,
            },
            author: undefined,
            url: `/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
            excerpt: page.isNew
              ? `New page — ${page.editCount} edit${page.editCount > 1 ? "s" : ""} by ${page.uniqueEditors} editor${page.uniqueEditors > 1 ? "s" : ""}`
              : `${page.editCount} edit${page.editCount > 1 ? "s" : ""} by ${page.uniqueEditors} editor${page.uniqueEditors > 1 ? "s" : ""} (${page.totalBytesChanged > 0 ? "+" : ""}${page.totalBytesChanged} bytes)`,
            timestamp: page.latestEdit.toISOString(),
            isNew: page.isNew,
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Wiki failed:", error);
      }

      // ── 4. IxStats activities ──
      try {
        const activities = await ctx.db.activityFeed.findMany({
          where: { createdAt: { gte: last48h }, visibility: "public" },
          orderBy: { views: "desc" },
          take: 40,
          select: {
            id: true,
            title: true,
            type: true,
            likes: true,
            comments: true,
            shares: true,
            views: true,
            createdAt: true,
          },
        });

        for (const a of activities) {
          let baseScore = 5;
          if (a.type === "diplomatic") baseScore = 25;
          else if (a.type === "economic") baseScore = 20;
          else if (a.type === "achievement") baseScore = 15;
          else if (a.type === "meta") baseScore = 10;

          const raw = baseScore + a.shares * 3 + a.comments * 2 + a.likes + a.views * 0.01;
          const score = raw * timeDecay(a.createdAt);
          items.push({
            id: `ix-${a.id}`,
            title: a.title,
            source: "ixstats",
            score,
            engagement: {
              views: a.views,
              replies: a.comments,
              likes: a.likes,
              reposts: a.shares,
            },
            timestamp: a.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] IxStats activities failed:", error);
      }

      // ── 5. Crisis Events ──
      try {
        const crises = await ctx.db.crisisEvent.findMany({
          where: {
            responseStatus: { in: ["pending", "in_progress", "monitoring"] },
          },
          orderBy: [{ severity: "desc" }, { timestamp: "desc" }],
          take: 10,
        });

        for (const crisis of crises) {
          const baseScore =
            crisis.severity === "critical"
              ? 60
              : crisis.severity === "high"
                ? 45
                : crisis.severity === "medium"
                  ? 30
                  : 20;
          const score = baseScore * Math.max(0.4, timeDecay(crisis.timestamp));
          items.push({
            id: `crisis-${crisis.id}`,
            title: crisis.title,
            source: "crisis",
            score,
            engagement: {
              views: crisis.casualties ?? 0,
              replies: 0,
              likes: 0,
              reposts: 0,
            },
            excerpt: crisis.description ?? "Active international crisis requiring resolution.",
            timestamp: crisis.timestamp.toISOString(),
          });
        }
      } catch (error) {
        console.error("[UnifiedTrending] Crisis events failed:", error);
      }

      // Sort by score descending and return top items
      items.sort((a, b) => b.score - a.score);
      return { items: items.slice(0, input.limit), generatedAt: new Date().toISOString() };
    }),
});
