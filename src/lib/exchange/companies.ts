/**
 * Exchange companies (MVP). Spec: docs/specs/2026-10-06-exchange-economy-design.md.
 *
 * Any signed-in player can charter up to `activeCompanyCap` ACTIVE companies per realm for the
 * charter fee (burned). The founder receives all FOUNDER_SHARES shares (one ShareIssuance
 * and one Shareholding row); shares then trade on the share market (shares.ts). A company
 * holds capital: the founder deposits ₷ from their wallet and withdraws it back, contract
 * escrow is funded from it, contract payouts land in it and dividends are paid from it.
 * Capital only moves with conditional updates. Control stays with the founder whatever
 * share they hold: shares carry dividends and value, not votes.
 *
 * A company belongs to one realm. Its name is unique within that realm, and its HQ nation
 * must belong to the same realm, so the realm's tax, interest and sector rules apply.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, SYSTEM_REALM_IDS } from "~/lib/realms/realm-ids";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import {
  ExchangeError,
  earnSovereignsTx,
  isUniqueViolation,
  spendSovereignsTx,
} from "~/lib/vault/exchange-service";
import { assertExchangeOpen, lockWallet, type Db } from "./guards";
import { notifyExchange, type ExchangeNotice } from "./notify";
import { centsOf, dbCents, formatSovereigns } from "./amounts";
import { fromCents, holdersOf, lockCompany, splitProRata, toCents } from "./ownership";
import { returnBuyOrders } from "./shares";
import { closeCompanyProposalsTx } from "./acquisition";
import { unwindCompanyMoneyTx } from "./unwind";
import { subIndustriesOf, type SubIndustryKey } from "./taxonomy";
import { publishNewsTx } from "./news";

/** The four macro sectors, matching the SectorIndex rows. */
export const SECTOR_KEYS = ["agriculture", "industry", "services", "government"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export const FOUNDER_SHARES = 1000;

/** Statuses a contract can hold while it still ties up a company. */
export const LIVE_CONTRACT_STATUSES = ["OPEN", "AWARDED", "DISPUTED"];

export {
  INDEX_BASE,
  computeFairValue,
  type FairValueBreakdown,
  type FairValueWeights,
} from "./valuation";
import { INDEX_BASE, computeFairValue } from "./valuation";

export interface CompanyMoney {
  capital: number;
  fairValue: number;
  contractsWonValue: number;
  decisionValue: number;
  creditDrawn: number;
  lastTradePrice: number | null;
  lastTickRevenue: number;
  lastTickExpenses: number;
  lastTickTax: number;
  lastTickNetIncome: number;
}

/** Convert a Company row's BigInt cent fields to ₷ numbers for API and UI readers. */
export function companyView<
  T extends {
    capital: bigint;
    fairValue: bigint;
    contractsWonValue: bigint;
    decisionValue: bigint;
    creditDrawn: bigint;
    lastTradePrice?: bigint | null;
    lastTickRevenue: bigint;
    lastTickExpenses: bigint;
    lastTickTax: bigint;
    lastTickNetIncome: bigint;
  },
>(c: T): Omit<T, keyof CompanyMoney> & CompanyMoney {
  return {
    ...c,
    capital: fromCents(centsOf(c.capital)),
    fairValue: fromCents(centsOf(c.fairValue)),
    contractsWonValue: fromCents(centsOf(c.contractsWonValue)),
    decisionValue: fromCents(centsOf(c.decisionValue)),
    creditDrawn: fromCents(centsOf(c.creditDrawn)),
    lastTradePrice:
      c.lastTradePrice !== undefined && c.lastTradePrice !== null
        ? fromCents(centsOf(c.lastTradePrice))
        : null,
    lastTickRevenue: fromCents(centsOf(c.lastTickRevenue)),
    lastTickExpenses: fromCents(centsOf(c.lastTickExpenses)),
    lastTickTax: fromCents(centsOf(c.lastTickTax)),
    lastTickNetIncome: fromCents(centsOf(c.lastTickNetIncome)),
  };
}

/** Recompute a company's fair value and record a CompanyValueHistory row. */
export async function refreshFairValue(tx: Db, companyId: string): Promise<void> {
  const c = await tx.company.findUnique({
    where: { id: companyId },
    select: {
      realmId: true,
      capital: true,
      creditDrawn: true,
      contractsWonValue: true,
      standing: true,
      decisionValue: true,
      sectorKey: true,
    },
  });
  if (!c) return;
  const [index, cfg] = await Promise.all([
    tx.sectorIndex.findUnique({
      where: { realmId_sectorKey: { realmId: c.realmId, sectorKey: c.sectorKey } },
      select: { value: true },
    }),
    getExchangeConfig(tx),
  ]);
  const breakdown = computeFairValue(
    {
      capital: fromCents(centsOf(c.capital)),
      creditDrawn: fromCents(centsOf(c.creditDrawn)),
      contractsWonValue: fromCents(centsOf(c.contractsWonValue)),
      standing: c.standing,
      decisionValue: fromCents(centsOf(c.decisionValue)),
    },
    index?.value ?? INDEX_BASE,
    cfg
  );
  const fairValue = dbCents(toCents(breakdown.fairValue));
  await tx.company.update({ where: { id: companyId }, data: { fairValue } });
  await tx.companyValueHistory.create({
    data: {
      companyId,
      fairValue,
      breakdown: { ...breakdown },
      recordedIxTime: Date.now(),
    },
  });
}

/** Load a company the user founded and that is still ACTIVE (or DISTRESSED when allowed), or throw. */
export async function requireOwnedCompany(
  tx: Db,
  companyId: string,
  userId: string,
  allowDistress = false
) {
  const company = await tx.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.founderId !== userId) {
    throw new ExchangeError("FORBIDDEN", "You did not found this company");
  }
  if (allowDistress && company.status === "DISTRESSED") return company;
  if (company.status !== "ACTIVE") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }
  return company;
}

