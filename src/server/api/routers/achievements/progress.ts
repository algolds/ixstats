import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";

const percentOf = (count: number, total: number) =>
  Math.min(100, parseFloat(((count / total) * 100).toFixed(1)));

/** Case-insensitive occurrence count. */
function tally(names: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

interface MedalWins {
  dailyWins: number;
  weeklyWins: number;
  monthlyWins: number;
  annualWins: number;
  fiftyKEdits: number;
}

/** Medals ever earned: 10 bronze -> silver, 5 silver -> gold, 5 gold -> burg cross. */
function medalLadder(w: MedalWins) {
  const bronze = w.dailyWins + w.fiftyKEdits;
  const silver = w.weeklyWins + w.monthlyWins * 3 + Math.floor(bronze / 10);
  const gold = Math.floor(silver / 5);
  const burg = w.annualWins + Math.floor(gold / 5);
  return { ever: [bronze, silver, gold, burg], owned: [bronze % 10, silver % 5, gold % 5, burg] };
}

const MEDALS = [
  {
    key: "ool-bronze",
    title: "Bronze Lore Medal",
    description:
      "Daily Lore Award winner or 50k edit contributor. A daily win or a 50k edit conveys a bronze medal.",
    rarity: "Common",
    points: 1,
    iconUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/54/%D0%91%D1%80%D0%BE%D0%BD%D0%B7%D0%B0%D0%B2%D1%8B_%D0%BC%D1%8D%D0%B4%D0%B0%D0%BB%D1%8C.svg",
  },
  {
    key: "ool-silver",
    title: "Silver Lore Medal",
    description:
      "Weekly or Monthly Lore Award winner, or upgraded from 10 Bronze medals. A weekly win conveys a silver medal; a monthly win awards three.",
    rarity: "Rare",
    points: 10,
    iconUrl: "/images/ool-silver.svg",
  },
  {
    key: "ool-gold",
    title: "Gold Lore Medal",
    description:
      "Upgraded from 5 Silver medals. Represents a significant accumulation of lore contributions.",
    rarity: "Epic",
    points: 50,
    iconUrl: "/images/ool-gold.svg",
  },
  {
    key: "ool-burg-cross",
    title: "Burg Cross Lore Medal",
    description:
      "Annual Lore Award winner, or upgraded from 5 Gold medals. An annual win or 5 Gold medals awards a platinum Burg cross medal.",
    rarity: "Legendary",
    points: 250,
    iconUrl: "/images/ool-burg-cross.png",
  },
];

function parseRecipients(value: Prisma.JsonValue | null): string[] {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as string[];
    } catch (err) {
      console.warn("[AchievementsProgress] Failed to parse recipientUsers JSON:", err);
      return [];
    }
  }
  return Array.isArray(value) ? (value as string[]) : [];
}

function wikiAwardRarity(award: { category: string | null; name: string }) {
  if (award.name.includes("50k")) return "Rare";
  if (award.name.includes("100k")) return "Legendary";
  return award.category === "FEATURED" ? "Epic" : "Uncommon";
}

/** The user whose progress is shown: the one asked for, else the country's owner, else the viewer. */
async function resolveTargetUserId(
  db: PrismaClient,
  input: { userId?: string; countryId?: string },
  viewerClerkId: string | undefined
) {
  if (input.userId) return input.userId;
  if (input.countryId) {
    const owner = await db.user.findFirst({
      where: { ownedCountries: { some: { id: input.countryId } } },
      select: { clerkUserId: true },
    });
    if (owner) return owner.clerkUserId;
  }
  return viewerClerkId || undefined;
}

async function loadMasterAchievements(db: PrismaClient) {
  const load = () =>
    db.achievement.findMany({ where: { isActive: true }, orderBy: { key: "asc" } });
  const masters = await load();
  // Auto-sync if the database is behind the definitions registry
  const { ACHIEVEMENT_DEFINITIONS } = await import("~/lib/achievements/definitions");
  if (masters.length >= ACHIEVEMENT_DEFINITIONS.length) return masters;
  const { syncAchievements } = await import("~/lib/achievements/sync");
  await syncAchievements(db);
  return load();
}

function parseRewards(rewardsJson: string | null) {
  if (!rewardsJson) return null;
  try {
    return JSON.parse(rewardsJson);
  } catch {
    return null;
  }
}

async function standardAchievements(
  db: PrismaClient,
  targetUserId: string | undefined,
  totalUsers: number
) {
  const masters = await loadMasterAchievements(db);
  const unlocks = targetUserId
    ? await db.userAchievement.findMany({ where: { userId: targetUserId } })
    : [];
  const unlockMap = new Map(unlocks.map((u) => [u.achievementId, u]));
  const globalUnlocks = await db.userAchievement.groupBy({
    by: ["achievementId"],
    _count: { achievementId: true },
  });
  const countMap = new Map(globalUnlocks.map((g) => [g.achievementId, g._count.achievementId]));

  return masters.map((m) => {
    const unlock = unlockMap.get(m.key);
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
      rewards: parseRewards(m.rewardsJson),
      globalUnlockPercent: percentOf(countMap.get(m.key) || 0, totalUsers),
    };
  });
}

/** 50k-byte revisions per registered wiki author (empty when the revision table is unpopulated). */
async function bigEditTally(db: PrismaClient, wikiUsernames: string[]) {
  if (wikiUsernames.length === 0) return new Map<string, number>();
  try {
    const bigRevs = await db.wikiRevision.findMany({
      where: { byteDelta: { gte: 50000 }, author: { in: wikiUsernames } },
      select: { author: true },
    });
    return tally(bigRevs.flatMap((r) => r.author || []));
  } catch {
    return new Map<string, number>();
  }
}

