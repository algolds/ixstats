/**
 * Read models for the Exchange page: the wallet overview, the contract lists and the share
 * market. Bids are sealed: the issuer sees every bid, a bidder sees only their own.
 */

import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, SYSTEM_REALM_IDS } from "~/lib/realms/realm-ids";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { exchangeService } from "~/lib/vault/exchange-service";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { centsOf, fromCents, round2 } from "./amounts";
import { INDEX_BASE, SECTOR_KEYS, listMyCompanies } from "./companies";
import { DAY_MS } from "./contracts";
import type { Db } from "./guards";
import { ACTIVITY_WINDOW_DAYS, SECTOR_LABELS } from "./sectors";
import { COMPANY_CREDIT_CAP_MAX, lendingTermsFor } from "./lending";

/** Everything the Exchange page header needs for one realm in one round trip. */
export async function getExchangeOverview(
  db: PrismaClient,
  userId: string,
  realmId: string = DEFAULT_REALM_ID
) {
  const [vaultCfg, cfg] = await Promise.all([getVaultConfig(db), getExchangeConfig(db)]);
  const balance = await exchangeService.getBalance(userId, db);
  const [companies, transactions, holdings, nations, buyOrders, realmNations, realms] =
    await Promise.all([
      listMyCompanies(db, userId, realmId),
      exchangeService.getTransactions(userId, db, 15),
      listMyHoldings(db, userId, realmId),
      listMyNations(db, userId),
      listMyBuyOrders(db, userId, realmId),
      listRealmNations(db, realmId),
      listOpenRealms(db),
    ]);
  return {
    realmId,
    isOpen: vaultCfg.isExchangeEnabled && !vaultCfg.isMaintenanceMode,
    wallet: balance,
    companyRules: { charterFee: cfg.charterFee, activeCompanyCap: cfg.activeCompanyCap },
    companies,
    transactions,
    holdings,
    buyOrders,
    nations,
    realmNations,
    realms,
  };
}

/**
 * A realm's market overview: each macro sector's index and macro weight, with its active
 * company count and completed contract volume over the activity window, plus the totals.
 */
export async function listRealmSectorSummary(db: Db, realmId: string, nowMs: number = Date.now()) {
  const since = nowMs - ACTIVITY_WINDOW_DAYS * DAY_MS;
  const [indices, companies, contracts] = await Promise.all([
    db.sectorIndex.findMany({ where: { realmId, sectorKey: { in: [...SECTOR_KEYS] } } }),
    db.company.findMany({ where: { realmId, status: "ACTIVE" }, select: { sectorKey: true } }),
    db.contract.findMany({
      where: { realmId, status: "COMPLETED", closedIxTime: { gte: since } },
      select: { sectorKey: true, value: true },
    }),
  ]);
  const sectors = SECTOR_KEYS.map((sectorKey) => {
    const row = indices.find((i) => i.sectorKey === sectorKey);
    return {
      sectorKey,
      label: SECTOR_LABELS[sectorKey],
      value: row?.value ?? INDEX_BASE,
      macroWeight: row?.macroWeight ?? 0,
      companyCount: companies.filter((c) => c.sectorKey === sectorKey).length,
      volume30d: fromCents(
        contracts
          .filter((k) => k.sectorKey === sectorKey)
          .reduce((s, k) => s + centsOf(k.value), 0)
      ),
    };
  });
  return {
    realmId,
    sectors,
    companyCount: companies.length,
    volume30d: fromCents(contracts.reduce((s, k) => s + centsOf(k.value), 0)),
  };
}

/** Nations the user owns or plays as: the ones they can issue government tenders for. */
export async function listMyNations(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { countryId: true } });
  const rows = await db.country.findMany({
    where: {
      OR: [{ ownerUserId: userId }, ...(user?.countryId ? [{ id: user.countryId }] : [])],
    },
    select: { id: true, name: true, realmId: true },
    take: 20,
  });
  return rows.map((c) => ({ id: c.id, name: c.name, realmId: c.realmId }));
}

