/**
 * Nation treasuries (₷): the pot a nation fills with stipends, taxes, tariffs, interest and
 * LOBBY payments, and drains through B2G tenders. Every balance change is an update on the
 * treasury row taken under a row lock, plus a NationTreasuryEntry, so a retried move with the
 * same key is applied once. Spec: docs/specs/2026-11-01-exchange-phase-3-design.md.
 */

import type { NationTreasury, Prisma } from "@prisma/client";
import { refreshFairValue } from "./companies";
import { formatSovereigns, round2 } from "./amounts";
import type { Db } from "./guards";
import { fromCents, lockCompany, toCents } from "./ownership";
import { ExchangeError, lockWallet, spendSovereignsTx } from "~/lib/vault/exchange-service";

export type TreasuryInflowType = "TAX" | "TARIFF" | "INTEREST" | "LOBBY" | "B2G_ESCROW";
export type TreasuryOutflowType = "B2G_ESCROW" | "SPEND";
type TreasuryEntryType = "STIPEND" | "B2G_REFUND" | TreasuryInflowType | TreasuryOutflowType;

export type TreasuryPayer =
  | { kind: "COMPANY"; companyId: string }
  | { kind: "WALLET"; userId: string };

export interface StipendMintInput {
  countryId: string;
  realmId: string;
  ixTime: number;
  cap: number;
  amount: number;
  key: string;
}

export interface TreasuryTransferInput {
  from: TreasuryPayer;
  countryId: string;
  realmId: string;
  amount: number;
  type: TreasuryInflowType;
  source: string;
  key: string;
}

export interface TreasuryCreditInput {
  countryId: string;
  realmId: string;
  amount: number;
  type: "B2G_REFUND";
  source: string;
  key: string;
}

export interface TreasuryDebitInput {
  countryId: string;
  amount: number;
  type: TreasuryOutflowType;
  source: string;
  key: string;
}

type LifetimeColumn =
  | "lifetimeStipend"
  | "lifetimeTaxEarned"
  | "lifetimeTariffEarned"
  | "lifetimeInterestEarned"
  | "lifetimeSpent";

/** Entry types that add to a lifetime counter. LOBBY and escrow only move the balance. */
const INFLOW_COUNTERS: Partial<Record<TreasuryEntryType, LifetimeColumn>> = {
  STIPEND: "lifetimeStipend",
  TAX: "lifetimeTaxEarned",
  TARIFF: "lifetimeTariffEarned",
  INTEREST: "lifetimeInterestEarned",
};

/** Ledger type recorded on the payer's wallet when a wallet pays a treasury. */
const WALLET_PAYMENT_TYPE = "TREASURY_PAYMENT";

/** Tier labels are copied from the MyCountry economy tiers; calculations.ts pulls in IxTime. */
const TIER_MULTIPLIERS = new Map<string, number>([
  ["Impoverished", 0.5],
  ["Developing", 0.75],
  ["Developed", 1.0],
  ["Healthy", 1.25],
  ["Strong", 1.5],
  ["Very Strong", 1.75],
  ["Extravagant", 2.0],
]);

const RECENT_ENTRIES = 20;

export interface TreasuryEntryRow {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  source: string;
  ixTime: number;
  createdAt: Date;
}

export interface TreasurySummary {
  balance: number;
  cap: number;
  lifetimeStipend: number;
  lifetimeTaxEarned: number;
  lifetimeTariffEarned: number;
  lifetimeInterestEarned: number;
  lifetimeSpent: number;
  lastStipendIxTime: number | null;
  recent: TreasuryEntryRow[];
}

/** A nation's stipend for a tier. Unknown labels get the 1x base. */
export function stipendFor(tier: string, baseStipend: number): number {
  return round2(baseStipend * (TIER_MULTIPLIERS.get(tier) ?? 1));
}

/** Read the nation's treasury, creating it with zero balances if it does not exist yet. */
export async function getOrCreateTreasury(
  db: Db,
  countryId: string,
  realmId: string
): Promise<NationTreasury> {
  const existing = await db.nationTreasury.findUnique({ where: { countryId } });
  if (existing) return existing;
  // skipDuplicates is ON CONFLICT DO NOTHING, so a racing create does not abort a
  // surrounding Postgres transaction the way a caught unique violation would.
  await db.nationTreasury.createMany({ data: [{ countryId, realmId }], skipDuplicates: true });
  return db.nationTreasury.findUniqueOrThrow({ where: { countryId } });
}

