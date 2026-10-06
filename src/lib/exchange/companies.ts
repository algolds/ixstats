/**
 * Exchange companies (MVP). Spec: docs/specs/2026-10-06-exchange-economy-design.md §3.
 *
 * Any signed-in player can charter up to `activeCompanyCap` ACTIVE companies for the
 * charter fee (burned). The founder receives all FOUNDER_SHARES shares (one ShareIssuance
 * and one Shareholding row); shares then trade on the share market (shares.ts). A company
 * holds capital: the founder deposits ₷ from their wallet and withdraws it back, contract
 * escrow is funded from it, contract payouts land in it and dividends are paid from it.
 * Capital only moves with conditional updates. Control stays with the founder whatever
 * share they hold: shares carry dividends and value, not votes.
 */

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { assertExchangeOpen, lockWallet, round2, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { formatSovereigns } from "./quote";
import { fromCents, holdersOf, lockCompany, splitProRata, toCents } from "./ownership";

/** The four macro sectors, matching the SectorIndex rows. */
export const SECTOR_KEYS = ["agriculture", "industry", "services", "government"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export const FOUNDER_SHARES = 1000;

/** Statuses a contract can hold while it still ties up a company. */
export const LIVE_CONTRACT_STATUSES = ["OPEN", "AWARDED", "DISPUTED"];

/** The index level every sector starts at (SectorIndex.value default). */
export const INDEX_BASE = 1000;

export interface FairValueWeights {
  valuationSectorWeight: number;
  valuationStandingWeight: number;
  valuationDecisionWeight: number;
}

export interface FairValueBreakdown {
  capital: number;
  contracts: number;
  standing: number;
  /** Multiplier from the company's sector index (1 at the base level of 1,000). */
  sectorFactor: number;
  decisions: number;
  fairValue: number;
}

const DEFAULT_WEIGHTS: FairValueWeights = {
  valuationSectorWeight: 1,
  valuationStandingWeight: 0.5,
  valuationDecisionWeight: 1,
};

/**
 * Fair value (spec §8, sector-index valuation):
 *   book   = capital + 0.25 × contracts won + 200 × standingWeight × positive standing
 *   factor = 1 + sectorWeight × (sector index ÷ 1,000 − 1), held to 0.5 .. 2
 *   value  = book × factor + decisionWeight × decisionValue (applied EXPAND decisions)
 * With the default weights and an index at 1,000 this is the MVP formula (100 per point of
 * standing). It is a reference price for primary share issues and the directory, not money.
 */
export function computeFairValue(
  c: { capital: number; contractsWonValue: number; standing: number; decisionValue?: number },
  sectorIndexValue: number = INDEX_BASE,
  weights: FairValueWeights = DEFAULT_WEIGHTS
): FairValueBreakdown {
  const contracts = round2(0.25 * c.contractsWonValue);
  const standing = round2(200 * weights.valuationStandingWeight * Math.max(0, c.standing));
  const rawFactor = 1 + weights.valuationSectorWeight * (sectorIndexValue / INDEX_BASE - 1);
  const sectorFactor = Math.round(Math.min(2, Math.max(0.5, rawFactor)) * 10_000) / 10_000;
  const decisions = round2(weights.valuationDecisionWeight * (c.decisionValue ?? 0));
  const fairValue = round2((c.capital + contracts + standing) * sectorFactor + decisions);
  return { capital: c.capital, contracts, standing, sectorFactor, decisions, fairValue };
}

/** Recompute a company's fair value and record a CompanyValueHistory row. */
export async function refreshFairValue(tx: Db, companyId: string): Promise<void> {
  const c = await tx.company.findUnique({
    where: { id: companyId },
    select: {
      capital: true,
      contractsWonValue: true,
      standing: true,
      decisionValue: true,
      sectorKey: true,
    },
  });
  if (!c) return;
  const [index, cfg] = await Promise.all([
    tx.sectorIndex.findUnique({ where: { sectorKey: c.sectorKey }, select: { value: true } }),
    getExchangeConfig(tx),
  ]);
  const breakdown = computeFairValue(c, index?.value ?? INDEX_BASE, cfg);
  await tx.company.update({ where: { id: companyId }, data: { fairValue: breakdown.fairValue } });
  await tx.companyValueHistory.create({
    data: {
      companyId,
      fairValue: breakdown.fairValue,
      breakdown: { ...breakdown },
      recordedIxTime: IxTime.getCurrentIxTime(),
    },
  });
}

/** Load a company the user founded and that is still ACTIVE, or throw. */
export async function requireOwnedCompany(tx: Db, companyId: string, userId: string) {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "You did not found this company");
  }
  if (company.status !== "ACTIVE") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }
  return company;
}

export interface FoundCompanyInput {
  userId: string;
  name: string;
  sectorKey: SectorKey;
  requestId: string;
}

