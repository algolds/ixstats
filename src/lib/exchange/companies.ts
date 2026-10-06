/**
 * Exchange companies (MVP). Spec: docs/specs/2026-10-06-exchange-economy-design.md §3.
 *
 * Any signed-in player can charter up to `activeCompanyCap` ACTIVE companies for the
 * charter fee (burned). The founder receives all FOUNDER_SHARES shares (one ShareIssuance
 * and one Shareholding row); share trading is phase 2. A company holds capital: the
 * founder deposits ₷ from their wallet and withdraws it back, contract escrow is funded
 * from it and contract payouts land in it. Capital only moves with conditional updates.
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

/** The four macro sectors, matching the SectorIndex rows. */
export const SECTOR_KEYS = ["agriculture", "industry", "services", "government"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export const FOUNDER_SHARES = 1000;

/** Statuses a contract can hold while it still ties up a company. */
export const LIVE_CONTRACT_STATUSES = ["OPEN", "AWARDED", "DISPUTED"];

/**
 * MVP fair value: capital, plus a quarter of the contract value won, plus 100 per point
 * of positive standing. Phase 2 replaces it with the sector-index valuation.
 */
export function computeFairValue(c: {
  capital: number;
  contractsWonValue: number;
  standing: number;
}): number {
  return round2(c.capital + 0.25 * c.contractsWonValue + 100 * Math.max(0, c.standing));
}

/** Recompute a company's fair value and record a CompanyValueHistory row. */
export async function refreshFairValue(tx: Db, companyId: string): Promise<void> {
  const c = await tx.company.findUnique({
    where: { id: companyId },
    select: { capital: true, contractsWonValue: true, standing: true },
  });
  if (!c) return;
  const fairValue = computeFairValue(c);
  await tx.company.update({ where: { id: companyId }, data: { fairValue } });
  await tx.companyValueHistory.create({
    data: {
      companyId,
      fairValue,
      breakdown: {
        capital: c.capital,
        contracts: round2(0.25 * c.contractsWonValue),
        standing: 100 * Math.max(0, c.standing),
      },
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

/** Move ₷ from the company's capital back to the founder's wallet. */
export async function withdrawFromCompany(db: PrismaClient, input: CapitalMoveInput) {
  assertWholeAmount(input.amount);
  const key = `exchange:withdraw:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await requireOwnedCompany(tx, input.companyId, input.userId);
      await lockWallet(tx, input.userId); // a same-key retry waits here, then sees the row
      const applied = await tx.exchangeTransaction.findUnique({
        where: { idempotencyKey: key },
        select: { balanceAfter: true },
      });
      if (applied) return { newBalance: applied.balanceAfter, alreadyApplied: true };

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
 * Close a company: refused while it issues or holds a live contract. Pending bids are
 * withdrawn and the remaining capital goes back to the founder's wallet.
 */
export async function dissolveCompany(
  db: PrismaClient,
  input: { userId: string; companyId: string }
) {
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
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
    await tx.contractBid.deleteMany({ where: { companyId: company.id, outcome: null } });

    const { count } = await tx.company.updateMany({
      where: { id: company.id, status: "ACTIVE", capital: company.capital },
      data: { status: "DELISTED", capital: 0 },
    });
    if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");

    if (company.capital > 0) {
      await earnSovereignsTx(tx, {
        userId: input.userId,
        amount: company.capital,
        type: "COMPANY_WITHDRAW",
        source: `COMPANY_DISSOLVE:${company.id}`,
        metadata: { companyId: company.id },
        idempotencyKey: `exchange:dissolve:${company.id}`,
      });
    }
    await refreshFairValue(tx, company.id);
    return { returned: company.capital };
  });
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
