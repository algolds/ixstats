/**
 * Platform metrics (account scope): wiki, forum, ThinkTank, cards, Lorewards and cross-platform
 * activity of one person. Every query is a count or a short indexed read. Ids differ by model:
 * `ctx.userId` (`User.id`) keys cards, the forum, Onoma and the wiki link; `ctx.clerkUserId` keys
 * ThinkPages, ThinkTanks and Vexel. Wiki activity and Lorewards are attributed only through a
 * VERIFIED ixwiki `WikiAccountLink` (a revision's `authorId` is never set, and the legacy
 * `User.wikiUsername` is unproven), so an unlinked user reads 0 for both. Streaks and the
 * Renaissance week use real UTC days and ISO weeks. Map edits are not loaded here: the account key
 * `mapEditsApproved` belongs to the nation loaders.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { weekKey } from "~/lib/achievements/time-buckets";
import { EXCLUDE_TROPHY_CARDS } from "~/lib/lorewards/trophy-cards";
import type { MetricContext, MetricLoader } from "./registry";
import { zeroed } from "./zeroed";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** How far back the posting streak and the Renaissance week look. */
const LOOKBACK_DAYS = 14;

const WIKI_KEYS = ["wikiEdits", "wikiArticlesCreated", "wikiDistinctPages"] as const;
const FORUM_KEYS = ["forumThreads", "forumReplies", "repliesReceived"] as const;
const THINKTANK_KEYS = ["thinkTankFounded", "thinkTankJoined"] as const;
const CARD_KEYS = [
  "packsOpened",
  "tradesCompleted",
  "auctionSales",
  "legendaryOwned",
  "deckValueExTrophy",
  "claimStreakDays",
] as const;
const LOREWARD_KEYS = [
  "lorewardDailyWins",
  "lorewardWeeklyWins",
  "lorewardMonthlyWins",
  "lorewardRunnerUps",
  "lorewardWinStreak",
] as const;
const CREATION_KEYS = ["onomaCreations", "vexelPublished"] as const;

const dayNumber = (d: Date): number => Math.floor(d.getTime() / DAY_MS);

/** The longest run of consecutive UTC days that each hold at least one date. */
export function longestDayRun(dates: Date[]): number {
  const days = [...new Set(dates.map(dayNumber))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/**
 * The daily-claim streak still standing: a claim today or yesterday keeps `MyVault.loginStreak`, an
 * older one has lapsed (the same rule the dividend settles by). No best-ever streak is stored.
 */
export function effectiveClaimStreak(
  vault: { loginStreak: number; lastLoginDate: Date | null } | null,
  now: Date
): number {
  if (!vault?.lastLoginDate) return 0;
  return dayNumber(now) - dayNumber(vault.lastLoginDate) <= 1 ? vault.loginStreak : 0;
}

/**
 * 1 when one of the current or previous ISO weeks holds a wiki edit, a post or reply, and card
 * activity (a pack opened, a trade accepted or a sale), else 0.
 */
export function renaissanceWeek(
  activity: { wiki: Date[]; posts: Date[]; cards: Date[] },
  now: Date
): number {
  const weeks = [weekKey(now), weekKey(new Date(now.getTime() - WEEK_MS))];
  const weeksOf = (dates: Date[]) => new Set(dates.map(weekKey));
  const [wiki, posts, cards] = [activity.wiki, activity.posts, activity.cards].map(weeksOf);
  return Number(weeks.some((w) => wiki!.has(w) && posts!.has(w) && cards!.has(w)));
}

/** The username of the user's verified ixwiki link (MediaWiki-normalised, as `WikiRevision.author` is). */
async function verifiedWikiUsername(db: PrismaClient, userId: string): Promise<string | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: { userId, source: "ixwiki", verifiedAt: { not: null } },
    select: { username: true },
  });
  return link?.username ?? null;
}

/** The author's live ixwiki revisions: exact match keeps the `author` index. */
const revisionsBy = (author: string): Prisma.WikiRevisionWhereInput => ({
  author,
  source: "ixwiki",
  parked: false,
  userDeleted: false,
});