export async function assertNoVoteNeeded(
  tx: Db,
  company: { id: string; founderId: string; sharesOutstanding: number }
): Promise<void> {
  if (company.sharesOutstanding <= 0) return;
  const holders = await holdersOf(tx, company.id);
  const outside = holders
    .filter((h) => h.userId !== company.founderId)
    .reduce((sum, h) => sum + h.shares, 0);
  if (outside / company.sharesOutstanding >= 0.1) {
    throw new ExchangeError(
      "CONFLICT",
      "Outside shareholders own 10% or more: open a shareholder vote to do this"
    );
  }
}

export interface FoundCompanyInput {
  userId: string;
  name: string;
  sectorKey: SectorKey;
  /** Must belong to `sectorKey`; defaults to the sector's first sub-industry. */
  subIndustryKey?: SubIndustryKey;
  hqCountryId?: string | null;
  wikiSlug?: string | null;
  wikiData?: Prisma.InputJsonValue;
  /** Defaults to Ixnay (`"default"`). */
  realmId?: string;
  requestId: string;
}

/**
 * Only Ixnay and an active realm take charters. A system shelf never does, even when its
 * realm row says active. This restates `isRealmOpen` from the realms module: importing it
 * would pull the auth barrel and its database client into the exchange code.
 */
async function assertRealmOpenForCharters(tx: Db, realmId: string): Promise<void> {
  if ((SYSTEM_REALM_IDS as readonly string[]).includes(realmId)) {
    throw new ExchangeError("CONFLICT", "That realm does not take companies");
  }
  if (realmId === DEFAULT_REALM_ID) return;
  const realm = await tx.realm.findUnique({ where: { id: realmId }, select: { status: true } });
  if (realm?.status !== "active") {
    throw new ExchangeError("CONFLICT", "That realm is not taking new companies");
  }
}