function positiveCents(amount: number): number {
  const cents = toCents(amount);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }
  return cents;
}

function insufficient(holder: string, balance: number, need: number): ExchangeError {
  return new ExchangeError(
    "INSUFFICIENT_SOVEREIGNS",
    `${holder} holds ${formatSovereigns(balance)} but needs ${formatSovereigns(need)}`,
    balance
  );
}

/** Row-lock a treasury and return its row as it is once the lock is held. */
async function lockTreasuryRow(tx: Db, id: string): Promise<NationTreasury> {
  await tx.$queryRaw`SELECT id FROM "exchange_nation_treasuries" WHERE id = ${id} FOR UPDATE`;
  return tx.nationTreasury.findUniqueOrThrow({ where: { id } });
}

async function lockTreasuryFor(tx: Db, countryId: string, realmId: string) {
  const { id } = await getOrCreateTreasury(tx, countryId, realmId);
  return lockTreasuryRow(tx, id);
}

async function alreadyApplied(tx: Db, key: string): Promise<boolean> {
  const entry = await tx.nationTreasuryEntry.findUnique({
    where: { idempotencyKey: key },
    select: { id: true },
  });
  return entry !== null;
}

interface LedgerMove {
  type: TreasuryEntryType;
  source: string;
  key: string;
  ixTime: number;
}

async function writeEntry(
  tx: Db,
  countryId: string,
  amount: number,
  balanceAfter: number,
  move: LedgerMove
): Promise<void> {
  await tx.nationTreasuryEntry.create({
    data: {
      countryId,
      type: move.type,
      amount,
      balanceAfter,
      source: move.source,
      ixTime: move.ixTime,
      idempotencyKey: move.key,
    },
  });
}

/** Add to a locked treasury and write its ledger row. Returns the amount credited. */
async function creditTreasury(
  tx: Db,
  t: NationTreasury,
  cents: number,
  move: LedgerMove,
  extra: Prisma.NationTreasuryUpdateManyMutationInput = {}
): Promise<number> {
  const amount = fromCents(cents);
  const data: Prisma.NationTreasuryUpdateManyMutationInput = {
    ...extra,
    balance: { increment: amount },
  };
  const counter = INFLOW_COUNTERS[move.type];
  if (counter) data[counter] = { increment: amount };
  const row = await tx.nationTreasury.update({
    where: { id: t.id },
    data,
    select: { balance: true },
  });
  await writeEntry(tx, t.countryId, amount, row.balance, move);
  return amount;
}

/**
 * Remove from a locked treasury only while it covers the amount, then write a negative
 * ledger row. Returns the amount debited.
 */
async function debitTreasury(
  tx: Db,
  t: NationTreasury,
  cents: number,
  move: LedgerMove
): Promise<number> {
  const amount = fromCents(cents);
  const { count } = await tx.nationTreasury.updateMany({
    where: { id: t.id, balance: { gte: amount } },
    data: { balance: { decrement: amount }, lifetimeSpent: { increment: amount } },
  });
  if (count !== 1) throw insufficient("The treasury", t.balance, amount);
  const after = await tx.nationTreasury.findUniqueOrThrow({
    where: { id: t.id },
    select: { balance: true },
  });
  await writeEntry(tx, t.countryId, -amount, after.balance, move);
  return amount;
}

/**
 * Lock the payer before the treasury, always in that order, so two moves that touch the
 * same company or wallet and the same treasury cannot deadlock.
 */
async function lockPayer(tx: Db, from: TreasuryPayer): Promise<void> {
  if (from.kind === "COMPANY") {
    await lockCompany(tx, from.companyId);
    return;
  }
  await lockWallet(tx, from.userId);
}

async function debitCompanyCapital(tx: Db, companyId: string, amount: number): Promise<void> {
  const { count } = await tx.company.updateMany({
    where: { id: companyId, capital: { gte: amount } },
    data: { capital: { decrement: amount } },
  });
  if (count !== 1) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { capital: true },
    });
    throw insufficient("The company", company?.capital ?? 0, amount);
  }
  await refreshFairValue(tx, companyId);
}

