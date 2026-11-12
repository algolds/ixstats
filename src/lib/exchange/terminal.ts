/**
 * The terminal's read models (docs/specs/2026-11-06-exchange-overhaul-design.md §5): the front page, markets, the
 * company, bond, nation and story pages. Prices, the portfolio and the leaderboards are in terminal-valuation.ts.
 * Read-only. Public pages carry no user ids or names: a holder is "Founder" or "Private investor".
 */
import type { Company } from "@prisma/client";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { centsOf, fromCents, round2 } from "./amounts";
import { companyView, type SectorKey } from "./companies";
import type { Db } from "./guards";
import { listNews, type NewsRow } from "./news";
import { listBusinessPosts, mergeNews } from "./press";
import { getOrderBook } from "./shares";
import { SECTOR_LABELS, unitPrice } from "./sectors";
import { SUB_INDUSTRIES, computeCompanyMetrics, type CreditRating } from "./taxonomy";
import {
  bondViews,
  companyPrice,
  getPortfolio,
  LIVE,
  ratingOf,
  sectorLabel,
  type WatchKind,
} from "./terminal-valuation";
import { treasurySummary } from "./treasury";
import type { MarketKind } from "./routes";

const SECTORS: readonly SectorKey[] = ["agriculture", "industry", "services", "government"];
const INDEX_BASE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers

export interface SeriesPoint {
  t: number;
  value: number;
}

/** The realm index: each time's sector values, weighted by the realm's GDP sector weights (equal when unset). */
export function realmIndexSeries(
  history: readonly { sectorKey: string; value: number; recordedIxTime: number }[],
  weights: Record<SectorKey, number>
): SeriesPoint[] {
  const total = SECTORS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  const w = (k: SectorKey) =>
    total > 0 ? Math.max(0, weights[k] ?? 0) / total : 1 / SECTORS.length;
  const last: Record<string, number> = Object.fromEntries(SECTORS.map((k) => [k, INDEX_BASE]));
  const times = [...new Set(history.map((h) => h.recordedIxTime))].sort((a, b) => a - b);
  return times.map((t) => {
    for (const h of history) if (h.recordedIxTime === t) last[h.sectorKey] = h.value;
    return { t, value: round2(SECTORS.reduce((s, k) => s + w(k) * (last[k] ?? INDEX_BASE), 0)) };
  });
}

/** Percent change, or null without a usable base. */
export function changePct(from: number | null | undefined, to: number): number | null {
  if (from === null || from === undefined || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** The latest point at least a day older than `t`. */
function dayAgo<T>(points: readonly T[], timeOf: (p: T) => number, t: number): T | undefined {
  return points.filter((p) => timeOf(p) <= t - DAY_MS).sort((a, b) => timeOf(b) - timeOf(a))[0];
}

/** A ticker from a company name: the first letter of up to four words. */
export function tickerOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const subIndustryLabel = (key: string) => SUB_INDUSTRIES.find((s) => s.key === key)?.label ?? key;

// ---------------------------------------------------------------------------------------------------------------
// Shared readers

export interface NewsItem extends NewsRow {
  sourceName: string;
  /** Where the item opens when it isn't an Exchange story (a ThinkPages post). */
  href?: string;
}

/** Name each item's source: the Exchange, a nation or a company. */
async function withSourceNames(db: Db, rows: readonly NewsRow[]): Promise<NewsItem[]> {
  const ids = (kind: string) => [
    ...new Set(rows.filter((r) => r.sourceKind === kind && r.sourceId).map((r) => r.sourceId!)),
  ];
  const [companies, nations] = await Promise.all([
    db.company.findMany({
      where: { id: { in: ids("COMPANY") } },
      select: { id: true, name: true },
    }),
    db.country.findMany({ where: { id: { in: ids("NATION") } }, select: { id: true, name: true } }),
  ]);
  const names = new Map([...companies, ...nations].map((r) => [r.id, r.name]));
  return rows.map((r) => ({
    ...r,
    sourceName: (r.sourceId && names.get(r.sourceId)) || "Exchange",
  }));
}

async function newsFor(db: Db, args: Parameters<typeof listNews>[1]): Promise<NewsItem[]> {
  return withSourceNames(db, await listNews(db, args));
}

/** Exchange stories and live #business posts together, newest first. */
async function storiesFor(db: Db, args: Parameters<typeof listNews>[1]): Promise<NewsItem[]> {
  const [news, press] = await Promise.all([
    newsFor(db, args),
    listBusinessPosts(db, { realmId: args.realmId, ...args.subject, take: args.take }),
  ]);
  return mergeNews(news, press).slice(0, args.take ?? 20);
}

async function realmOf(db: Db, realmId: string): Promise<{ id: string; name: string }> {
  if (realmId === DEFAULT_REALM_ID) return { id: realmId, name: "Ixnay" };
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { name: true } });
  return { id: realmId, name: realm?.name ?? realmId };
}