/** Charter a company: pay the fee, create it and give the founder every share. */
export async function foundCompany(db: PrismaClient, input: FoundCompanyInput) {
  const key = `exchange:charter:${input.userId}:${input.requestId}`;
  const name = input.name.trim();
  const findExisting = () => db.company.findFirst({ where: { founderId: input.userId, name } });

  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockWallet(tx, input.userId); // serialises this user's charters for the cap check

      const applied = await tx.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) {
        const existing = await tx.company.findFirst({ where: { founderId: input.userId, name } });
        if (existing) return { company: existing, alreadyApplied: true };
      }

      const cfg = await getExchangeConfig(tx);
      const active = await tx.company.count({
        where: { founderId: input.userId, status: "ACTIVE" },
      });
      if (active >= cfg.activeCompanyCap) {
        throw new ExchangeError(
          "LIMIT_REACHED",
          `You can run up to ${cfg.activeCompanyCap} active companies`
        );
      }
      const taken = await tx.company.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (taken) throw new ExchangeError("CONFLICT", "That company name is taken");

      if (cfg.charterFee > 0) {
        await spendSovereignsTx(tx, {
          userId: input.userId,
          amount: cfg.charterFee,
          type: "CHARTER_FEE",
          source: `COMPANY_CHARTER:${name}`,
          metadata: { name, sectorKey: input.sectorKey },
          idempotencyKey: key,
        });
      }

      const now = IxTime.getCurrentIxTime();
      const pricePerShare = round2(cfg.charterFee / FOUNDER_SHARES);
      const company = await tx.company.create({
        data: {
          founderId: input.userId,
          name,
          sectorKey: input.sectorKey,
          sharesIssued: FOUNDER_SHARES,
          sharesOutstanding: FOUNDER_SHARES,
          createdIxTime: now,
        },
      });
      await tx.shareIssuance.create({
        data: { companyId: company.id, shares: FOUNDER_SHARES, pricePerShare, issuedIxTime: now },
      });
      await tx.shareholding.create({
        data: {
          companyId: company.id,
          ownerUserId: input.userId,
          shares: FOUNDER_SHARES,
          avgCost: pricePerShare,
        },
      });
      await refreshFairValue(tx, company.id);
      return { company, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findExisting();
      const applied = await db.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (existing && applied) return { company: existing, alreadyApplied: true };
      throw new ExchangeError("CONFLICT", "That company name is taken");
    }
    throw error;
  }
}

export interface CapitalMoveInput {
  userId: string;
  companyId: string;
  amount: number;
  requestId: string;
}

function assertWholeAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }
}

/** Move ₷ from the founder's wallet into the company's capital. */
export async function depositToCompany(db: PrismaClient, input: CapitalMoveInput) {
  assertWholeAmount(input.amount);
  const key = `exchange:deposit:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      await requireOwnedCompany(tx, input.companyId, input.userId);
      const r = await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: input.amount,
        type: "COMPANY_DEPOSIT",
        source: `COMPANY_DEPOSIT:${input.companyId}`,
        metadata: { companyId: input.companyId },
        idempotencyKey: key,
      });
      if (r.alreadyApplied) return { newBalance: r.newBalance, alreadyApplied: true };
      await tx.company.update({
        where: { id: input.companyId },
        data: { capital: { increment: input.amount } },
      });
      await refreshFairValue(tx, input.companyId);
      return { newBalance: r.newBalance, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { newBalance: 0, alreadyApplied: true };
    throw error;
  }
}

/**
 * Move ₷ from the company's capital back to the founder's wallet. Refused once anyone else
 * holds shares: capital they part own leaves only pro rata (dividends, dissolution).
 */
export async function withdrawFromCompany(db: PrismaClient, input: CapitalMoveInput) {
  assertWholeAmount(input.amount);
  const key = `exchange:withdraw:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      await requireOwnedCompany(tx, input.companyId, input.userId);
      await lockWallet(tx, input.userId); // a same-key retry waits here, then sees the row
      const applied = await tx.exchangeTransaction.findUnique({
        where: { idempotencyKey: key },
        select: { balanceAfter: true },
      });
      if (applied) return { newBalance: applied.balanceAfter, alreadyApplied: true };
      const holders = await holdersOf(tx, input.companyId);
      if (holders.some((h) => h.userId !== input.userId)) {
        throw new ExchangeError(
          "CONFLICT",
          "Other players own shares in this company: pay a dividend instead of withdrawing"
        );
      }
      const primaryOnSale = await tx.shareListing.count({
        where: { companyId: input.companyId, status: "OPEN", sellerUserId: null },
      });
      if (primaryOnSale > 0) {
        throw new ExchangeError(
          "CONFLICT",
          "New shares are on sale at a price set from this capital: cancel the issue first"
        );
      }

      const { count } = await tx.company.updateMany({
        where: { id: input.companyId, status: "ACTIVE", capital: { gte: input.amount } },
        data: { capital: { decrement: input.amount } },
      });
      if (count !== 1) {
        throw new ExchangeError("INSUFFICIENT_SOVEREIGNS", "The company doesn't hold that much");
      }
      const r = await earnSovereignsTx(tx, {
        userId: input.userId,
        amount: input.amount,
        type: "COMPANY_WITHDRAW",
        source: `COMPANY_WITHDRAW:${input.companyId}`,
        metadata: { companyId: input.companyId },
        idempotencyKey: key,
      });
      await refreshFairValue(tx, input.companyId);
      return { newBalance: r.newBalance, alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { newBalance: 0, alreadyApplied: true };
    throw error;
  }
}

