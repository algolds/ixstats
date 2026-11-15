/**
 * The terminal's shared valuation (docs/specs/2026-11-06-exchange-overhaul-design.md §5): company and bond prices, and
 * the portfolio and leaderboards valued with them. terminal.ts builds its pages on these. Read-only. The leaderboards
 * carry no user ids or names: an investor on a board is "Investor #n".
 */
import type { Company, NationBond } from "@prisma/client";
import { centsOf, fromCents, round2 } from "./amounts";
import { bondPriceOf, modelBondPrice, weeksLeftOf } from "./bonds";
import type { SectorKey } from "./companies";
import { isFundUser } from "./fund-ids";
import type { Db } from "./guards";
import { rateToFraction } from "./macro";
import { SECTOR_LABELS, unitPrice } from "./sectors";
import { CREDIT_RATINGS, type CreditRating } from "./taxonomy";

/** Company statuses that still trade. */
export const LIVE = ["ACTIVE", "DISTRESSED"];

export type WatchKind = "COMPANY" | "BOND" | "NATION";

export const ratingOf = (r: string | null | undefined): CreditRating =>
  CREDIT_RATINGS.find((x) => x === r) ?? "A";

export const sectorLabel = (key: string) => SECTOR_LABELS[key as SectorKey] ?? key;

export function companyPrice(
  c: Pick<Company, "lastTradePrice" | "fairValue" | "sharesOutstanding">
): number {
  return round2(
    c.lastTradePrice !== null
      ? fromCents(centsOf(c.lastTradePrice))
      : fromCents(centsOf(c.fairValue)) / Math.max(1, c.sharesOutstanding)
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Bonds

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
export async function bondViews(db: Db, bonds: readonly NationBond[], nowMs: number): Promise<BondView[]> {
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
    const faceValue = fromCents(centsOf(b.faceValue));
    const model = modelBondPrice({
      faceValue,
      couponRate: b.couponRate,
      rating,
      baseRate,
      weeksLeft,
      defaulted: b.status === "DEFAULTED",
    });
    const bestAsk = asks
      .filter((a) => a.bondId === b.id)
      .reduce<number | null>((m, a) => {
        const askPrice = fromCents(centsOf(a.pricePerUnit));
        return m === null ? askPrice : Math.min(m, askPrice);
      }, null);
    const price = bondPriceOf(b, bestAsk, model);
    return {
      bondId: b.id,
      countryId: b.countryId,
      nation: nation?.name ?? "A nation",
      couponRate: b.couponRate,
      termWeeks: b.termWeeks,
      weeksLeft,
      price,
      yield: price > 0 ? (b.couponRate * faceValue) / price : 0,
      rating,
      status: b.status,
      unitsIssued: b.unitsIssued,
      unitsSold: b.unitsSold,
    };
  });
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
  indices: readonly { sectorKey: string; fundSovereigns: bigint | number; unitsOutstanding: number }[]
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
  return {
    buyOrders: buyOrders.map((o) => ({
      ...o,
      maxPricePerShare: fromCents(centsOf(o.maxPricePerShare)),
    })),
    shareListings: shareListings.map((l) => ({
      ...l,
      pricePerShare: fromCents(centsOf(l.pricePerShare)),
    })),
    bondListings: bondListings.map((l) => ({
      ...l,
      pricePerUnit: fromCents(centsOf(l.pricePerUnit)),
    })),
  };
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
        balance: fromCents(centsOf(t.balance)),
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
