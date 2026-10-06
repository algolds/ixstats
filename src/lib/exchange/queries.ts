/**
 * Read models for the Exchange page: the wallet overview and the contract lists.
 * Bids are sealed: the issuer sees every bid, a bidder sees only their own.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { exchangeService } from "~/lib/vault/exchange-service";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { listMyCompanies } from "./companies";
import { convertOutAllowance, convertedToday } from "./conversion";
import { round2, type Db } from "./guards";

/** Everything the Exchange page header needs in one round trip. */
export async function getExchangeOverview(db: PrismaClient, userId: string) {
  const [vaultCfg, cfg] = await Promise.all([getVaultConfig(db), getExchangeConfig(db)]);
  const balance = await exchangeService.getBalance(userId, db);
  const [today, allowance, companies, transactions] = await Promise.all([
    convertedToday(db, userId),
    convertOutAllowance(db, userId),
    listMyCompanies(db, userId),
    exchangeService.getTransactions(userId, db, 15),
  ]);
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
    },
    companyRules: { charterFee: cfg.charterFee, activeCompanyCap: cfg.activeCompanyCap },
    companies,
    transactions,
  };
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
      issuer: c.issuerCompany,
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
