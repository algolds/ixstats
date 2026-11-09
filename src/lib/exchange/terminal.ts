/**
 * The terminal's read models (docs/specs/2026-11-06-exchange-overhaul-design.md §5): the front page, markets, the
 * company, bond, nation and story pages, the portfolio and the leaderboards. Read-only. Public pages carry no user
 * ids or names: a holder is "Founder" or "Private investor", an investor on a board is "Investor #n".
 */
import type { Company, NationBond } from "@prisma/client";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { centsOf, fromCents, round2 } from "./amounts";
import { bondPriceOf, modelBondPrice, weeksLeftOf } from "./bonds";
import type { SectorKey } from "./companies";
import type { Db } from "./guards";
import { isFundUser } from "./fund-ids";
import { rateToFraction } from "./macro";
import { listNews, type NewsRow } from "./news";
import { listBusinessPosts, mergeNews } from "./press";
import { getOrderBook } from "./shares";
import { SECTOR_LABELS, unitPrice } from "./sectors";
import {
  CREDIT_RATINGS,
  SUB_INDUSTRIES,
  computeCompanyMetrics,
  type CreditRating,
} from "./taxonomy";
import { treasurySummary } from "./treasury";
import type { MarketKind } from "./routes";

const SECTORS: readonly SectorKey[] = ["agriculture", "industry", "services", "government"];
const INDEX_BASE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE = ["ACTIVE", "DISTRESSED"];

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

const ratingOf = (r: string | null | undefined): CreditRating =>
  CREDIT_RATINGS.find((x) => x === r) ?? "A";

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
const sectorLabel = (key: string) => SECTOR_LABELS[key as SectorKey] ?? key;

export function companyPrice(
  c: Pick<Company, "lastTradePrice" | "fairValue" | "sharesOutstanding">
): number {
  return round2(c.lastTradePrice ?? c.fairValue / Math.max(1, c.sharesOutstanding));
}

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
      return [c.id, changePct(old?.fairValue, c.fairValue)] as const;
    })
  );
}

interface BondView {
  bondId: string;
  countryId: string;
  nation: string;
  couponRate: number;
  termWeeks: number;
  weeksLeft: number;
  price: number;
  yield: number;
  rating: CreditRating;
  status: string;
  unitsIssued: number;
  unitsSold: number;
}

/** Price, yield and rating for bonds (one query each for nations, treasuries and asks). */
async function bondViews(db: Db, bonds: readonly NationBond[], nowMs: number): Promise<BondView[]> {
  const countryIds = [...new Set(bonds.map((b) => b.countryId))];
  const [nations, treasuries, asks] = await Promise.all([
    db.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true, name: true, interestRates: true },
    }),
    db.nationTreasury.findMany({
      where: { countryId: { in: countryIds } },
      select: { countryId: true, creditRating: true },
    }),
    db.bondListing.findMany({
      where: { bondId: { in: bonds.map((b) => b.id) }, status: "OPEN" },
      select: { bondId: true, pricePerUnit: true },
    }),
  ]);
  return bonds.map((b) => {
    const nation = nations.find((n) => n.id === b.countryId);
    const rating = ratingOf(treasuries.find((t) => t.countryId === b.countryId)?.creditRating);
    const weeksLeft = weeksLeftOf(b, nowMs);
    const baseRate = rateToFraction(nation?.interestRates) ?? 0.05;
    const model = modelBondPrice({
      faceValue: b.faceValue,
      couponRate: b.couponRate,
      rating,
      baseRate,
      weeksLeft,
      defaulted: b.status === "DEFAULTED",
    });
    const bestAsk = asks
      .filter((a) => a.bondId === b.id)
      .reduce<number | null>(
        (m, a) => (m === null ? a.pricePerUnit : Math.min(m, a.pricePerUnit)),
        null
      );
    const price = bondPriceOf(b, bestAsk, model);
    return {
      bondId: b.id,
      countryId: b.countryId,
      nation: nation?.name ?? "A nation",
      couponRate: b.couponRate,
      termWeeks: b.termWeeks,
      weeksLeft,
      price,
      yield: price > 0 ? (b.couponRate * b.faceValue) / price : 0,
      rating,
      status: b.status,
      unitsIssued: b.unitsIssued,
      unitsSold: b.unitsSold,
    };
  });
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

