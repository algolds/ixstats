/** The cards admin Overview (cards refresh spec §2.4): counts, what waits on an admin, and a card-only feed. */
import type { CardImportJob, PrismaClient, SyncLog } from "@prisma/client";
import { CardRarity } from "~/lib/cards/enums";
import { CARD_AUDIT_PREFIXES, type CardAuditAction } from "./cards.audit";

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
  detail: string | null;
  actor: string | null;
  ok: boolean;
}

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

function jobItem(job: CardImportJob): ActivityItem {
  return {
    id: `import-${job.id}`,
    at: job.finishedAt ?? job.startedAt ?? job.createdAt,
    kind: "import",
    title: job.label,
    detail: `${job.staged} staged, ${job.skipped} skipped, ${job.blocked} blocked, ${job.failed} failed of ${job.total}`,
    actor: job.requestedBy,
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

function syncItem(log: SyncLog): ActivityItem {
  return {
    id: `sync-${log.id}`,
    at: log.completedAt ?? log.startedAt,
    kind: "sync",
    title: syncTitle(log.syncType),
    detail: `${log.cardsCreated ?? 0} new, ${log.cardsUpdated ?? 0} updated`,
    actor: null,
    ok: log.status !== "FAILED",
  };
}

export async function cardsActivity(db: PrismaClient, limit = 50): Promise<ActivityItem[]> {
  const [audits, jobs, syncs] = await Promise.all([
    db.auditLog.findMany({
      where: { OR: CARD_AUDIT_PREFIXES.map((prefix) => ({ action: { startsWith: prefix } })) },
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
  const audited: ActivityItem[] = audits.map((row) => ({
    id: `audit-${row.id}`,
    at: row.timestamp,
    kind: "audit",
    title: auditTitle(row.action),
    detail: row.details,
    actor: row.userId,
    ok: row.success,
  }));
  return [...audited, ...jobs.map(jobItem), ...syncs.map(syncItem)]
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

/** Up to 10 cards whose title contains `query`, for the admin's card pickers. */
export function findCards(db: PrismaClient, query: string) {
  return db.card.findMany({
    where: { title: { contains: query.trim(), mode: "insensitive" } },
    orderBy: { title: "asc" },
    take: 10,
    select: { id: true, title: true, cardType: true, rarity: true },
  });
}
