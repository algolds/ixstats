/**
 * Business news and live activity (docs/specs/2026-11-06-exchange-overhaul-design.md §9). Engine moves publish an item
 * inside their own transaction; a key makes a retried move publish once. Items never name a user: companies and
 * nations by name, players as "a private investor" until identities land (R3). Headlines alert the subject's watchers
 * after the move commits (alertWatchers).
 */
import { notifyExchange, type ExchangeNotice } from "./notify";
import type { Db } from "./guards";
import { storyHref } from "./routes";

export const NEWS_KINDS = [
  "trade",
  "dividend",
  "tender_awarded",
  "tender_completed",
  "distress",
  "bankruptcy",
  "acquisition",
  "vote_passed",
  "company_listed",
  "bond_issued",
  "bond_bought",
  "bond_defaulted",
  "bond_repaid",
  "policy",
] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];
export type NewsProminence = "HEADLINE" | "ACTIVITY";
export type NewsSourceKind = "EXCHANGE" | "NATION" | "COMPANY";

/** A trade worth at least this many ₷ is also a headline. */
export const LARGE_TRADE_SOVEREIGNS = 5000;

export interface PublishNewsInput {
  realmId: string;
  kind: NewsKind;
  prominence: NewsProminence;
  sourceKind: NewsSourceKind;
  sourceId?: string;
  headline: string;
  body?: string;
  companyId?: string;
  bondId?: string;
  countryId?: string;
  contractId?: string;
  movePct?: number;
  key: string;
}

export interface PublishedHeadline {
  id: string;
  headline: string;
  companyId?: string | null;
  bondId?: string | null;
  countryId?: string | null;
}

/** Publish an item once per key. Returns the new headline (for watcher alerts), or null for activity or a repeat. */
export async function publishNewsTx(
  tx: Db,
  input: PublishNewsInput
): Promise<PublishedHeadline | null> {
  const existing = await tx.exchangeNewsItem.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (existing) return null;
  const row = await tx.exchangeNewsItem.create({
    data: {
      realmId: input.realmId,
      kind: input.kind,
      prominence: input.prominence,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId ?? null,
      headline: input.headline,
      body: input.body ?? null,
      companyId: input.companyId ?? null,
      bondId: input.bondId ?? null,
      countryId: input.countryId ?? null,
      contractId: input.contractId ?? null,
      movePct: input.movePct ?? null,
      key: input.key,
    },
  });
  if (input.prominence !== "HEADLINE") return null;
  return {
    id: row.id,
    headline: row.headline,
    companyId: row.companyId,
    bondId: row.bondId,
    countryId: row.countryId,
  };
}

export interface NewsRow {
  id: string;
  realmId: string;
  kind: string;
  prominence: string;
  sourceKind: string;
  sourceId: string | null;
  headline: string;
  body: string | null;
  companyId: string | null;
  bondId: string | null;
  countryId: string | null;
  contractId: string | null;
  movePct: number | null;
  createdAt: Date;
}

const NEWS_SELECT = {
  id: true,
  realmId: true,
  kind: true,
  prominence: true,
  sourceKind: true,
  sourceId: true,
  headline: true,
  body: true,
  companyId: true,
  bondId: true,
  countryId: true,
  contractId: true,
  movePct: true,
  createdAt: true,
} as const;

export interface ListNewsArgs {
  realmId: string;
  prominence?: NewsProminence;
  subject?: { companyId?: string; bondId?: string; countryId?: string };
  take?: number;
  /** Items older than this one (pagination). */
  before?: Date;
}

/** A realm's or a subject's items, newest first. */
export async function listNews(db: Db, args: ListNewsArgs): Promise<NewsRow[]> {
  const take = Math.min(args.take ?? 20, 100);
  const rows = await db.exchangeNewsItem.findMany({
    where: {
      realmId: args.realmId,
      ...(args.prominence ? { prominence: args.prominence } : {}),
      ...(args.subject?.companyId ? { companyId: args.subject.companyId } : {}),
      ...(args.subject?.bondId ? { bondId: args.subject.bondId } : {}),
      ...(args.subject?.countryId ? { countryId: args.subject.countryId } : {}),
      ...(args.before ? { createdAt: { lt: args.before } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: NEWS_SELECT,
  });
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take);
}

/** One notice per watcher of each headline's subjects (after the move has committed). Returns how many were queued. */
export async function alertWatchers(db: Db, items: readonly PublishedHeadline[]): Promise<number> {
  const notices: ExchangeNotice[] = [];
  for (const item of items) {
    const subjects = [
      item.companyId ? { subjectKind: "COMPANY", subjectId: item.companyId } : null,
      item.bondId ? { subjectKind: "BOND", subjectId: item.bondId } : null,
      item.countryId ? { subjectKind: "NATION", subjectId: item.countryId } : null,
    ].filter((s) => s !== null);
    if (subjects.length === 0) continue;
    const watches = await db.exchangeWatch.findMany({
      where: { OR: subjects },
      select: { userId: true },
    });
    for (const userId of new Set(watches.map((w) => w.userId))) {
      notices.push({
        userId,
        title: item.headline,
        message: "On your Exchange watchlist.",
        href: storyHref(item.id),
      });
    }
  }
  if (notices.length > 0) notifyExchange(notices);
  return notices.length;
}

interface ContractNewsSource {
  id: string;
  realmId: string;
  type: string;
  title: string;
  issuerCountryId: string | null;
}

/**
 * A contract award or delivery. A government tender (B2G) is a headline sourced to its nation; a company contract is
 * live activity.
 */
export async function publishContractNewsTx(
  tx: Db,
  contract: ContractNewsSource,
  winnerCompanyId: string,
  stage: "tender_awarded" | "tender_completed"
): Promise<PublishedHeadline | null> {
  const [winner, nation] = await Promise.all([
    tx.company.findUnique({ where: { id: winnerCompanyId }, select: { name: true } }),
    contract.issuerCountryId
      ? tx.country.findUnique({ where: { id: contract.issuerCountryId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  const verb = stage === "tender_awarded" ? "wins" : "delivers";
  const whose = contract.type === "B2G" && nation ? `${nation.name}'s tender ` : "";
  const isTender = contract.type === "B2G";
  return publishNewsTx(tx, {
    realmId: contract.realmId,
    kind: stage,
    prominence: isTender ? "HEADLINE" : "ACTIVITY",
    sourceKind: isTender && contract.issuerCountryId ? "NATION" : "COMPANY",
    sourceId: isTender && contract.issuerCountryId ? contract.issuerCountryId : winnerCompanyId,
    headline: `${winner?.name ?? "A company"} ${verb} ${whose}"${contract.title}"`,
    companyId: winnerCompanyId,
    countryId: contract.issuerCountryId ?? undefined,
    contractId: contract.id,
    key: `news:${stage}:${contract.id}`,
  });
}
