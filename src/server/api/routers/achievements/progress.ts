import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { getWikiDbPool } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { achievementService } from "~/lib/achievements/service";

export const achievementsProgressRouter = createTRPCRouter({
  // Get recent achievements for a country

  // Get all achievements for a country

  // Get achievement leaderboard

  // Get current user's achievement progress statistics
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    return achievementService.getProgress(ctx.user.clerkUserId, ctx.db);
  }),

  getAllWithStatus: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        let targetUserId = input.userId;

        // If no user specified but countryId is provided, find country's owner/first user
        if (!targetUserId && input.countryId) {
          const user = await ctx.db.user.findFirst({
            where: { countryId: input.countryId },
            select: { clerkUserId: true },
          });
          if (user) targetUserId = user.clerkUserId;
        }

        // Fallback to logged-in user
        if (!targetUserId) {
          targetUserId = ctx.user?.clerkUserId || undefined;
        }

        // Fetch target user record to get wikiUsername
        const userRecord = targetUserId
          ? await ctx.db.user.findUnique({
              where: { clerkUserId: targetUserId },
              select: { wikiUsername: true },
            })
          : null;
        const wikiUsername = userRecord?.wikiUsername;

        // Get all active master achievements
        let masterAchievements = await ctx.db.achievement.findMany({
          where: { isActive: true },
          orderBy: { key: "asc" },
        });

        // Auto-sync if database achievements count doesn't match definitions registry
        const { ACHIEVEMENT_DEFINITIONS } = await import("~/lib/achievements/definitions");
        if (masterAchievements.length < ACHIEVEMENT_DEFINITIONS.length) {
          const { syncAchievements } = await import("~/lib/achievements/sync");
          await syncAchievements(ctx.db);
          // Re-fetch master achievements after sync
          masterAchievements = await ctx.db.achievement.findMany({
            where: { isActive: true },
            orderBy: { key: "asc" },
          });
        }

        // Get user's unlocked achievements if target user is known
        const userUnlocks = targetUserId
          ? await ctx.db.userAchievement.findMany({
              where: { userId: targetUserId },
            })
          : [];

        const unlockMap = new Map(userUnlocks.map((u) => [u.achievementId, u]));

        // Calculate global unlock stats
        const totalUsersCount = (await ctx.db.user.count()) || 1;
        const globalUnlocksGroup = await ctx.db.userAchievement.groupBy({
          by: ["achievementId"],
          _count: {
            achievementId: true,
          },
        });
        const countMap = new Map(
          globalUnlocksGroup.map((g) => [g.achievementId, g._count.achievementId])
        );

        // Map standard achievements
        const standardAchievements = masterAchievements.map((m) => {
          const unlock = unlockMap.get(m.key);
          let rewards = null;
          if (m.rewardsJson) {
            try {
              rewards = JSON.parse(m.rewardsJson);
            } catch (e) {
              // ignore
            }
          }

          const globalUnlocks = countMap.get(m.key) || 0;
          const globalUnlockPercent = Math.min(
            100.0,
            parseFloat(((globalUnlocks / totalUsersCount) * 100).toFixed(1))
          );

          return {
            key: m.key,
            title: m.title,
            description: m.description,
            category: m.category,
            rarity: m.rarity,
            points: m.points,
            iconUrl: m.iconUrl || "🏆",
            triggerType: m.triggerType,
            conditionJson: m.conditionJson,
            isUnlocked: !!unlock,
            unlockedAt: unlock ? unlock.unlockedAt.toISOString() : null,
            metadata: unlock ? unlock.metadata : null,
            rewards,
            globalUnlockPercent,
          };
        });

        // Query OOL stats for user if wikiUsername exists
        const oolStats = wikiUsername
          ? await ctx.db.lorewardUserStats.findUnique({
              where: { username: wikiUsername },
            })
          : null;

        // Calculate accurate global unlock percents among registered users
        const registeredUsersWithWiki = await ctx.db.user.findMany({
          where: {
            wikiUsername: { not: null },
          },
          select: {
            wikiUsername: true,
          },
        });
        const wikiUsernames = registeredUsersWithWiki
          .map((u) => u.wikiUsername)
          .filter(Boolean) as string[];
        const registeredUsernamesSet = new Set(wikiUsernames.map((name) => name.toLowerCase()));

        const activeUserStats =
          wikiUsernames.length > 0
            ? await ctx.db.lorewardUserStats.findMany({
                where: {
                  username: {
                    in: wikiUsernames,
                    mode: "insensitive",
                  },
                },
                select: {
                  username: true,
                  dailyWins: true,
                  weeklyWins: true,
                  monthlyWins: true,
                  totalScore: true,
                },
              })
            : [];

        // Query 50k edits for all registered wiki users
        const fiftyKEditsMap = new Map<string, number>();
        if (wikiUsernames.length > 0) {
          try {
            const oolPool = getWikiDbPool();
            const [rows] = (await oolPool.execute(
              `SELECT a.actor_name, COUNT(DISTINCT SUBSTRING(r.rev_timestamp, 1, 8), r.rev_page) as cnt
               FROM revision r
               JOIN actor a ON a.actor_id = r.rev_actor
               LEFT JOIN revision p2 ON p2.rev_id = r.rev_parent_id
               WHERE a.actor_name IN (${wikiUsernames.map(() => "?").join(",")})
                 AND (CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0)) >= 50000
               GROUP BY a.actor_name`,
              wikiUsernames
            )) as any[];

            for (const r of rows) {
              fiftyKEditsMap.set(String(r.actor_name).toLowerCase(), Number(r.cnt) || 0);
            }
          } catch (_err) {
            // MySQL unavailable in development mode — skip 50k edit counts
          }
        }

        // Fetch annual winners from LorewardEntry
        const annualWinners = await ctx.db.lorewardEntry.findMany({
          where: {
            type: "annual",
            status: "approved",
            winnerUser: { not: null },
          },
          select: {
            winnerUser: true,
          },
        });
        const annualWinsMap = new Map<string, number>();
        const annualWinnerNames = annualWinners
          .map((w) => w.winnerUser)
          .filter(Boolean) as string[];

        // Build annual wins map for earners percentage
        for (const w of annualWinnerNames) {
          const lowerName = w.toLowerCase();
          annualWinsMap.set(lowerName, (annualWinsMap.get(lowerName) ?? 0) + 1);
        }

        let bronzeEarnersCount = 0;
        let silverEarnersCount = 0;
        let goldEarnersCount = 0;
        let burgEarnersCount = 0;

        for (const username of wikiUsernames) {
          const lowerName = username.toLowerCase();
          const stats = activeUserStats.find((s) => s.username.toLowerCase() === lowerName);
          const dailyWins = stats?.dailyWins ?? 0;
          const weeklyWins = stats?.weeklyWins ?? 0;
          const monthlyWins = stats?.monthlyWins ?? 0;
          const annualWins = annualWinsMap.get(lowerName) ?? 0;
          const fiftyKEdits = fiftyKEditsMap.get(lowerName) ?? 0;

          const bronzeEver = dailyWins + fiftyKEdits;
          const silverFromBronze = Math.floor(bronzeEver / 10);
          const silverEver = weeklyWins + monthlyWins * 3 + silverFromBronze;
          const goldEver = Math.floor(silverEver / 5);
          const burgEver = annualWins + Math.floor(goldEver / 5);

          if (bronzeEver > 0) bronzeEarnersCount++;
          if (silverEver > 0) silverEarnersCount++;
          if (goldEver > 0) goldEarnersCount++;
          if (burgEver > 0) burgEarnersCount++;
        }

        const bronzeUnlockPercent = Math.min(
          100.0,
          parseFloat(((bronzeEarnersCount / totalUsersCount) * 100).toFixed(1))
        );
        const silverUnlockPercent = Math.min(
          100.0,
          parseFloat(((silverEarnersCount / totalUsersCount) * 100).toFixed(1))
        );
        const goldUnlockPercent = Math.min(
          100.0,
          parseFloat(((goldEarnersCount / totalUsersCount) * 100).toFixed(1))
        );
        const burgUnlockPercent = Math.min(
          100.0,
          parseFloat(((burgEarnersCount / totalUsersCount) * 100).toFixed(1))
        );

        // Target user specifics
        const targetLower = wikiUsername ? wikiUsername.toLowerCase() : "";
        const targetStats = activeUserStats.find((s) => s.username.toLowerCase() === targetLower);
        const targetDailyWins = targetStats?.dailyWins ?? 0;
        const targetWeeklyWins = targetStats?.weeklyWins ?? 0;
        const targetMonthlyWins = targetStats?.monthlyWins ?? 0;
        const targetAnnualWins = targetLower ? (annualWinsMap.get(targetLower) ?? 0) : 0;
        const targetFiftyKEdits = targetLower ? (fiftyKEditsMap.get(targetLower) ?? 0) : 0;

        const targetBronzeEver = targetDailyWins + targetFiftyKEdits;
        const targetSilverFromBronze = Math.floor(targetBronzeEver / 10);
        const targetSilverEver = targetWeeklyWins + targetMonthlyWins * 3 + targetSilverFromBronze;
        const targetGoldEver = Math.floor(targetSilverEver / 5);
        const targetBurgEver = targetAnnualWins + Math.floor(targetGoldEver / 5);

        const targetBronzeOwned = targetBronzeEver - targetSilverFromBronze * 10;
        const targetSilverOwned = targetSilverEver - Math.floor(targetSilverEver / 5) * 5;
        const targetGoldOwned =
          Math.floor(targetSilverEver / 5) - Math.floor(Math.floor(targetSilverEver / 5) / 5) * 5;
        const targetBurgOwned = targetBurgEver;

        const targetUnlockedAtStr = oolStats
          ? oolStats.updatedAt.toISOString()
          : new Date().toISOString();

        const oolMedals = [
          {
            key: "ool-bronze",
            title: "Bronze Lore Medal",
            description:
              "Daily Lore Award winner or 50k edit contributor. A daily win or a 50k edit conveys a bronze medal.",
            category: "Order of the Lore",
            rarity: "Common",
            points: 1,
            iconUrl:
              "https://upload.wikimedia.org/wikipedia/commons/5/54/%D0%91%D1%80%D0%BE%D0%BD%D0%B7%D0%B0%D0%B2%D1%8B_%D0%BC%D1%8D%D0%B4%D0%B0%D0%BB%D1%8C.svg",
            triggerType: "OOL_MEDAL",
            conditionJson: null,
            isUnlocked: targetBronzeEver > 0,
            unlockedAt: targetBronzeEver > 0 ? targetUnlockedAtStr : null,
            metadata: JSON.stringify({ count: targetBronzeOwned }),
            rewards: null,
            globalUnlockPercent: bronzeUnlockPercent,
          },
          {
            key: "ool-silver",
            title: "Silver Lore Medal",
            description:
              "Weekly or Monthly Lore Award winner, or upgraded from 10 Bronze medals. A weekly win conveys a silver medal; a monthly win awards three.",
            category: "Order of the Lore",
            rarity: "Rare",
            points: 10,
            iconUrl: "/images/ool-silver.svg",
            triggerType: "OOL_MEDAL",
            conditionJson: null,
            isUnlocked: targetSilverEver > 0,
            unlockedAt: targetSilverEver > 0 ? targetUnlockedAtStr : null,
            metadata: JSON.stringify({ count: targetSilverOwned }),
            rewards: null,
            globalUnlockPercent: silverUnlockPercent,
          },
          {
            key: "ool-gold",
            title: "Gold Lore Medal",
            description:
              "Upgraded from 5 Silver medals. Represents a significant accumulation of lore contributions.",
            category: "Order of the Lore",
            rarity: "Epic",
            points: 50,
            iconUrl: "/images/ool-gold.svg",
            triggerType: "OOL_MEDAL",
            conditionJson: null,
            isUnlocked: targetGoldEver > 0,
            unlockedAt: targetGoldEver > 0 ? targetUnlockedAtStr : null,
            metadata: JSON.stringify({ count: targetGoldOwned }),
            rewards: null,
            globalUnlockPercent: goldUnlockPercent,
          },
          {
            key: "ool-burg-cross",
            title: "Burg Cross Lore Medal",
            description:
              "Annual Lore Award winner, or upgraded from 5 Gold medals. An annual win or 5 Gold medals awards a platinum Burg cross medal.",
            category: "Order of the Lore",
            rarity: "Legendary",
            points: 250,
            iconUrl: "/images/ool-burg-cross.png",
            triggerType: "OOL_MEDAL",
            conditionJson: null,
            isUnlocked: targetBurgEver > 0,
            unlockedAt: targetBurgEver > 0 ? targetUnlockedAtStr : null,
            metadata: JSON.stringify({ count: targetBurgOwned }),
            rewards: null,
            globalUnlockPercent: burgUnlockPercent,
          },
        ];

        // Fetch Wiki article awards
        const allWikiAwards = await ctx.db.wikiArticleAward.findMany({
          orderBy: { awardedAt: "desc" },
        });

        const userWikiAwards = wikiUsername
          ? allWikiAwards.filter((a) => {
              const recipients = a.recipientUsers as string[] | null;
              return Array.isArray(recipients) && recipients.includes(wikiUsername);
            })
          : [];

        // Pre-calculate mapping from award name to registered earners count
        const awardRegisteredEarnersMap = new Map<string, number>();
        const awardsByName = new Map<string, typeof allWikiAwards>();
        for (const wa of allWikiAwards) {
          const list = awardsByName.get(wa.name) || [];
          list.push(wa);
          awardsByName.set(wa.name, list);
        }

        for (const [name, list] of awardsByName.entries()) {
          const earnersSet = new Set<string>();
          for (const wa of list) {
            if (wa.recipientUsers) {
              let parsedRecipients: string[] = [];
              if (typeof wa.recipientUsers === "string") {
                try {
                  parsedRecipients = JSON.parse(wa.recipientUsers);
                } catch (_) {}
              } else if (Array.isArray(wa.recipientUsers)) {
                parsedRecipients = wa.recipientUsers as string[];
              }
              for (const u of parsedRecipients) {
                if (typeof u === "string" && registeredUsernamesSet.has(u.toLowerCase())) {
                  earnersSet.add(u.toLowerCase());
                }
              }
            }
          }
          awardRegisteredEarnersMap.set(name, earnersSet.size);
        }

        const wikiAchievements = userWikiAwards.map((a) => {
          const registeredEarners = awardRegisteredEarnersMap.get(a.name) || 0;
          const globalUnlockPercent = Math.min(
            100.0,
            parseFloat(((registeredEarners / totalUsersCount) * 100).toFixed(1))
          );

          let rarity = "Uncommon";
          if (a.category === "FEATURED") rarity = "Epic";
          if (a.name.includes("100k")) rarity = "Legendary";
          if (a.name.includes("50k")) rarity = "Rare";

          return {
            key: `wiki-award-${a.id}`,
            title: `${a.name} on ${a.pageTitle}`,
            description: a.description || `Awarded for achievements on the ${a.pageTitle} article.`,
            category: "Wiki Milestones",
            rarity,
            points: 20,
            iconUrl: a.category === "FEATURED" ? "⭐" : "📝",
            triggerType: "WIKI_AWARD",
            conditionJson: null,
            isUnlocked: true,
            unlockedAt: a.awardedAt.toISOString(),
            metadata: JSON.stringify({ pageTitle: a.pageTitle, pageSlug: a.pageSlug }),
            rewards: null,
            globalUnlockPercent,
          };
        });

        return [...standardAchievements, ...oolMedals, ...wikiAchievements];
      } catch (error) {
        console.error("Error in getAllWithStatus:", error);
        return [];
      }
    }),

  // Admin action: Manually trigger baseline sync

  // User action: Retroactively sync collector achievements and titles

  // Unlock achievement (internal use & backward compatibility)
});