export type WatchKind = "COMPANY" | "BOND" | "NATION";

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
      .map((d) => ({ id: d.id, amount: d.amount, createdAt: d.createdAt })),
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
  return {
    company: {
      id: company.id,
      name: company.name,
      ticker: tickerOf(company.name),
      realmId: company.realmId,
      sectorKey: company.sectorKey,
      sectorLabel: sectorLabel(company.sectorKey),
      subIndustryKey: company.subIndustryKey,
      subIndustryLabel: subIndustryLabel(company.subIndustryKey),
      status: company.status,
      tradingOpen: company.tradingOpen,
      capital: company.capital,
      standing: company.standing,
      fairValue: company.fairValue,
      sharesOutstanding: company.sharesOutstanding,
      creditDrawn: company.creditDrawn,
      creditRating: ratingOf(company.creditRating),
      decisionValue: company.decisionValue,
      contractsWonValue: company.contractsWonValue,
      lastTradePrice: company.lastTradePrice,
      lastTickRevenue: company.lastTickRevenue,
      lastTickExpenses: company.lastTickExpenses,
      lastTickTax: company.lastTickTax,
      lastTickNetIncome: company.lastTickNetIncome,
      distressedSinceIxTime: company.distressedSinceIxTime,
      wikiSlug: company.wikiSlug,
      wikiData: company.wikiData,
    },
    price: companyPrice(company),
    changePct: moves.get(company.id) ?? null,
    metrics: computeCompanyMetrics({ ...company, trailing30dDividends }),
    valueHistory: [...history]
      .reverse()
      .map((h) => ({ t: h.recordedAt.getTime(), value: h.fairValue })),
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
      faceValue: bond.faceValue,
      weeksPaid: bond.weeksPaid,
      issuedAt: bond.issuedAt,
      realmId: bond.realmId,
    },
    listings: [...listings]
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
      .map((l) => ({
        id: l.id,
        units: l.units,
        pricePerUnit: l.pricePerUnit,
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

// ---------------------------------------------------------------------------------------------------------------
// Portfolio

function valueShareHoldings(
  rows: readonly { companyId: string; shares: number }[],
  companies: readonly Company[]
) {
  return companies.flatMap((c) => {
    const row = rows.find((r) => r.companyId === c.id);
    if (!row) return [];
    const price = companyPrice(c);
    return [
      {
        companyId: c.id,
        name: c.name,
        shares: row.shares,
        price,
        value: round2(row.shares * price),
      },
    ];
  });
}

function valueBondHoldings(
  rows: readonly { bondId: string; units: number }[],
  views: readonly BondView[]
) {
  return views.flatMap((v) => {
    const row = rows.find((r) => r.bondId === v.bondId);
    if (!row) return [];
    return [
      {
        bondId: v.bondId,
        name: `${v.nation} ${v.termWeeks}-week bond`,
        units: row.units,
        price: v.price,
        value: round2(row.units * v.price),
      },
    ];
  });
}

function valueFundHoldings(
  positions: readonly { sectorKey: string; units: number }[],
  indices: readonly { sectorKey: string; fundSovereigns: number; unitsOutstanding: number }[]
) {
  return positions.map((p) => {
    const row = indices.find((i) => i.sectorKey === p.sectorKey);
    const price = row ? unitPrice(row) : 1;
    return {
      sectorKey: p.sectorKey,
      name: `${sectorLabel(p.sectorKey)} fund`,
      units: p.units,
      price: round2(price),
      value: round2(p.units * price),
    };
  });
}

function portfolioTotalValue(
  walletBalance: number,
  holdings: ReadonlyArray<{ value: number }>
): number {
  return round2(walletBalance + holdings.reduce((s, h) => s + h.value, 0));
}

async function shareHoldingsOf(db: Db, userId: string, realmId: string) {
  const rows = await db.shareholding.findMany({
    where: { ownerUserId: userId, shares: { gt: 0 } },
  });
  const companies = await db.company.findMany({
    where: { id: { in: rows.map((r) => r.companyId) }, realmId },
  });
  return valueShareHoldings(rows, companies);
}

async function bondHoldingsOf(db: Db, userId: string, realmId: string, nowMs: number) {
  const rows = await db.bondHolding.findMany({ where: { ownerUserId: userId, units: { gt: 0 } } });
  const bonds = await db.nationBond.findMany({
    where: { id: { in: rows.map((r) => r.bondId) }, realmId },
  });
  return valueBondHoldings(rows, await bondViews(db, bonds, nowMs));
}

async function fundHoldingsOf(db: Db, userId: string, realmId: string) {
  const [positions, indices] = await Promise.all([
    db.sectorPosition.findMany({ where: { ownerUserId: userId, realmId, units: { gt: 0 } } }),
    db.sectorIndex.findMany({ where: { realmId } }),
  ]);
  return valueFundHoldings(positions, indices);
}

async function votesOwedOf(db: Db, userId: string, companyIds: readonly string[]) {
  const proposals = await db.companyProposal.findMany({
    where: { companyId: { in: [...companyIds] }, status: "OPEN" },
    select: { id: true, companyId: true, type: true },
  });
  const [votes, companies] = await Promise.all([
    db.companyVote.findMany({
      where: { voterUserId: userId, proposalId: { in: proposals.map((p) => p.id) } },
    }),
    db.company.findMany({
      where: { id: { in: proposals.map((p) => p.companyId) } },
      select: { id: true, name: true },
    }),
  ]);
  return proposals
    .filter((p) => !votes.some((v) => v.proposalId === p.id))
    .map((p) => ({
      proposalId: p.id,
      companyId: p.companyId,
      companyName: companies.find((c) => c.id === p.companyId)?.name ?? "",
      type: p.type,
    }));
}

async function watchlistOf(db: Db, userId: string) {
  const watches = await db.exchangeWatch.findMany({
    where: { userId },
    select: { subjectKind: true, subjectId: true },
  });
  const ids = (kind: WatchKind) =>
    watches.filter((w) => w.subjectKind === kind).map((w) => w.subjectId);
  const [companies, bonds, nations] = await Promise.all([
    db.company.findMany({ where: { id: { in: ids("COMPANY") } } }),
    db.nationBond.findMany({
      where: { id: { in: ids("BOND") } },
      select: { id: true, termWeeks: true, countryId: true },
    }),
    db.country.findMany({ where: { id: { in: ids("NATION") } }, select: { id: true, name: true } }),
  ]);
  const bondNations = await db.country.findMany({
    where: { id: { in: bonds.map((b) => b.countryId) } },
    select: { id: true, name: true },
  });
  return [
    ...companies.map((c) => ({
      kind: "COMPANY" as const,
      id: c.id,
      name: c.name,
      price: companyPrice(c),
    })),
    ...bonds.map((b) => ({
      kind: "BOND" as const,
      id: b.id,
      name: `${bondNations.find((n) => n.id === b.countryId)?.name ?? "A nation"} ${b.termWeeks}-week bond`,
      price: null,
    })),
    ...nations.map((n) => ({ kind: "NATION" as const, id: n.id, name: n.name, price: null })),
  ];
}

async function openOrdersOf(db: Db, userId: string) {
  const [buyOrders, shareListings, bondListings] = await Promise.all([
    db.shareBuyOrder.findMany({
      where: { buyerUserId: userId, status: "OPEN" },
      select: { id: true, companyId: true, shares: true, maxPricePerShare: true },
    }),
    db.shareListing.findMany({
      where: { sellerUserId: userId, status: "OPEN" },
      select: { id: true, companyId: true, shares: true, pricePerShare: true },
    }),
    db.bondListing.findMany({
      where: { sellerUserId: userId, status: "OPEN" },
      select: { id: true, bondId: true, units: true, pricePerUnit: true },
    }),
  ]);
  return { buyOrders, shareListings, bondListings };
}

export async function getPortfolio(
  db: Db,
  userId: string,
  realmId: string,
  nowMs: number = Date.now()
) {
  const [wallet, shares, bonds, funds, orders, watchlist] = await Promise.all([
    db.exchangeWallet.findUnique({ where: { userId }, select: { sovereigns: true } }),
    shareHoldingsOf(db, userId, realmId),
    bondHoldingsOf(db, userId, realmId, nowMs),
    fundHoldingsOf(db, userId, realmId),
    openOrdersOf(db, userId),
    watchlistOf(db, userId),
  ]);
  const votesOwed = await votesOwedOf(
    db,
    userId,
    shares.map((s) => s.companyId)
  );
  const balance = wallet ? fromCents(centsOf(wallet.sovereigns)) : 0;
  return {
    wallet: balance,
    shares,
    bonds,
    funds,
    orders,
    watchlist,
    votesOwed,
    totalValue: portfolioTotalValue(balance, [...shares, ...bonds, ...funds]),
  };
}
export type Portfolio = Awaited<ReturnType<typeof getPortfolio>>;

// ---------------------------------------------------------------------------------------------------------------
// Leaderboards

// ponytail: computed live over the realm's holders; add a snapshot table when investor count makes this slow.
export async function getLeaderboards(db: Db, realmId: string, nowMs: number = Date.now()) {
  const [allCompanies, treasuries, bonds, indices, sectorPositions] = await Promise.all([
    db.company.findMany({ where: { realmId } }),
    db.nationTreasury.findMany({ where: { realmId } }),
    db.nationBond.findMany({ where: { realmId } }),
    db.sectorIndex.findMany({ where: { realmId } }),
    db.sectorPosition.findMany({
      where: { realmId, units: { gt: 0 } },
      select: { ownerUserId: true, sectorKey: true, units: true },
    }),
  ]);
  const [nations, shareHoldings, bondHoldings, pricedBonds] = await Promise.all([
    db.country.findMany({
      where: { id: { in: treasuries.map((t) => t.countryId) } },
      select: { id: true, name: true },
    }),
    db.shareholding.findMany({
      where: { companyId: { in: allCompanies.map((c) => c.id) }, shares: { gt: 0 } },
      select: { companyId: true, ownerUserId: true, shares: true },
    }),
    db.bondHolding.findMany({
      where: { bondId: { in: bonds.map((b) => b.id) }, units: { gt: 0 } },
      select: { bondId: true, ownerUserId: true, units: true },
    }),
    bondViews(db, bonds, nowMs),
  ]);
  // Nations' wealth funds are not investors.
  const userIds = [
    ...new Set([...shareHoldings, ...bondHoldings].map((h) => h.ownerUserId)),
  ].filter((u) => !isFundUser(u));
  const wallets = await db.exchangeWallet.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, sovereigns: true },
  });
  const walletByUser = new Map(wallets.map((w) => [w.userId, fromCents(centsOf(w.sovereigns))]));
  const values = userIds.map((u) =>
    portfolioTotalValue(walletByUser.get(u) ?? 0, [
      ...valueShareHoldings(
        shareHoldings.filter((h) => h.ownerUserId === u),
        allCompanies
      ),
      ...valueBondHoldings(
        bondHoldings.filter((h) => h.ownerUserId === u),
        pricedBonds
      ),
      ...valueFundHoldings(
        sectorPositions.filter((p) => p.ownerUserId === u),
        indices
      ),
    ])
  );
  const companies = allCompanies.filter((c) => LIVE.includes(c.status));
  return {
    companies: companies
      .map((c) => ({
        id: c.id,
        name: c.name,
        marketCap: round2(companyPrice(c) * c.sharesOutstanding),
      }))
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 10),
    nations: treasuries
      .map((t) => ({
        id: t.countryId,
        name: nations.find((n) => n.id === t.countryId)?.name ?? "A nation",
        balance: t.balance,
        rating: ratingOf(t.creditRating),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10),
    investors: values
      .sort((a, b) => b - a)
      .slice(0, 10)
      .map((value, i) => ({ label: `Investor #${i + 1}`, value })),
  };
}
export type Leaderboards = Awaited<ReturnType<typeof getLeaderboards>>;