export const wikiLoader: MetricLoader = {
  id: "platform-wiki",
  scope: "account",
  keys: WIKI_KEYS,
  async load({ db, userId }) {
    const username = await verifiedWikiUsername(db, userId);
    if (!username) return zeroed(WIKI_KEYS);
    const where = revisionsBy(username);
    const [wikiEdits, wikiArticlesCreated, pages] = await Promise.all([
      db.wikiRevision.count({ where }),
      db.wikiRevision.count({
        where: {
          ...where,
          parentRevisionId: null,
          article: { namespace: 0, redirectTargetSlug: null },
        },
      }),
      db.wikiRevision.groupBy({ by: ["articleId"], where }),
    ]);
    return { wikiEdits, wikiArticlesCreated, wikiDistinctPages: pages.length };
  },
};

export const forumLoader: MetricLoader = {
  id: "platform-forum",
  scope: "account",
  keys: FORUM_KEYS,
  async load({ db, userId }) {
    const [forumThreads, posts, repliesReceived] = await Promise.all([
      db.forumThread.count({ where: { authorUserId: userId, hidden: false } }),
      db.forumPost.count({ where: { authorUserId: userId, hidden: false } }),
      db.forumPost.count({
        where: {
          hidden: false,
          thread: { authorUserId: userId, hidden: false },
          OR: [{ authorUserId: null }, { authorUserId: { not: userId } }],
        },
      }),
    ]);
    // Every thread's opening post is the author's own post, so it is not a reply.
    return { forumThreads, forumReplies: Math.max(0, posts - forumThreads), repliesReceived };
  },
};

/** Realm boards are auto-created by whoever opens one, so they are neither founded nor joined. */
export const thinkTankLoader: MetricLoader = {
  id: "platform-thinktank",
  scope: "account",
  keys: THINKTANK_KEYS,
  async load({ db, clerkUserId }) {
    const [thinkTankFounded, thinkTankJoined] = await Promise.all([
      db.thinktankGroup.count({
        where: { createdBy: clerkUserId, isActive: true, type: { not: "realm_board" } },
      }),
      db.thinktankMember.count({
        where: {
          userId: clerkUserId,
          isActive: true,
          group: { createdBy: { not: clerkUserId }, isActive: true, type: { not: "realm_board" } },
        },
      }),
    ]);
    return { thinkTankFounded, thinkTankJoined };
  },
};