async function oolMedals(
  db: PrismaClient,
  wikiUsername: string | null | undefined,
  wikiUsernames: string[],
  totalUsers: number
) {
  const oolStats = wikiUsername
    ? await db.lorewardUserStats.findUnique({ where: { username: wikiUsername } })
    : null;
  const activeUserStats = wikiUsernames.length
    ? await db.lorewardUserStats.findMany({
        where: { username: { in: wikiUsernames, mode: "insensitive" } },
        select: {
          username: true,
          dailyWins: true,
          weeklyWins: true,
          monthlyWins: true,
          totalScore: true,
        },
      })
    : [];
  // First row wins for a case-insensitive username clash (reversed so the Map's last write is the first row).
  const statsByName = new Map(
    [...activeUserStats].reverse().map((s) => [s.username.toLowerCase(), s])
  );
  const fiftyKEdits = await bigEditTally(db, wikiUsernames);
  const annualWinners = await db.lorewardEntry.findMany({
    where: { type: "annual", status: "approved", winnerUser: { not: null } },
    select: { winnerUser: true },
  });
  const annualWins = tally(annualWinners.flatMap((w) => w.winnerUser || []));

  const laddersFor = (lowerName: string) => {
    const stats = statsByName.get(lowerName);
    return medalLadder({
      dailyWins: stats?.dailyWins ?? 0,
      weeklyWins: stats?.weeklyWins ?? 0,
      monthlyWins: stats?.monthlyWins ?? 0,
      annualWins: annualWins.get(lowerName) ?? 0,
      fiftyKEdits: fiftyKEdits.get(lowerName) ?? 0,
    });
  };

  const earners = [0, 0, 0, 0];
  for (const username of wikiUsernames) {
    laddersFor(username.toLowerCase()).ever.forEach((ever, tier) => {
      if (ever > 0) earners[tier] = (earners[tier] ?? 0) + 1;
    });
  }

  const target = laddersFor(wikiUsername ? wikiUsername.toLowerCase() : "");
  const unlockedAt = (oolStats ? oolStats.updatedAt : new Date()).toISOString();
  return MEDALS.map((medal, tier) => ({
    ...medal,
    category: "Order of the Lore",
    triggerType: "OOL_MEDAL",
    conditionJson: null,
    isUnlocked: target.ever[tier]! > 0,
    unlockedAt: target.ever[tier]! > 0 ? unlockedAt : null,
    metadata: JSON.stringify({ count: target.owned[tier] }),
    rewards: null,
    globalUnlockPercent: percentOf(earners[tier]!, totalUsers),
  }));
}

async function wikiAwardAchievements(
  db: PrismaClient,
  wikiUsername: string | null | undefined,
  registeredNames: Set<string>,
  totalUsers: number
) {
  const allAwards = await db.wikiArticleAward.findMany({ orderBy: { awardedAt: "desc" } });

  // Registered earners per award name
  const earnersByAward = new Map<string, Set<string>>();
  for (const award of allAwards) {
    const earners = earnersByAward.get(award.name) ?? new Set<string>();
    for (const user of parseRecipients(award.recipientUsers)) {
      if (typeof user === "string" && registeredNames.has(user.toLowerCase())) {
        earners.add(user.toLowerCase());
      }
    }
    earnersByAward.set(award.name, earners);
  }

  const userAwards = wikiUsername
    ? allAwards.filter(
        (a) => Array.isArray(a.recipientUsers) && a.recipientUsers.includes(wikiUsername)
      )
    : [];
  return userAwards.map((a) => ({
    key: `wiki-award-${a.id}`,
    title: `${a.name} on ${a.pageTitle}`,
    description: a.description || `Awarded for achievements on the ${a.pageTitle} article.`,
    category: "Wiki Milestones",
    rarity: wikiAwardRarity(a),
    points: 20,
    iconUrl: a.category === "FEATURED" ? "⭐" : "📝",
    triggerType: "WIKI_AWARD",
    conditionJson: null,
    isUnlocked: true,
    unlockedAt: a.awardedAt.toISOString(),
    metadata: JSON.stringify({ pageTitle: a.pageTitle, pageSlug: a.pageSlug }),
    rewards: null,
    globalUnlockPercent: percentOf(earnersByAward.get(a.name)?.size || 0, totalUsers),
  }));
}

export const achievementsProgressRouter = createTRPCRouter({
  getAllWithStatus: rateLimitedPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const targetUserId = await resolveTargetUserId(ctx.db, input, ctx.user?.clerkUserId);
        const userRecord = targetUserId
          ? await ctx.db.user.findUnique({
              where: { clerkUserId: targetUserId },
              select: { wikiUsername: true },
            })
          : null;
        const wikiUsername = userRecord?.wikiUsername;

        const totalUsers = (await ctx.db.user.count()) || 1;
        const standard = await standardAchievements(ctx.db, targetUserId, totalUsers);

        // Global unlock percents are measured among registered wiki users
        const registeredUsers = await ctx.db.user.findMany({
          where: { wikiUsername: { not: null } },
          select: { wikiUsername: true },
        });
        const wikiUsernames = registeredUsers.flatMap((u) => u.wikiUsername || []);

        const medals = await oolMedals(ctx.db, wikiUsername, wikiUsernames, totalUsers);
        const wikiAwards = await wikiAwardAchievements(
          ctx.db,
          wikiUsername,
          new Set(wikiUsernames.map((name) => name.toLowerCase())),
          totalUsers
        );
        return [...standard, ...medals, ...wikiAwards];
      } catch (error) {
        console.error("Error in getAllWithStatus:", error);
        return [];
      }
    }),
});
