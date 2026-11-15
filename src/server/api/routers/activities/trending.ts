import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRENDING_CONFIG, topicRank } from "~/lib/thinkpages/trending";

export const activitiesTrendingRouter = createTRPCRouter({
  /**
   * Trending hashtags, as written to `TrendingTopic` by the thinkpages-trending cron job over
   * its engagement window. Empty when nothing qualifies (no fallback content).
   */
  getTrendingTopics: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(10).default(5),
        })
        .default({ limit: 5 })
    )
    .query(async ({ ctx, input }) => {
      try {
        const rows = await ctx.db.trendingTopic.findMany({
          where: { isActive: true },
          select: {
            id: true,
            hashtag: true,
            postCount: true,
            engagement: true,
            peakTimestamp: true,
          },
          take: TRENDING_CONFIG.maxTopics,
        });
        const risingSince = Date.now() - TRENDING_CONFIG.risingHours * 60 * 60 * 1000;
        return (rows ?? [])
          .sort((a, b) => topicRank(b) - topicRank(a) || a.hashtag.localeCompare(b.hashtag))
          .slice(0, input.limit)
          .map((topic) => ({
            id: topic.id,
            hashtag: topic.hashtag,
            title: `#${topic.hashtag}`,
            category: "Hashtag",
            postCount: topic.postCount,
            engagement: topic.engagement,
            // "up" while the topic hit a new high recently; otherwise holding steady.
            trend: (topic.peakTimestamp.getTime() >= risingSince ? "up" : "steady") as
              "up" | "steady",
          }));
      } catch (error) {
        console.error("Error fetching trending topics:", error);
        return [];
      }
    }),

});