async function assertHqInRealm(tx: Db, hqCountryId: string, realmId: string): Promise<void> {
  const country = await tx.country.findUnique({
    where: { id: hqCountryId },
    select: { realmId: true },
  });
  if (country?.realmId !== realmId) {
    throw new ExchangeError("NOT_FOUND", "No such nation in this realm");
  }
}

function subIndustryFor(sectorKey: SectorKey, requested?: SubIndustryKey): SubIndustryKey {
  const options = subIndustriesOf(sectorKey);
  const key = requested ?? options[0]?.key;
  if (!key || !options.some((sub) => sub.key === key)) {
    throw new ExchangeError("INVALID_AMOUNT", "That sub-industry is not in this sector");
  }
  return key;
}

/** The checks a charter must pass before its fee is taken. Returns the exchange config. */
async function assertCharterAllowed(
  tx: Db,
  input: FoundCompanyInput,
  realmId: string,
  name: string
) {
  await assertRealmOpenForCharters(tx, realmId);
  if (input.hqCountryId) await assertHqInRealm(tx, input.hqCountryId, realmId);
  const cfg = await getExchangeConfig(tx);
  const active = await tx.company.count({
    where: { founderId: input.userId, status: { in: ["ACTIVE", "DISTRESSED"] }, realmId },
  });
  if (active >= cfg.activeCompanyCap) {
    throw new ExchangeError(
      "LIMIT_REACHED",
      `You can run up to ${cfg.activeCompanyCap} active companies in each realm`
    );
  }
  const taken = await tx.company.findFirst({
    where: { realmId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) throw new ExchangeError("CONFLICT", "That company name is taken");
  return cfg;
}

/** Charter a company: pay the fee, create it and give the founder every share. */
export async function foundCompany(db: PrismaClient, input: FoundCompanyInput) {
  const realmId = input.realmId ?? DEFAULT_REALM_ID;
  const key = `exchange:charter:${input.userId}:${input.requestId}`;
  const name = input.name.trim();
  const findExisting = () =>
    db.company.findFirst({ where: { founderId: input.userId, realmId, name } });

  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockWallet(tx, input.userId); // serialises this user's charters for the cap check

      const applied = await tx.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (applied) {
        const existing = await tx.company.findFirst({
          where: { founderId: input.userId, realmId, name },
        });
        if (existing) return { company: companyView(existing), alreadyApplied: true };
      }

      const subIndustryKey = subIndustryFor(input.sectorKey, input.subIndustryKey);
      const cfg = await assertCharterAllowed(tx, input, realmId, name);

      if (cfg.charterFee > 0) {
        await spendSovereignsTx(tx, {
          userId: input.userId,
          amount: cfg.charterFee,
          type: "CHARTER_FEE",
          source: `COMPANY_CHARTER:${name}`,
          metadata: { name, sectorKey: input.sectorKey, realmId },
          idempotencyKey: key,
        });
      }

      const now = Date.now();
      const pricePerShare = fromCents(Math.round(toCents(cfg.charterFee) / FOUNDER_SHARES));
      const company = await tx.company.create({
        data: {
          founderId: input.userId,
          realmId,
          name,
          sectorKey: input.sectorKey,
          subIndustryKey,
          hqCountryId: input.hqCountryId ?? null,
          wikiSlug: input.wikiSlug ?? null,
          ...(input.wikiData !== undefined ? { wikiData: input.wikiData } : {}),
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
      const refreshed = await tx.company.findUniqueOrThrow({ where: { id: company.id } });
      await publishNewsTx(tx, {
        realmId,
        kind: "company_listed",
        prominence: "ACTIVITY",
        sourceKind: "COMPANY",
        sourceId: company.id,
        headline: `${company.name} listed on the Exchange`,
        companyId: company.id,
        countryId: company.hqCountryId ?? undefined,
        key: `news:company_listed:${company.id}`,
      });
      return { company: companyView(refreshed), alreadyApplied: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findExisting();
      const applied = await db.exchangeTransaction.findUnique({ where: { idempotencyKey: key } });
      if (existing && applied) return { company: companyView(existing), alreadyApplied: true };
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
      const company = await requireOwnedCompany(tx, input.companyId, input.userId, true);
      const r = await spendSovereignsTx(tx, {
        userId: input.userId,
        amount: input.amount,
        type: "COMPANY_DEPOSIT",
        source: `COMPANY_DEPOSIT:${input.companyId}`,
        metadata: { companyId: input.companyId },
        idempotencyKey: key,
      });
      if (r.alreadyApplied) return { newBalance: r.newBalance, alreadyApplied: true };
      const amountCents = toCents(input.amount);
      const creditLimitCents = Math.min(
        250_000_00,
        Math.round(
          0.5 * (centsOf(company.decisionValue) + 0.25 * centsOf(company.contractsWonValue))
        )
      );
      const cured =
        company.status === "DISTRESSED" &&
        centsOf(company.capital) + amountCents >= 0 &&
        centsOf(company.creditDrawn) <= creditLimitCents;
      await tx.company.update({
        where: { id: input.companyId },
        data: {
          capital: { increment: dbCents(amountCents) },
          ...(cured ? { status: "ACTIVE", distressedSinceIxTime: null } : {}),
        },
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
 * Refuse while the company's own new shares are on sale: their price was set from its capital,
 * so capital leaving now (a withdrawal, a dividend) would sell them at a price it no longer backs.
 * Call it under the company lock, which issuing shares also takes.
 */
export async function assertNoOpenPrimaryIssue(tx: Db, companyId: string): Promise<void> {
  const primaryOnSale = await tx.shareListing.count({
    where: { companyId, status: "OPEN", sellerUserId: null },
  });
  if (primaryOnSale > 0) {
    throw new ExchangeError(
      "CONFLICT",
      "New shares are on sale at a price set from this capital: cancel the issue first"
    );
  }
}

/**
 * Move ₷ from the company's capital back to the founder's wallet. Refused once anyone else
 * holds shares: capital they part own leaves only pro rata (dividends, dissolution). Refused
 * too while a credit line is drawn, since the lender's claim sits on that capital.
 */
export async function withdrawFromCompany(db: PrismaClient, input: CapitalMoveInput) {
  assertWholeAmount(input.amount);
  const key = `exchange:withdraw:${input.userId}:${input.requestId}`;
  try {
    return await db.$transaction(async (tx) => {
      await assertExchangeOpen(tx);
      await lockCompany(tx, input.companyId);
      const company = await requireOwnedCompany(tx, input.companyId, input.userId);
      await lockWallet(tx, input.userId); // a same-key retry waits here, then sees the row
      const applied = await tx.exchangeTransaction.findUnique({
        where: { idempotencyKey: key },
        select: { balanceAfter: true },
      });
      if (applied) {
        return { newBalance: fromCents(centsOf(applied.balanceAfter)), alreadyApplied: true };
      }
      if (company.creditDrawn > 0n) {
        throw new ExchangeError("CONFLICT", "Repay the credit line before withdrawing");
      }
      const holders = await holdersOf(tx, input.companyId);
      if (holders.some((h) => h.userId !== input.userId)) {
        throw new ExchangeError(
          "CONFLICT",
          "Other players own shares in this company: pay a dividend instead of withdrawing"
        );
      }
      await assertNoOpenPrimaryIssue(tx, input.companyId);

      const amountCents = dbCents(toCents(input.amount));
      const { count } = await tx.company.updateMany({
        where: { id: input.companyId, status: "ACTIVE", capital: { gte: amountCents } },
        data: { capital: { decrement: amountCents } },
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

export interface DissolveResult {
  /** What the founder took home from the liquidation. */
  returned: number;
  /** Notices for the other shareholders, sent once the enclosing transaction commits. */
  notices: ExchangeNotice[];
}

/**
 * Close a company inside the caller's transaction: refused while it issues or holds a live
 * contract, has a decision pending or has a credit line drawn. Pending bids are withdrawn,
 * open share listings cancelled (listed shares go back to their holders) and the remaining
 * capital is paid out pro rata to the shareholders, the founder taking the rounding remainder
 * (all of it when they hold every share). Send `notices` after the transaction commits.
 */
export async function dissolveCompanyTx(
  tx: Db,
  input: { userId: string; companyId: string; viaVote?: boolean }
): Promise<DissolveResult> {
  const notices: ExchangeNotice[] = [];
  await assertExchangeOpen(tx);
  await lockCompany(tx, input.companyId);
  const company = await requireOwnedCompany(tx, input.companyId, input.userId);
  if (!input.viaVote) await assertNoVoteNeeded(tx, company);
  if (company.creditDrawn > 0n) {
    throw new ExchangeError("CONFLICT", "Repay the credit line before dissolving this company");
  }
  await unwindCompanyMoneyTx(tx, company.id, Date.now());
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
  await returnBuyOrders(tx, company.id);
  await closeCompanyProposalsTx(tx, company.id, Date.now());

  const { capital } = await tx.company.findUniqueOrThrow({
    where: { id: company.id },
    select: { capital: true },
  });
  const { count } = await tx.company.updateMany({
    where: { id: company.id, status: "ACTIVE", capital },
    data: {
      status: "DELISTED",
      capital: 0n,
      tradingOpen: false,
      decisionValue: 0n,
      standing: 0,
      contractsWonValue: 0n,
    },
  });
  if (count !== 1) throw new ExchangeError("CONFLICT", "The company changed; try again");

  const split = splitProRata(centsOf(capital), await holdersOf(tx, company.id));
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
  return { returned: fromCents(payouts.get(input.userId) ?? 0), notices };
}

/** Close a company in its own transaction and send the shareholders their notices. */
export async function dissolveCompany(
  db: PrismaClient,
  input: { userId: string; companyId: string }
) {
  const result = await db.$transaction((tx) => dissolveCompanyTx(tx, input));
  notifyExchange(result.notices);
  return { returned: result.returned };
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
  realmId: true,
  name: true,
  sectorKey: true,
  subIndustryKey: true,
  hqCountryId: true,
  wikiSlug: true,
  wikiData: true,
  capital: true,
  standing: true,
  fairValue: true,
  sharesIssued: true,
  contractsWonValue: true,
  decisionValue: true,
  creditDrawn: true,
  creditRating: true,
  lastTradePrice: true,
  lastTickRevenue: true,
  lastTickExpenses: true,
  lastTickTax: true,
  lastTickNetIncome: true,
  distressedSinceIxTime: true,
  pricingStrategy: true,
  lobbyBuffType: true,
  lobbyBuffUntilIxTime: true,
  tradingOpen: true,
  sharesOutstanding: true,
  status: true,
  founderId: true,
  thinkpagesAccountId: true,
  createdAt: true,
} as const;

/** The user's companies, newest first (DELISTED ones included, last). `realmId` narrows to one realm. */
export async function listMyCompanies(db: Db, userId: string, realmId?: string) {
  const rows = await db.company.findMany({
    where: { founderId: userId, ...(realmId ? { realmId } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: COMPANY_SELECT,
    take: 50,
  });
  return rows.map(companyView);
}

/** The directory: ACTIVE companies by fair value. `realmId` narrows to one realm. */
export async function listCompanies(db: Db, limit = 50, realmId?: string) {
  const rows = await db.company.findMany({
    where: { status: "ACTIVE", ...(realmId ? { realmId } : {}) },
    orderBy: [{ fairValue: "desc" }, { createdAt: "asc" }],
    select: COMPANY_SELECT,
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(companyView);
}
