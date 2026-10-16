/**
 * Platform metrics (account scope): wiki, forum, ThinkTank, cards, Lorewards and cross-platform
 * activity of one person. Every query is a count or a short indexed read. Ids differ by model:
 * `ctx.userId` (`User.id`) keys cards, the forum, Onoma and the wiki link; `ctx.clerkUserId` keys
 * ThinkPages, ThinkTanks and Vexel. Wiki activity and Lorewards are attributed only through a
 * VERIFIED ixwiki `WikiAccountLink` (a revision's `authorId` is never set, and the legacy
 * `User.wikiUsername` is unproven), so an unlinked user reads 0 for both. Streaks and the
 * Renaissance week use real UTC days and ISO weeks. Map edits are not loaded here: the account key
 * `mapEditsApproved` belongs to the nation loaders.
 *
 * Loader budget: at most 3 indexed queries each, and never a row list that grows with the user's
 * history. Sums, distinct counts and "is there a week with all three" are single aggregate raw
 * queries (parameterised), and the verified wiki username is resolved once per evaluation.
 */
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
const CARD_ACTIVITY_KEYS = ["packsOpened", "tradesCompleted", "auctionSales"] as const;
const CARD_DECK_KEYS = ["legendaryOwned", "deckValueExTrophy", "claimStreakDays"] as const;
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

const usernames = new WeakMap<MetricContext, Promise<string | null>>();

/**
 * The username of the user's verified ixwiki link (MediaWiki-normalised, as `WikiRevision.author` is).
 * The wiki, Lorewards and Renaissance loaders share one evaluation's context, so it is read once.
 */
function verifiedWikiUsername(ctx: MetricContext): Promise<string | null> {
  let username = usernames.get(ctx);
  if (!username) {
    username = ctx.db.wikiAccountLink
      .findFirst({
        where: { userId: ctx.userId, source: "ixwiki", verifiedAt: { not: null } },
        select: { username: true },
      })
      .then((link) => link?.username ?? null);
    usernames.set(ctx, username);
  }
  return username;
}