/** Nations in the selected realm, for choosing a company's headquarters domicile, with their lending terms. */
export async function listRealmNations(db: Db, realmId: string) {
  const nations = await db.country.findMany({
    where: { realmId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, economicTier: true, interestRates: true },
    take: 150,
  });
  const terms = await lendingTermsFor(
    db,
    nations.map((n) => n.id)
  );
  return nations.map((n) => ({
    id: n.id,
    name: n.name,
    economicTier: n.economicTier,
    interestRates: n.interestRates,
    lendingSpread: terms.get(n.id)?.spread ?? 0,
    companyCreditCap: terms.get(n.id)?.cap ?? COMPANY_CREDIT_CAP_MAX,
  }));
}

/** Open realms for the Exchange workspace switcher, with Ixnay always first. */
export async function listOpenRealms(db: Db) {
  const rows = await db.realm.findMany({
    where: { status: "active", id: { notIn: [...SYSTEM_REALM_IDS, DEFAULT_REALM_ID] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 50,
  });
  return [{ id: DEFAULT_REALM_ID, name: "Ixnay" }, ...rows];
}

/** The user's open limit buy orders in one realm, newest first. */
export async function listMyBuyOrders(db: Db, userId: string, realmId: string) {
  const rows = await db.shareBuyOrder.findMany({
    where: { buyerUserId: userId, status: "OPEN", company: { realmId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      company: { select: { id: true, name: true, sectorKey: true } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    companyId: o.companyId,
    companyName: o.company.name,
    sectorKey: o.company.sectorKey,
    shares: o.shares,
    sharesOrdered: o.sharesOrdered,
    maxPricePerShare: fromCents(centsOf(o.maxPricePerShare)),
    escrow: fromCents(centsOf(o.escrow)),
    createdAt: o.createdAt,
  }));
}

/** The user's shareholdings in one realm (shares on sale included), largest first. */
export async function listMyHoldings(db: Db, userId: string, realmId: string) {
  const [holdings, listings] = await Promise.all([
    db.shareholding.findMany({
      where: { ownerUserId: userId, company: { realmId } },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            sectorKey: true,
            fairValue: true,
            sharesOutstanding: true,
            status: true,
            tradingOpen: true,
            founderId: true,
          },
        },
      },
    }),
    db.shareListing.findMany({
      where: { sellerUserId: userId, status: "OPEN" },
      select: { companyId: true, shares: true },
    }),
  ]);
  return holdings
    .map((h) => {
      const listed = listings
        .filter((l) => l.companyId === h.companyId)
        .reduce((s, l) => s + l.shares, 0);
      const owned = h.shares + listed;
      const c = h.company;
      const fairValue = fromCents(centsOf(c.fairValue));
      return {
        companyId: h.companyId,
        name: c.name,
        sectorKey: c.sectorKey,
        status: c.status,
        tradingOpen: c.tradingOpen,
        founded: c.founderId === userId,
        shares: h.shares,
        listed,
        avgCost: fromCents(centsOf(h.avgCost)),
        stake: c.sharesOutstanding > 0 ? owned / c.sharesOutstanding : 0,
        fairValue:
          c.sharesOutstanding > 0 ? round2((fairValue * owned) / c.sharesOutstanding) : 0,
      };
    })
    .filter((h) => h.shares + h.listed > 0)
    .sort((a, b) => b.fairValue - a.fairValue);
}

/** Open share listings across one realm's ACTIVE companies, cheapest first. */
export async function listShareMarket(db: Db, userId: string, realmId: string = DEFAULT_REALM_ID) {
  const rows = await db.shareListing.findMany({
    where: { status: "OPEN", company: { realmId, status: "ACTIVE" } },
    orderBy: [{ pricePerShare: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          sectorKey: true,
          fairValue: true,
          sharesOutstanding: true,
          status: true,
          tradingOpen: true,
          founderId: true,
        },
      },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    companyName: l.company.name,
    sectorKey: l.company.sectorKey,
    tradingOpen: l.company.tradingOpen,
    primary: l.sellerUserId === null,
    mine: l.sellerUserId === userId || (l.sellerUserId === null && l.company.founderId === userId),
    shares: l.shares,
    sharesListed: l.sharesListed,
    pricePerShare: fromCents(centsOf(l.pricePerShare)),
    fairPricePerShare:
      l.company.sharesOutstanding > 0
        ? round2(fromCents(centsOf(l.company.fairValue)) / l.company.sharesOutstanding)
        : null,
  }));
}