async function debitPayer(tx: Db, input: TreasuryTransferInput, cents: number): Promise<void> {
  const amount = fromCents(cents);
  if (input.from.kind === "COMPANY") {
    await debitCompanyCapital(tx, input.from.companyId, amount);
    return;
  }
  const spent = await spendSovereignsTx(tx, {
    userId: input.from.userId,
    amount,
    type: WALLET_PAYMENT_TYPE,
    source: input.source,
    metadata: { countryId: input.countryId, treasuryType: input.type },
    idempotencyKey: input.key,
  });
  // The treasury side was not applied, so a wallet ledger row under this key is a reused
  // key. Crediting now would mint ₷, so refuse and let the transaction roll back.
  if (spent.alreadyApplied) {
    throw new ExchangeError("CONFLICT", "This payment key was already used");
  }
}

function treasuryKey(key: string): string {
  return `${key}:treasury`;
}

/**
 * Credit a nation's treasury from a stipend tick. The credit is cut to the room left under
 * `cap`, and a key already in the ledger means the tick ran before, so it mints nothing.
 */
export async function mintStipendTx(tx: Db, input: StipendMintInput): Promise<number> {
  const t = await lockTreasuryFor(tx, input.countryId, input.realmId);
  if (await alreadyApplied(tx, input.key)) return 0;
  const room = Math.max(0, toCents(input.cap) - toCents(t.balance));
  const cents = Math.min(toCents(input.amount), room);
  if (!(cents > 0)) return 0;
  return creditTreasury(
    tx,
    t,
    cents,
    { type: "STIPEND", source: "STIPEND", key: input.key, ixTime: input.ixTime },
    { lastStipendIxTime: input.ixTime }
  );
}

/**
 * Move ₷ from a payer into a nation's treasury. The payer is debited first and the treasury
 * credited in the same transaction, so a short payer rolls everything back. A retry with the
 * same key moves nothing.
 */
export async function transferToTreasuryTx(tx: Db, input: TreasuryTransferInput): Promise<number> {
  const cents = positiveCents(input.amount);
  await lockPayer(tx, input.from);
  const t = await lockTreasuryFor(tx, input.countryId, input.realmId);
  const key = treasuryKey(input.key);
  if (await alreadyApplied(tx, key)) return 0;
  await debitPayer(tx, input, cents);
  return creditTreasury(tx, t, cents, {
    type: input.type,
    source: input.source,
    key,
    ixTime: Date.now(),
  });
}

/** Credit a treasury with no payer. Only refunds of an earlier B2G escrow use it. */
export async function creditTreasuryTx(tx: Db, input: TreasuryCreditInput): Promise<number> {
  const cents = positiveCents(input.amount);
  const t = await lockTreasuryFor(tx, input.countryId, input.realmId);
  if (await alreadyApplied(tx, input.key)) return 0;
  return creditTreasury(tx, t, cents, {
    type: input.type,
    source: input.source,
    key: input.key,
    ixTime: Date.now(),
  });
}

/** Spend from a treasury. Throws INSUFFICIENT_SOVEREIGNS when it cannot cover the amount. */
export async function debitTreasuryTx(tx: Db, input: TreasuryDebitInput): Promise<number> {
  const cents = positiveCents(input.amount);
  const existing = await tx.nationTreasury.findUnique({
    where: { countryId: input.countryId },
    select: { id: true },
  });
  if (!existing) throw insufficient("The treasury", 0, fromCents(cents));
  const t = await lockTreasuryRow(tx, existing.id);
  if (await alreadyApplied(tx, input.key)) return 0;
  return debitTreasury(tx, t, cents, {
    type: input.type,
    source: input.source,
    key: input.key,
    ixTime: Date.now(),
  });
}

/** Read model for the treasury panel. `cap` comes from the caller's config. */
export async function treasurySummary(
  db: Db,
  countryId: string,
  cap: number
): Promise<TreasurySummary> {
  const [row, recent] = await Promise.all([
    db.nationTreasury.findUnique({ where: { countryId } }),
    db.nationTreasuryEntry.findMany({
      where: { countryId },
      orderBy: { createdAt: "desc" },
      take: RECENT_ENTRIES,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        source: true,
        ixTime: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    balance: row?.balance ?? 0,
    cap,
    lifetimeStipend: row?.lifetimeStipend ?? 0,
    lifetimeTaxEarned: row?.lifetimeTaxEarned ?? 0,
    lifetimeTariffEarned: row?.lifetimeTariffEarned ?? 0,
    lifetimeInterestEarned: row?.lifetimeInterestEarned ?? 0,
    lifetimeSpent: row?.lifetimeSpent ?? 0,
    lastStipendIxTime: row?.lastStipendIxTime ?? null,
    recent,
  };
}