/** Dates of the user's human ThinkPages posts (reposts and auto-generated posts out) and visible forum posts. */
async function loadPostDates(
  { db, clerkUserId, userId }: MetricContext,
  since: Date
): Promise<Date[]> {
  const [thinkpages, forum] = await Promise.all([
    db.thinkpagesPost.findMany({
      where: {
        isAutoGenerated: false,
        repostOfId: null,
        account: { clerkUserId },
        createdAt: { gte: since },
      },
      select: { createdAt: true },
    }),
    db.forumPost.findMany({
      where: { authorUserId: userId, hidden: false, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);
  return [...thinkpages, ...forum].map((row) => row.createdAt);
}

export const postingStreakLoader: MetricLoader = {
  id: "platform-posting-streak",
  scope: "account",
  keys: ["postingStreakDays"],
  async load(ctx) {
    const since = new Date((dayNumber(ctx.now) - (LOOKBACK_DAYS - 1)) * DAY_MS);
    return { postingStreakDays: longestDayRun(await loadPostDates(ctx, since)) };
  },
};

const tradesOf = (userId: string) => ({
  status: "ACCEPTED",
  OR: [{ initiatorId: userId }, { recipientId: userId }],
});

/**
 * Card activity. A Legendary counts when it came from a pack or a trade (an NS import, a daily
 * claim or an achievement reward does not), and trophy cards are out of deck value.
 */
export const cardsLoader: MetricLoader = {
  id: "platform-cards",
  scope: "account",
  keys: CARD_KEYS,
  async load({ db, userId, now }) {
    const [packsOpened, tradesCompleted, auctionSales, legendaryOwned, owned, vault] =
      await Promise.all([
        db.userPack.count({ where: { userId, isOpened: true } }),
        db.tradeOffer.count({ where: tradesOf(userId) }),
        db.cardAuction.count({ where: { sellerId: userId, status: "COMPLETED" } }),
        db.cardOwnership.count({
          where: {
            ownerId: userId,
            cards: { rarity: "LEGENDARY", isRetired: false, ...EXCLUDE_TROPHY_CARDS },
            transferEvents: {
              some: { toUserId: userId, action: { in: ["PACK_OPEN", "TRADE"] } },
            },
          },
        }),
        db.cardOwnership.findMany({
          where: { ownerId: userId, cards: { isRetired: false, ...EXCLUDE_TROPHY_CARDS } },
          select: { quantity: true, cards: { select: { marketValue: true } } },
        }),
        db.myVault.findUnique({
          where: { userId },
          select: { loginStreak: true, lastLoginDate: true },
        }),
      ]);
    return {
      packsOpened,
      tradesCompleted,
      auctionSales,
      legendaryOwned,
      deckValueExTrophy: owned.reduce((sum, o) => sum + o.cards.marketValue * o.quantity, 0),
      claimStreakDays: effectiveClaimStreak(vault, now),
    };
  },
};

/** Loreward wins and runner-ups from the stats row of the linked wiki account (daily runner-ups only exist). */
export const lorewardsLoader: MetricLoader = {
  id: "platform-lorewards",
  scope: "account",
  keys: LOREWARD_KEYS,
  async load({ db, userId }) {
    const username = await verifiedWikiUsername(db, userId);
    const stats = username
      ? await db.lorewardUserStats.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        })
      : null;
    return {
      lorewardDailyWins: stats?.dailyWins ?? 0,
      lorewardWeeklyWins: stats?.weeklyWins ?? 0,
      lorewardMonthlyWins: stats?.monthlyWins ?? 0,
      lorewardRunnerUps: stats?.dailyRunnerUps ?? 0,
      lorewardWinStreak: stats?.longestStreak ?? 0,
    };
  },
};

export const renaissanceLoader: MetricLoader = {
  id: "platform-renaissance",
  scope: "account",
  keys: ["renaissanceWeek"],
  async load(ctx) {
    const { db, userId, now } = ctx;
    const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);
    const username = await verifiedWikiUsername(db, userId);
    // Without a verified link there is no wiki edit to find, so the week cannot be met.
    if (!username) return { renaissanceWeek: 0 };
    const [wiki, posts, packs, trades, sales] = await Promise.all([
      db.wikiRevision.findMany({
        where: { ...revisionsBy(username), createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      loadPostDates(ctx, since),
      db.userPack.findMany({
        where: { userId, isOpened: true, openedAt: { gte: since } },
        select: { openedAt: true },
      }),
      db.tradeOffer.findMany({
        where: { ...tradesOf(userId), respondedAt: { gte: since } },
        select: { respondedAt: true },
      }),
      db.cardAuction.findMany({
        where: {
          sellerId: userId,
          status: "COMPLETED",
          endTime: { gte: since, lte: now },
        },
        select: { endTime: true },
      }),
    ]);
    const cards = [
      ...packs.map((p) => p.openedAt),
      ...trades.map((t) => t.respondedAt),
      ...sales.map((s) => s.endTime),
    ].filter((d): d is Date => d !== null);
    return {
      renaissanceWeek: renaissanceWeek({ wiki: wiki.map((r) => r.createdAt), posts, cards }, now),
    };
  },
};

export const creationsLoader: MetricLoader = {
  id: "platform-creations",
  scope: "account",
  keys: CREATION_KEYS,
  async load({ db, userId, clerkUserId }) {
    const [onomaCreations, vexelPublished] = await Promise.all([
      db.languagePack.count({ where: { userId } }),
      db.heraldryAchievement.count({ where: { ownerId: clerkUserId, isPublished: true } }),
    ]);
    return { onomaCreations, vexelPublished };
  },
};

export const PLATFORM_LOADERS: MetricLoader[] = [
  wikiLoader,
  forumLoader,
  thinkTankLoader,
  postingStreakLoader,
  cardsLoader,
  lorewardsLoader,
  renaissanceLoader,
  creationsLoader,
];