export type ContractScope = "open" | "mine";

/**
 * "open": contracts still taking bids. "mine": contracts my companies issued, won or bid
 * on, in any status.
 */
export async function listContracts(
  db: Db,
  userId: string,
  scope: ContractScope,
  realmId?: string
) {
  const myCompanies = await db.company.findMany({
    where: { founderId: userId, ...(realmId ? { realmId } : {}) },
    select: { id: true },
  });
  const myIds = myCompanies.map((c) => c.id);
  const nowMs = Date.now();
  const realmWhere = realmId ? { realmId } : {};

  const where =
    scope === "open"
      ? { ...realmWhere, status: "OPEN", endIxTime: { gt: nowMs } }
      : {
          ...realmWhere,
          OR: [
            { issuerUserId: userId },
            { winnerCompanyId: { in: myIds } },
            { bids: { some: { companyId: { in: myIds } } } },
          ],
        };

  const rows = await db.contract.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      issuerCompany: { select: { id: true, name: true, hqCountryId: true } },
      bids: {
        orderBy: { amount: "asc" },
        include: {
          company: { select: { id: true, name: true, standing: true, hqCountryId: true } },
        },
      },
    },
  });

  const countryIds = [
    ...new Set(rows.map((c) => c.issuerCountryId).filter((id): id is string => !!id)),
  ];
  const nations = countryIds.length
    ? await db.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, name: true },
      })
    : [];
  const nationNames = new Map(nations.map((n) => [n.id, n.name]));

  return rows.map((c) => {
    const isIssuer = c.issuerUserId === userId;
    const isContractor = !!c.winnerCompanyId && myIds.includes(c.winnerCompanyId);
    const visibleBids = isIssuer ? c.bids : c.bids.filter((b) => myIds.includes(b.companyId));
    return {
      id: c.id,
      realmId: c.realmId,
      type: c.type,
      fundedBy: c.fundedBy,
      title: c.title,
      description: c.description,
      sectorKey: c.sectorKey,
      value: fromCents(centsOf(c.value)),
      escrow: fromCents(centsOf(c.escrow)),
      status: c.status,
      issuerCountryId: c.issuerCountryId,
      linkedDirectiveId: c.linkedDirectiveId,
      linkedIssueId: c.linkedIssueId,
      issuer:
        c.issuerCompany ??
        (c.issuerCountryId
          ? {
              id: c.issuerCountryId,
              name: nationNames.get(c.issuerCountryId) ?? "A nation",
              hqCountryId: c.issuerCountryId,
            }
          : null),
      winnerCompanyId: c.winnerCompanyId,
      awardedBidId: c.awardedBidId,
      disputeReason: c.disputeReason,
      resolutionNote: c.resolutionNote,
      role: isIssuer ? "issuer" : isContractor ? "contractor" : "bidder",
      biddingOpen: c.status === "OPEN" && c.endIxTime > nowMs,
      biddingClosesAt: new Date(c.endIxTime),
      bidCount: c.bids.length,
      bids: visibleBids.map((b) => ({
        id: b.id,
        amount: fromCents(centsOf(b.amount)),
        outcome: b.outcome,
        company: b.company,
        mine: myIds.includes(b.companyId),
      })),
      createdAt: c.createdAt,
    };
  });
}

/** Admin: contracts waiting for a dispute decision, oldest first. */
export async function listDisputes(db: Db) {
  const rows = await db.contract.findMany({
    where: { status: "DISPUTED" },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: { issuerCompany: { select: { id: true, name: true } } },
  });
  return rows.map((c) => ({
    ...c,
    value: fromCents(centsOf(c.value)),
    escrow: fromCents(centsOf(c.escrow)),
    tariffPaid: fromCents(centsOf(c.tariffPaid)),
  }));
}
