/**
 * Read models for the Exchange page: the wallet overview, the contract lists and the share
 * market. Bids are sealed: the issuer sees every bid, a bidder sees only their own.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { exchangeService } from "~/lib/vault/exchange-service";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { listMyCompanies } from "./companies";
import { convertOutAllowance, convertedToday, convertibleContractRevenue } from "./conversion";
import { round2, type Db } from "./guards";

/** Everything the Exchange page header needs in one round trip. */
export async function getExchangeOverview(db: PrismaClient, userId: string) {
  const [vaultCfg, cfg] = await Promise.all([getVaultConfig(db), getExchangeConfig(db)]);
  const balance = await exchangeService.getBalance(userId, db);
  const [today, allowance, revenue, companies, transactions, holdings, nations] = await Promise.all(
    [
      convertedToday(db, userId),
      convertOutAllowance(db, userId),
      convertibleContractRevenue(db, userId),
      listMyCompanies(db, userId),
      exchangeService.getTransactions(userId, db, 15),
      listMyHoldings(db, userId),
      listMyNations(db, userId),
    ]
  );
  return {
    isOpen: vaultCfg.isExchangeEnabled && !vaultCfg.isMaintenanceMode,
    wallet: balance,
    conversion: {
      rate: cfg.convertRate,
      fee: cfg.convertFee,
      dailyLimit: cfg.convertDailyLimit,
      usedToday: round2(today),
      remainingToday: Math.max(0, round2(cfg.convertDailyLimit - today)),
      convertOutAllowance: allowance,
      convertibleRevenue: revenue,
      revenueShare: cfg.revenueConvertibleShare,
      revenueHoldDays: cfg.revenueHoldDays,
    },
    companyRules: { charterFee: cfg.charterFee, activeCompanyCap: cfg.activeCompanyCap },
    companies,
    transactions,
    holdings,
    nations,
  };
}

/** Nations the user owns or plays as: the ones they can issue government tenders for. */
export async function listMyNations(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { countryId: true } });
  const rows = await db.country.findMany({
    where: {
      OR: [{ ownerUserId: userId }, ...(user?.countryId ? [{ id: user.countryId }] : [])],
    },
    select: { id: true, name: true },
    take: 20,
  });
  return rows.map((c) => ({ id: c.id, name: c.name }));
}

/** The user's shareholdings (shares on sale included), largest first. */
export async function listMyHoldings(db: Db, userId: string) {
  const [holdings, listings] = await Promise.all([
    db.shareholding.findMany({
      where: { ownerUserId: userId },
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
      return {
        companyId: h.companyId,
        name: c.name,
        sectorKey: c.sectorKey,
        status: c.status,
        tradingOpen: c.tradingOpen,
        founded: c.founderId === userId,
        shares: h.shares,
        listed,
        avgCost: h.avgCost,
        stake: c.sharesOutstanding > 0 ? owned / c.sharesOutstanding : 0,
        fairValue:
          c.sharesOutstanding > 0 ? round2((c.fairValue * owned) / c.sharesOutstanding) : 0,
      };
    })
    .filter((h) => h.shares + h.listed > 0)
    .sort((a, b) => b.fairValue - a.fairValue);
}

/** Open share listings across ACTIVE companies, cheapest first per company. */
export async function listShareMarket(db: Db, userId: string) {
  const rows = await db.shareListing.findMany({
    where: { status: "OPEN" },
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
  return rows
    .filter((l) => l.company.status === "ACTIVE")
    .map((l) => ({
      id: l.id,
      companyId: l.companyId,
      companyName: l.company.name,
      sectorKey: l.company.sectorKey,
      tradingOpen: l.company.tradingOpen,
      primary: l.sellerUserId === null,
      mine:
        l.sellerUserId === userId || (l.sellerUserId === null && l.company.founderId === userId),
      shares: l.shares,
      sharesListed: l.sharesListed,
      pricePerShare: l.pricePerShare,
      fairPricePerShare:
        l.company.sharesOutstanding > 0
          ? round2(l.company.fairValue / l.company.sharesOutstanding)
          : null,
    }));
}

/** Real-time estimate of when an IxTime instant arrives. */
function ixToRealDate(ixTime: number): Date {
  const remainingIx = ixTime - IxTime.getCurrentIxTime();
  return new Date(Date.now() + remainingIx / Math.max(IxTime.getTimeMultiplier(), 1e-6));
}

export type ContractScope = "open" | "mine";

/**
 * "open": contracts still taking bids. "mine": contracts my companies issued, won or bid
 * on, in any status.
 */
export async function listContracts(db: Db, userId: string, scope: ContractScope) {
  const myCompanies = await db.company.findMany({
    where: { founderId: userId },
    select: { id: true },
  });
  const myIds = myCompanies.map((c) => c.id);
  const nowIx = IxTime.getCurrentIxTime();

  const where =
    scope === "open"
      ? { status: "OPEN", endIxTime: { gt: nowIx } }
      : {
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
      issuerCompany: { select: { id: true, name: true } },
      bids: {
        orderBy: { amount: "asc" },
        include: { company: { select: { id: true, name: true, standing: true } } },
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
      type: c.type,
      title: c.title,
      description: c.description,
      sectorKey: c.sectorKey,
      value: c.value,
      escrow: c.escrow,
      status: c.status,
      issuer:
        c.issuerCompany ??
        (c.issuerCountryId
          ? { id: c.issuerCountryId, name: nationNames.get(c.issuerCountryId) ?? "A nation" }
          : null),
      winnerCompanyId: c.winnerCompanyId,
      awardedBidId: c.awardedBidId,
      disputeReason: c.disputeReason,
      resolutionNote: c.resolutionNote,
      role: isIssuer ? "issuer" : isContractor ? "contractor" : "bidder",
      biddingOpen: c.status === "OPEN" && c.endIxTime > nowIx,
      biddingClosesAt: ixToRealDate(c.endIxTime),
      bidCount: c.bids.length,
      bids: visibleBids.map((b) => ({
        id: b.id,
        amount: b.amount,
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
  return db.contract.findMany({
    where: { status: "DISPUTED" },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: { issuerCompany: { select: { id: true, name: true } } },
  });
}
