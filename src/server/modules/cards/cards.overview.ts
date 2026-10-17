/** The cards admin Overview (cards refresh spec §2.4): counts, what waits on an admin, and a card-only feed. */
import type { AuditLog, CardImportJob, Prisma, PrismaClient, SyncLog } from "@prisma/client";
import { CardRarity } from "~/lib/cards/enums";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { resolveDisplayNames, UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";
import { CARD_FEED_ACTIONS, type CardAuditAction } from "./cards.audit";

export interface CountRow {
  key: string;
  count: number;
}

export interface CardsOverview {
  total: number;
  byType: CountRow[];
  byRarity: CountRow[];
  byRealm: Array<CountRow & { label: string }>;
  pendingReview: number;
  activeJobs: number;
  openTakedowns: number;
  overdueTakedowns: number;
}

const RARITY_ORDER: readonly string[] = Object.values(CardRarity);
const byCount = (a: CountRow, b: CountRow) => b.count - a.count;

export async function cardsOverview(db: PrismaClient, now = new Date()): Promise<CardsOverview> {
  const [
    byType,
    byRarity,
    byRealm,
    pendingReview,
    importJobs,
    nsJobs,
    openTakedowns,
    overdueTakedowns,
  ] = await Promise.all([
    db.card.groupBy({ by: ["cardType"], _count: { _all: true } }),
    db.card.groupBy({ by: ["rarity"], _count: { _all: true } }),
    db.card.groupBy({
      by: ["realmId"],
      _count: { _all: true },
      orderBy: { _count: { realmId: "desc" } },
      take: 12,
    }),
    db.card.count({ where: { reviewState: "PENDING" } }),
    db.cardImportJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
    db.syncLog.count({
      where: { syncType: { startsWith: "NS_REGION_" }, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    }),
    db.cardTakedown.count({ where: { status: "OPEN" } }),
    db.cardTakedown.count({ where: { status: "OPEN", dueAt: { lt: now } } }),
  ]);
  const realms = await db.realm.findMany({
    where: { id: { in: byRealm.map((row) => row.realmId) } },
    select: { id: true, name: true },
  });
  const names = new Map(realms.map((realm) => [realm.id, realm.name]));

  return {
    total: byType.reduce((sum, row) => sum + row._count._all, 0),
    byType: byType.map((row) => ({ key: row.cardType, count: row._count._all })).sort(byCount),
    byRarity: byRarity
      .map((row) => ({ key: row.rarity, count: row._count._all }))
      .sort((a, b) => RARITY_ORDER.indexOf(a.key) - RARITY_ORDER.indexOf(b.key)),
    byRealm: byRealm.map((row) => ({
      key: row.realmId,
      label: names.get(row.realmId) ?? row.realmId,
      count: row._count._all,
    })),
    pendingReview,
    activeJobs: importJobs + nsJobs,
    openTakedowns,
    overdueTakedowns,
  };
}

export interface ActivityItem {
  id: string;
  at: Date;
  kind: "audit" | "import" | "sync";
  title: string;
  /** The card or player the action was on, by name, when the detail does not already name them. */
  subject: string | null;
  detail: string | null;
  /** Who acted, by name: `SYSTEM_ACTOR` for a cron, a flag owner, or a sync no admin is recorded as starting. */
  actor: string;
  ok: boolean;
}

export const SYSTEM_ACTOR = "System";

const AUDIT_TITLES: Record<CardAuditAction, string> = {
  CARD_REVIEW: "Cards reviewed",
  CARD_RARITY_OVERRIDE: "Rarity overridden",
  CARD_UPDATE: "Card edited",
  CARD_HIDE: "Cards hidden or shown",
  CARD_GRANT: "Card granted",
  CARD_REVOKE: "Card revoked",
  CARD_AUCTION_CANCEL: "Auction cancelled",
  CARD_TRADE_VOID: "Trade voided",
  CARD_PACK_SAVE: "Pack saved",
  CARD_PACK_AWARD: "Pack awarded",
  CARD_ECONOMY_SAVE: "Economy setting saved",
  CARD_SEASON_SET: "Season changed",
  CARD_TAKEDOWN: "Takedown updated",
  CARD_LICENCE: "Licence reviewed",
  CARD_SPECIAL_SAVE: "Special card saved",
  CARD_SUGGESTION: "Suggestion answered",
  CARD_IMPORT: "Import started",
  TROPHY_REASSIGN: "Trophy reassigned",
  TROPHY_VOID: "Trophy voided",
};

/** "CARD_DESIGNER_MINT" → "Card designer mint", for older rows with no title here. */
function humanise(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const auditTitle = (action: string) =>
  (AUDIT_TITLES as Readonly<Record<string, string>>)[action] ?? humanise(action);

/** A player's DB id (a cuid), as the audit rows' details name players. */
const USER_ID = /\bc[a-z0-9]{24}\b/g;

const present = (values: ReadonlyArray<string | null | undefined>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

/** The admin who started a NationStates sync, by DB id, when its metadata records one. */
function startedBy(log: SyncLog): string | null {
  const meta = log.metadata;
  return isJsonObject(meta) && typeof meta.startedBy === "string" ? meta.startedBy : null;
}

/** The names the feed shows for the ids its rows hold. */
interface FeedNames {
  /** Someone by Clerk id (the audit rows' actor); `SYSTEM_ACTOR` for none. */
  byClerkId: (clerkId: string | null) => string;
  /** Someone by DB id (a job's or sync's starter); `SYSTEM_ACTOR` for none. */
  byDbId: (dbId: string | null) => string;
  /** A player by DB id; null for an id that is no player's. */
  player: (dbId: string | null) => string | null;
  /** A card's title by id; null for an id that is no card's. */
  card: (id: string | null) => string | null;
}

/**
 * Every name the feed shows, in the same few reads however many rows it has: the players and cards the rows name by
 * id, then each one's display name.
 */
async function feedNames(
  db: PrismaClient,
  audits: readonly AuditLog[],
  jobs: readonly CardImportJob[],
  syncs: readonly SyncLog[]
): Promise<FeedNames> {
  const targets = present(audits.map((row) => row.target));
  const userIds = present([
    ...targets,
    ...audits.flatMap((row) => row.details?.match(USER_ID) ?? []),
    ...jobs.map((job) => job.requestedBy),
    ...syncs.map(startedBy),
  ]);
  const [users, cards] = await Promise.all([
    userIds.length > 0
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, clerkUserId: true },
        })
      : [],
    targets.length > 0
      ? db.card.findMany({ where: { id: { in: targets } }, select: { id: true, title: true } })
      : [],
  ]);
  const clerkIds = new Map(users.map((user) => [user.id, user.clerkUserId]));
  const titles = new Map(cards.map((card) => [card.id, card.title]));
  const names = await resolveDisplayNames(db, [
    ...present(audits.map((row) => row.userId)),
    ...clerkIds.values(),
  ]);
  const nameOf = (clerkId: string) => names.get(clerkId) ?? UNKNOWN_DISPLAY_NAME;
  const player = (dbId: string | null) => {
    const clerkId = dbId ? clerkIds.get(dbId) : undefined;
    return clerkId ? nameOf(clerkId) : null;
  };
  return {
    byClerkId: (clerkId) => (clerkId ? nameOf(clerkId) : SYSTEM_ACTOR),
    byDbId: (dbId) => (dbId ? (player(dbId) ?? UNKNOWN_DISPLAY_NAME) : SYSTEM_ACTOR),
    player,
    card: (id) => (id ? (titles.get(id) ?? null) : null),
  };
}

function auditItem(row: AuditLog, names: FeedNames): ActivityItem {
  const detail = row.details?.replace(USER_ID, (id) => names.player(id) ?? id) ?? null;
  const subject = names.card(row.target) ?? names.player(row.target);
  return {
    id: `audit-${row.id}`,
    at: row.timestamp,
    kind: "audit",
    title: auditTitle(row.action),
    subject: subject && !detail?.includes(subject) ? subject : null,
    detail,
    actor: names.byClerkId(row.userId),
    ok: row.success,
  };
}

function jobItem(job: CardImportJob, names: FeedNames): ActivityItem {
  return {
    id: `import-${job.id}`,
    at: job.finishedAt ?? job.startedAt ?? job.createdAt,
    kind: "import",
    title: job.label,
    subject: null,
    detail: `${job.staged} staged, ${job.skipped} skipped, ${job.blocked} blocked, ${job.failed} failed of ${job.total}`,
    actor: names.byDbId(job.requestedBy),
    ok: job.status !== "FAILED",
  };
}

/** NationStates jobs that are not region syncs. */
const SYNC_TITLES: Readonly<Record<string, string>> = { NS_CTE_FILTER: "NationStates CTE filter" };

function syncTitle(syncType: string): string {
  if (!syncType.startsWith("NS_REGION_")) return SYNC_TITLES[syncType] ?? humanise(syncType);
  return `NationStates region sync: ${syncType
    .replace(/^NS_REGION_/, "")
    .replace(/_/g, " ")
    .toLowerCase()}`;
}

function syncItem(log: SyncLog, names: FeedNames): ActivityItem {
  return {
    id: `sync-${log.id}`,
    at: log.completedAt ?? log.startedAt,
    kind: "sync",
    title: syncTitle(log.syncType),
    subject: null,
    detail: `${log.cardsCreated ?? 0} new, ${log.cardsUpdated ?? 0} updated`,
    actor: names.byDbId(startedBy(log)),
    ok: log.status !== "FAILED",
  };
}

export async function cardsActivity(db: PrismaClient, limit = 50): Promise<ActivityItem[]> {
  const [audits, jobs, syncs] = await Promise.all([
    db.auditLog.findMany({
      where: { action: { in: [...CARD_FEED_ACTIONS] } },
      orderBy: { timestamp: "desc" },
      take: limit,
    }),
    db.cardImportJob.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    db.syncLog.findMany({
      where: { syncType: { startsWith: "NS_" } },
      orderBy: { startedAt: "desc" },
      take: limit,
    }),
  ]);
  const names = await feedNames(db, audits, jobs, syncs);
  return [
    ...audits.map((row) => auditItem(row, names)),
    ...jobs.map((job) => jobItem(job, names)),
    ...syncs.map((log) => syncItem(log, names)),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

/** Every realm, system realms first, for the admin's realm pickers. */
export function realmOptions(db: PrismaClient) {
  return db.realm.findMany({
    select: { id: true, name: true, isSystem: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    take: 500,
  });
}

/**
 * The cards an admin may grant, as packs and the daily card would draw them: approved by review and not retired. A
 * trophy moves only with its Loreward, so it is never one.
 */
const GRANTABLE_CARDS = {
  reviewState: "APPROVED",
  isRetired: false,
  cardType: { not: "TROPHY" },
} satisfies Prisma.CardWhereInput;

/**
 * Up to 10 cards whose title contains `query`, for the admin's card pickers. `grantable` keeps only cards a grant
 * accepts; without it every card matches, whatever its review state (a takedown can name any card).
 */
export function findCards(db: PrismaClient, query: string, options: { grantable?: boolean } = {}) {
  return db.card.findMany({
    where: {
      title: { contains: query.trim(), mode: "insensitive" },
      ...(options.grantable ? GRANTABLE_CARDS : {}),
    },
    orderBy: { title: "asc" },
    take: 10,
    select: { id: true, title: true, cardType: true, rarity: true },
  });
}