/**
 * Close a company: refused while it issues or holds a live contract or has a decision
 * pending. Pending bids are withdrawn, open share listings cancelled (listed shares go back
 * to their holders) and the remaining capital is paid out pro rata to the shareholders, the
 * founder taking the rounding remainder (all of it when they hold every share).
 */
export async function dissolveCompany(
  db: PrismaClient,
  input: { userId: string; companyId: string }
) {
  const notices: ExchangeNotice[] = [];
  const result = await db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    await lockCompany(tx, input.companyId);
    const company = await requireOwnedCompany(tx, input.companyId, input.userId);
    const live = await tx.contract.count({
      where: {
        OR: [
          { issuerCompanyId: company.id, status: { in: LIVE_CONTRACT_STATUSES } },
          { winnerCompanyId: company.id, status: { in: ["AWARDED", "DISPUTED"] } },
        ],
      },
    });
    if (live > 0) {
      throw new ExchangeError(
        "CONFLICT",
        "Settle or cancel this company's contracts before dissolving it"
      );
    }
    const pending = await tx.companyDecision.count({
      where: { companyId: company.id, appliedIxTime: null },
    });
    if (pending > 0) {
      throw new ExchangeError("CONFLICT", "Wait for the pending decision to resolve first");
    }
    await tx.contractBid.deleteMany({ where: { companyId: company.id, outcome: null } });
    await returnListedShares(tx, company.id);

    const { count } = await tx.company.updateMany({
      where: { id: company.id, status: "ACTIVE", capital: company.capital },
      data: { status: "DELISTED", capital: 0, tradingOpen: false },
    });
    if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");

    const split = splitProRata(toCents(company.capital), await holdersOf(tx, company.id));
    const payouts = new Map(split.payouts.map((p) => [p.userId, p.cents]));
    payouts.set(input.userId, (payouts.get(input.userId) ?? 0) + split.remainderCents);
    for (const [userId, cents] of [...payouts].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (cents <= 0) continue;
      const founder = userId === input.userId;
      await earnSovereignsTx(tx, {
        userId,
        amount: fromCents(cents),
        type: founder ? "COMPANY_WITHDRAW" : "DIVIDEND",
        source: `COMPANY_DISSOLVE:${company.id}`,
        metadata: { companyId: company.id, liquidation: true },
        idempotencyKey: founder
          ? `exchange:dissolve:${company.id}`
          : `exchange:dissolve:${company.id}:${userId}`,
      });
      if (!founder) {
        notices.push({
          userId,
          title: `${company.name} was dissolved`,
          message: `Your share of its capital, ${formatSovereigns(fromCents(cents))}, is in your wallet.`,
        });
      }
    }
    await refreshFairValue(tx, company.id);
    return { returned: fromCents(payouts.get(input.userId) ?? 0) };
  });
  notifyExchange(notices);
  return result;
}

/** Cancel a company's open listings, giving secondary sellers their escrowed shares back. */
export async function returnListedShares(tx: Db, companyId: string): Promise<void> {
  const open = await tx.shareListing.findMany({ where: { companyId, status: "OPEN" } });
  for (const l of open) {
    const { count } = await tx.shareListing.updateMany({
      where: { id: l.id, status: "OPEN" },
      data: { status: "CANCELLED", shares: 0 },
    });
    if (count === 1 && l.sellerUserId && l.shares > 0) {
      await tx.shareholding.update({
        where: { companyId_ownerUserId: { companyId, ownerUserId: l.sellerUserId } },
        data: { shares: { increment: l.shares } },
      });
    }
  }
}

const COMPANY_SELECT = {
  id: true,
  name: true,
  sectorKey: true,
  capital: true,
  standing: true,
  fairValue: true,
  sharesIssued: true,
  contractsWonValue: true,
  decisionValue: true,
  tradingOpen: true,
  sharesOutstanding: true,
  status: true,
  founderId: true,
  createdAt: true,
} as const;

/** The user's companies, newest first (DELISTED ones included, last). */
export async function listMyCompanies(db: Db, userId: string) {
  const rows = await db.company.findMany({
    where: { founderId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: COMPANY_SELECT,
    take: 50,
  });
  return rows;
}

/** The directory: ACTIVE companies by fair value. */
export async function listCompanies(db: Db, limit = 50) {
  return db.company.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ fairValue: "desc" }, { createdAt: "asc" }],
    select: COMPANY_SELECT,
    take: Math.min(Math.max(limit, 1), 100),
  });
}