async function companyMoves(db: Db, companies: readonly Company[], nowMs: number) {
  const history = await db.companyValueHistory.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      recordedAt: { gte: new Date(nowMs - 2 * DAY_MS) },
    },
    orderBy: { recordedAt: "asc" },
    select: { companyId: true, fairValue: true, recordedAt: true },
  });
  return new Map(
    companies.map((c) => {
      const old = dayAgo(
        history.filter((h) => h.companyId === c.id),
        (h) => h.recordedAt.getTime(),
        nowMs
      );
      return [
        c.id,
        changePct(old ? fromCents(centsOf(old.fairValue)) : undefined, fromCents(centsOf(c.fairValue))),
      ] as const;
    })
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Front page

export async function getFrontPage(db: Db, realmId: string, nowMs: number = Date.now()) {
  const [realm, indices, history, companies, bonds, news, activity] = await Promise.all([
    realmOf(db, realmId),
    db.sectorIndex.findMany({ where: { realmId } }),
    db.sectorIndexHistory.findMany({
      where: { realmId },
      // The newest points: the series is re-sorted by time below.
      orderBy: { recordedIxTime: "desc" },
      take: 4000,
      select: { sectorKey: true, value: true, recordedIxTime: true },
    }),
    db.company.findMany({ where: { realmId, status: { in: LIVE } } }),
    db.nationBond.findMany({ where: { realmId, status: "OPEN" }, take: 6 }),
    storiesFor(db, { realmId, prominence: "HEADLINE", take: 10 }),
    newsFor(db, { realmId, prominence: "ACTIVITY", take: 12 }),
  ]);
  const weights = Object.fromEntries(
    SECTORS.map((k) => [k, indices.find((i) => i.sectorKey === k)?.macroWeight ?? 0])
  ) as Record<SectorKey, number>;
  const series = realmIndexSeries(history, weights);
  const lastPoint = series.at(-1);
  const value = lastPoint?.value ?? INDEX_BASE;
  const sectors = SECTORS.map((sectorKey) => {
    const now = indices.find((i) => i.sectorKey === sectorKey)?.value ?? INDEX_BASE;
    const own = history.filter((h) => h.sectorKey === sectorKey);
    const old = lastPoint ? dayAgo(own, (h) => h.recordedIxTime, lastPoint.t) : undefined;
    return {
      sectorKey,
      label: SECTOR_LABELS[sectorKey],
      value: now,
      changePct: changePct(old?.value, now),
    };
  });
  const moves = await companyMoves(db, companies, nowMs);
  const movers = companies
    .map((c) => ({
      companyId: c.id,
      name: c.name,
      price: companyPrice(c),
      changePct: moves.get(c.id) ?? null,
    }))
    .filter((m) => m.changePct !== null)
    .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
    .slice(0, 5);
  const old = lastPoint ? dayAgo(series, (p) => p.t, lastPoint.t) : undefined;
  return {
    realm,
    index: { value, changePct: changePct(old?.value, value), series },
    sectors,
    movers,
    bonds: await bondViews(db, bonds, nowMs),
    news,
    activity,
  };
}
export type FrontPage = Awaited<ReturnType<typeof getFrontPage>>;

// ---------------------------------------------------------------------------------------------------------------
// Markets

export type MarketRow =
  | {
      kind: "companies";
      id: string;
      name: string;
      subtitle: string;
      price: number;
      changePct: number | null;
      ticker: string;
      rating: CreditRating;
    }
  | {
      kind: "bonds";
      id: string;
      name: string;
      subtitle: string;
      price: number;
      changePct: null;
      couponRate: number;
      yield: number;
      rating: CreditRating;
      weeksLeft: number;
      unitsLeft: number;
    }
  | {
      kind: "funds";
      id: string;
      name: string;
      subtitle: string;
      price: number;
      changePct: null;
      sectorKey: SectorKey;
    };

const matches = (name: string, query?: string) =>
  !query || name.toLowerCase().includes(query.toLowerCase());

export async function getMarkets(
  db: Db,
  realmId: string,
  kind: MarketKind,
  query?: string,
  nowMs: number = Date.now()
): Promise<MarketRow[]> {
  if (kind === "bonds") {
    const views = await bondViews(
      db,
      await db.nationBond.findMany({ where: { realmId, status: "OPEN" } }),
      nowMs
    );
    return views
      .filter((b) => matches(b.nation, query))
      .map((b) => ({
        kind: "bonds" as const,
        id: b.bondId,
        name: `${b.nation} ${b.termWeeks}-week bond`,
        subtitle: `${Number((b.couponRate * 100).toFixed(2))}% coupon`,
        price: b.price,
        changePct: null,
        couponRate: b.couponRate,
        yield: b.yield,
        rating: b.rating,
        weeksLeft: b.weeksLeft,
        unitsLeft: b.unitsIssued - b.unitsSold,
      }));
  }
  if (kind === "funds") {
    const indices = await db.sectorIndex.findMany({ where: { realmId } });
    return SECTORS.filter((k) => matches(SECTOR_LABELS[k], query)).map((sectorKey) => {
      const row = indices.find((i) => i.sectorKey === sectorKey);
      return {
        kind: "funds" as const,
        id: sectorKey,
        name: `${SECTOR_LABELS[sectorKey]} fund`,
        subtitle: "Sector index fund",
        price: round2(row ? unitPrice(row) : 1),
        changePct: null,
        sectorKey,
      };
    });
  }
  const companies = (
    await db.company.findMany({ where: { realmId, status: { in: LIVE } } })
  ).filter((c) => matches(c.name, query));
  const moves = await companyMoves(db, companies, nowMs);
  return companies.map((c) => ({
    kind: "companies" as const,
    id: c.id,
    name: c.name,
    subtitle: `${subIndustryLabel(c.subIndustryKey)} · ${sectorLabel(c.sectorKey)}`,
    price: companyPrice(c),
    changePct: moves.get(c.id) ?? null,
    ticker: tickerOf(c.name),
    rating: ratingOf(c.creditRating),
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Watching

async function isWatching(
  db: Db,
  viewerId: string | null,
  subjectKind: WatchKind,
  subjectId: string
) {
  if (!viewerId) return false;
  const row = await db.exchangeWatch.findFirst({
    where: { userId: viewerId, subjectKind, subjectId },
    select: { id: true },
  });
  return row !== null;
}

// ---------------------------------------------------------------------------------------------------------------
// Company page

async function companyFilings(db: Db, companyId: string) {
  const [dividends, decisions, proposals] = await Promise.all([
    db.companyDividend.findMany({
      where: { companyId },
      select: { id: true, amount: true, createdAt: true },
    }),
    db.companyDecision.findMany({
      where: { companyId },
      select: { id: true, type: true, submittedIxTime: true, appliedIxTime: true },
    }),
    db.companyProposal.findMany({
      where: { companyId },
      select: {
        id: true,
        type: true,
        status: true,
        sharesFor: true,
        sharesAgainst: true,
        expiresIxTime: true,
      },
    }),
  ]);
  // Fields are picked by hand so no user id can ride along, whatever the query returns.
  return {
    dividends: [...dividends]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((d) => ({ id: d.id, amount: fromCents(centsOf(d.amount)), createdAt: d.createdAt })),
    decisions: [...decisions]
      .sort((a, b) => b.submittedIxTime - a.submittedIxTime)
      .slice(0, 20)
      .map((d) => ({
        id: d.id,
        type: d.type,
        submittedIxTime: d.submittedIxTime,
        appliedIxTime: d.appliedIxTime,
      })),
    proposals: proposals.map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      sharesFor: p.sharesFor,
      sharesAgainst: p.sharesAgainst,
      expiresIxTime: p.expiresIxTime,
    })),
  };
}

async function shareholdersOf(db: Db, company: Company) {
  const rows = await db.shareholding.findMany({
    where: { companyId: company.id, shares: { gt: 0 } },
    select: { ownerUserId: true, shares: true },
  });
  return [...rows]
    .sort((a, b) => b.shares - a.shares)
    .slice(0, 10)
    .map((r) => ({
      label: r.ownerUserId === company.founderId ? "Founder" : "Private investor",
      shares: r.shares,
      stake: company.sharesOutstanding > 0 ? r.shares / company.sharesOutstanding : 0,
    }));
}

/** Everything the company page shows, with nothing that names a user. */
export async function getCompanyPage(
  db: Db,
  companyId: string,
  viewerId: string | null,
  nowMs: number = Date.now()
) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return null;
  const [history, shareholders, orderBook, filings, news, hq, watching, holding] =
    await Promise.all([
      db.companyValueHistory.findMany({
        where: { companyId },
        orderBy: { recordedAt: "desc" },
        take: 120,
        select: { fairValue: true, recordedAt: true },
      }),
      shareholdersOf(db, company),
      getOrderBook(db, companyId),
      companyFilings(db, companyId),
      storiesFor(db, { realmId: company.realmId, subject: { companyId }, take: 10 }),
      company.hqCountryId
        ? db.country.findUnique({
            where: { id: company.hqCountryId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      isWatching(db, viewerId, "COMPANY", companyId),
      viewerId
        ? db.shareholding.findFirst({
            where: { companyId, ownerUserId: viewerId },
            select: { shares: true },
          })
        : Promise.resolve(null),
    ]);
  const trailing30dDividends = filings.dividends
    .filter((d) => d.createdAt.getTime() >= nowMs - 30 * DAY_MS)
    .reduce((s, d) => s + d.amount, 0);
  const moves = await companyMoves(db, [company], nowMs);
  const view = companyView(company);
  return {
    company: {
      id: view.id,
      name: view.name,
      ticker: tickerOf(view.name),
      realmId: view.realmId,
      sectorKey: view.sectorKey,
      sectorLabel: sectorLabel(view.sectorKey),
      subIndustryKey: view.subIndustryKey,
      subIndustryLabel: subIndustryLabel(view.subIndustryKey),
      status: view.status,
      tradingOpen: view.tradingOpen,
      capital: view.capital,
      standing: view.standing,
      fairValue: view.fairValue,
      sharesOutstanding: view.sharesOutstanding,
      creditDrawn: view.creditDrawn,
      creditRating: ratingOf(view.creditRating),
      decisionValue: view.decisionValue,
      contractsWonValue: view.contractsWonValue,
      lastTradePrice: view.lastTradePrice,
      lastTickRevenue: view.lastTickRevenue,
      lastTickExpenses: view.lastTickExpenses,
      lastTickTax: view.lastTickTax,
      lastTickNetIncome: view.lastTickNetIncome,
      distressedSinceIxTime: view.distressedSinceIxTime,
      wikiSlug: view.wikiSlug,
      wikiData: view.wikiData,
    },
    price: companyPrice(company),
    changePct: moves.get(company.id) ?? null,
    metrics: computeCompanyMetrics({ ...view, trailing30dDividends }),
    valueHistory: [...history]
      .reverse()
      .map((h) => ({ t: h.recordedAt.getTime(), value: fromCents(centsOf(h.fairValue)) })),
    hq: hq ? { id: hq.id, name: hq.name } : null,
    shareholders,
    orderBook,
    ...filings,
    news,
    viewer: { watching, shares: holding?.shares ?? 0, founded: viewerId === company.founderId },
  };
}
export type CompanyPage = NonNullable<Awaited<ReturnType<typeof getCompanyPage>>>;

// ---------------------------------------------------------------------------------------------------------------
// Bond and nation pages

export async function getBondPage(
  db: Db,
  bondId: string,
  viewerId: string | null,
  nowMs: number = Date.now()
) {
  const bond = await db.nationBond.findUnique({ where: { id: bondId } });
  if (!bond) return null;
  const [[view], listings, holders, news, watching, holding] = await Promise.all([
    bondViews(db, [bond], nowMs),
    db.bondListing.findMany({
      where: { bondId, status: "OPEN" },
      select: { id: true, units: true, pricePerUnit: true, sellerUserId: true },
    }),
    db.bondHolding.count({ where: { bondId, units: { gt: 0 } } }),
    newsFor(db, { realmId: bond.realmId, subject: { bondId }, take: 10 }),
    isWatching(db, viewerId, "BOND", bondId),
    viewerId
      ? db.bondHolding.findFirst({
          where: { bondId, ownerUserId: viewerId },
          select: { units: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    bond: {
      ...view!,
      faceValue: fromCents(centsOf(bond.faceValue)),
      weeksPaid: bond.weeksPaid,
      issuedAt: bond.issuedAt,
      realmId: bond.realmId,
    },
    listings: [...listings]
      .sort((a, b) => centsOf(a.pricePerUnit) - centsOf(b.pricePerUnit))
      .map((l) => ({
        id: l.id,
        units: l.units,
        pricePerUnit: fromCents(centsOf(l.pricePerUnit)),
        mine: l.sellerUserId === viewerId,
      })),
    holderCount: holders,
    news,
    viewer: { watching, units: holding?.units ?? 0 },
  };
}
export type BondPage = NonNullable<Awaited<ReturnType<typeof getBondPage>>>;

export async function getNationPage(
  db: Db,
  countryId: string,
  viewerId: string | null = null,
  nowMs: number = Date.now()
) {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, flag: true, realmId: true, currencyExchangeRate: true },
  });
  if (!country) return null;
  const cfg = await getExchangeConfig(db);
  const [identity, treasury, treasuryRow, bonds, companies, news] = await Promise.all([
    db.nationalIdentity.findUnique({
      where: { countryId },
      select: { currency: true, currencySymbol: true },
    }),
    treasurySummary(db, countryId, cfg.treasuryCap),
    db.nationTreasury.findUnique({
      where: { countryId },
      select: { creditRating: true, fundUserId: true },
    }),
    db.nationBond.findMany({ where: { countryId } }),
    db.company.findMany({ where: { hqCountryId: countryId, status: { in: LIVE } } }),
    storiesFor(db, { realmId: country.realmId, subject: { countryId }, take: 10 }),
  ]);
  const watching = await isWatching(db, viewerId, "NATION", countryId);
  // The wealth fund's holdings are public (spec §11a).
  const fund = treasuryRow?.fundUserId
    ? await getPortfolio(db, treasuryRow.fundUserId, country.realmId, nowMs)
    : null;
  return {
    fund,
    viewer: { watching },
    id: country.id,
    name: country.name,
    flagUrl: country.flag,
    realmId: country.realmId,
    currency: identity?.currency ?? null,
    currencySymbol: identity?.currencySymbol ?? null,
    currencyRate: country.currencyExchangeRate ?? null,
    rating: ratingOf(treasuryRow?.creditRating),
    treasury,
    bonds: await bondViews(db, bonds, nowMs),
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      price: companyPrice(c),
    })),
    news,
  };
}
export type NationPage = NonNullable<Awaited<ReturnType<typeof getNationPage>>>;

export async function getStory(db: Db, newsId: string): Promise<NewsItem | null> {
  const row = await db.exchangeNewsItem.findUnique({ where: { id: newsId } });
  if (!row) return null;
  const [item] = await withSourceNames(db, [row]);
  return item ?? null;
}