/** Edits, articles created (first revision of a main-namespace non-redirect page) and distinct pages, in one pass. */
export const wikiLoader: MetricLoader = {
  id: "platform-wiki",
  scope: "account",
  keys: WIKI_KEYS,
  async load(ctx) {
    const username = await verifiedWikiUsername(ctx);
    if (!username) return zeroed(WIKI_KEYS);
    const [row] = await ctx.db.$queryRaw<Array<{ edits: number; created: number; pages: number }>>`
      SELECT COUNT(*)::int AS edits,
        (COUNT(*) FILTER (WHERE r."parentRevisionId" IS NULL AND a.namespace = 0
          AND a."redirectTargetSlug" IS NULL))::int AS created,
        COUNT(DISTINCT r."articleId")::int AS pages
      FROM wiki_revisions r
      JOIN wiki_articles a ON a.id = r."articleId"
      WHERE r.author = ${username} AND r.source = 'ixwiki' AND r.parked = false
        AND r."userDeleted" = false`;
    return {
      wikiEdits: row?.edits ?? 0,
      wikiArticlesCreated: row?.created ?? 0,
      wikiDistinctPages: row?.pages ?? 0,
    };
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

/** Human ThinkPages posts (reposts and auto-generated out) and visible forum posts: at most one row per UTC day. */
export const postingStreakLoader: MetricLoader = {
  id: "platform-posting-streak",
  scope: "account",
  keys: ["postingStreakDays"],
  async load({ db, clerkUserId, userId, now }) {
    const since = new Date((dayNumber(now) - (LOOKBACK_DAYS - 1)) * DAY_MS);
    const days = await db.$queryRaw<Array<{ day: Date }>>`
      SELECT p."createdAt"::date AS day
      FROM "ThinkpagesPost" p
      JOIN "ThinkpagesAccount" a ON a.id = p."accountId"
      WHERE a."clerkUserId" = ${clerkUserId} AND p."isAutoGenerated" = false
        AND p."repostOfId" IS NULL AND p."createdAt" >= ${since}
      UNION
      SELECT f."createdAt"::date
      FROM forum_posts f
      WHERE f."authorUserId" = ${userId} AND f.hidden = false AND f."createdAt" >= ${since}`;
    return { postingStreakDays: longestDayRun(days.map((row) => row.day)) };
  },
};

const tradesOf = (userId: string) => ({
  status: "ACCEPTED",
  OR: [{ initiatorId: userId }, { recipientId: userId }],
});

export const cardsActivityLoader: MetricLoader = {
  id: "platform-cards-activity",
  scope: "account",
  keys: CARD_ACTIVITY_KEYS,
  async load({ db, userId }) {
    const [packsOpened, tradesCompleted, auctionSales] = await Promise.all([
      db.userPack.count({ where: { userId, isOpened: true } }),
      db.tradeOffer.count({ where: tradesOf(userId) }),
      db.cardAuction.count({ where: { sellerId: userId, status: "COMPLETED" } }),
    ]);
    return { packsOpened, tradesCompleted, auctionSales };
  },
};

/**
 * Deck standing. A Legendary counts when it came from a pack or a trade (an NS import, a daily
 * claim or an achievement reward does not). Trophy cards are out of the deck value, which is summed
 * in the database (the copy value of every live copy).
 */
export const cardsDeckLoader: MetricLoader = {
  id: "platform-cards-deck",
  scope: "account",
  keys: CARD_DECK_KEYS,
  async load({ db, userId, now }) {
    const [legendaryOwned, deck, vault] = await Promise.all([
      db.cardOwnership.count({
        where: {
          ownerId: userId,
          cards: { rarity: "LEGENDARY", isRetired: false, ...EXCLUDE_TROPHY_CARDS },
          transferEvents: {
            some: { toUserId: userId, action: { in: ["PACK_OPEN", "TRADE"] } },
          },
        },
      }),
      // The sum is `copyValue` (src/lib/cards/copy-value.ts) in SQL: keep it equal to COPY_VALUE_SQL.
      db.$queryRaw<Array<{ value: number }>>`
        SELECT COALESCE(SUM(c."marketValue"), 0)::float8 AS value
        FROM "CardOwnership" o
        JOIN cards c ON c.id = o."cardId"
        WHERE o."ownerId" = ${userId} AND c."isRetired" = false AND c."cardType" <> 'TROPHY'`,
      db.myVault.findUnique({
        where: { userId },
        select: { loginStreak: true, lastLoginDate: true },
      }),
    ]);
    return {
      legendaryOwned,
      deckValueExTrophy: deck[0]?.value ?? 0,
      claimStreakDays: effectiveClaimStreak(vault, now),
    };
  },
};

/** Loreward wins and runner-ups from the stats row of the linked wiki account (daily runner-ups only exist). */
export const lorewardsLoader: MetricLoader = {
  id: "platform-lorewards",
  scope: "account",
  keys: LOREWARD_KEYS,
  async load(ctx) {
    const username = await verifiedWikiUsername(ctx);
    const stats = username
      ? await ctx.db.lorewardUserStats.findFirst({
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

/**
 * 1 when the current or previous ISO week holds a wiki edit, a human post or reply, and card
 * activity (a pack opened, a trade accepted or a sale). One query: the distinct (kind, ISO week)
 * pairs of the last 14 days, kept where all three kinds meet. Week keys match `weekKey`.
 */
export const renaissanceLoader: MetricLoader = {
  id: "platform-renaissance",
  scope: "account",
  keys: ["renaissanceWeek"],
  async load(ctx) {
    const { db, userId, clerkUserId, now } = ctx;
    const username = await verifiedWikiUsername(ctx);
    // Without a verified link there is no wiki edit to find, so the week cannot be met.
    if (!username) return { renaissanceWeek: 0 };
    const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);
    const weeks = [weekKey(now), weekKey(new Date(now.getTime() - WEEK_MS))];
    const [row] = await db.$queryRaw<Array<{ weeks: number }>>`
      SELECT COUNT(*)::int AS weeks FROM (
        SELECT wk FROM (
          SELECT 'wiki' AS kind, to_char(r."createdAt", 'IYYY-"W"IW') AS wk
          FROM wiki_revisions r
          WHERE r.author = ${username} AND r.source = 'ixwiki' AND r.parked = false
            AND r."userDeleted" = false AND r."createdAt" >= ${since}
          UNION
          SELECT 'post', to_char(p."createdAt", 'IYYY-"W"IW')
          FROM "ThinkpagesPost" p
          JOIN "ThinkpagesAccount" a ON a.id = p."accountId"
          WHERE a."clerkUserId" = ${clerkUserId} AND p."isAutoGenerated" = false
            AND p."repostOfId" IS NULL AND p."createdAt" >= ${since}
          UNION
          SELECT 'post', to_char(f."createdAt", 'IYYY-"W"IW')
          FROM forum_posts f
          WHERE f."authorUserId" = ${userId} AND f.hidden = false AND f."createdAt" >= ${since}
          UNION
          SELECT 'cards', to_char(k."openedAt", 'IYYY-"W"IW')
          FROM user_packs k
          WHERE k."userId" = ${userId} AND k."isOpened" = true AND k."openedAt" >= ${since}
          UNION
          SELECT 'cards', to_char(t."respondedAt", 'IYYY-"W"IW')
          FROM "TradeOffer" t
          WHERE (t."initiatorId" = ${userId} OR t."recipientId" = ${userId})
            AND t.status = 'ACCEPTED' AND t."respondedAt" >= ${since}
          UNION
          SELECT 'cards', to_char(s."endTime", 'IYYY-"W"IW')
          FROM "CardAuction" s
          WHERE s."sellerId" = ${userId} AND s.status = 'COMPLETED'
            AND s."endTime" >= ${since} AND s."endTime" <= ${now}
        ) activity
        WHERE wk IN (${weeks[0]}, ${weeks[1]})
        GROUP BY wk HAVING COUNT(DISTINCT kind) = 3
      ) full_weeks`;
    return { renaissanceWeek: Number((row?.weeks ?? 0) > 0) };
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
  cardsActivityLoader,
  cardsDeckLoader,
  lorewardsLoader,
  renaissanceLoader,
  creationsLoader,
];
