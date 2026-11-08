/**
 * A nation's lending terms and the no-self-dealing rule (spec §11a). The owner sets an extra spread on top of the
 * rating spread and a cap on each domestic company's credit line; the defaults keep the Central Bank's old behaviour.
 * Credit is open to the owner's own companies too, since the terms are the same for all. The treasury never buys into
 * (wealth fund) or awards its tenders to a company the owner founded or holds shares in.
 */
import type { PrismaClient } from "@prisma/client";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { assertExchangeOpen, requireCountryOwner, type Db } from "./guards";
import { getOrCreateTreasury } from "./treasury";

export const LENDING_SPREAD_MIN = -0.02;
export const LENDING_SPREAD_MAX = 0.1;
export const COMPANY_CREDIT_CAP_MAX = 250_000;

export interface LendingTerms {
  spread: number;
  cap: number;
}

const DEFAULT_TERMS: LendingTerms = { spread: 0, cap: COMPANY_CREDIT_CAP_MAX };

/** A nation's terms, or the defaults when it has no treasury yet. */
export async function lendingTermsOf(db: Db, countryId: string): Promise<LendingTerms> {
  const row = await db.nationTreasury.findUnique({
    where: { countryId },
    select: { lendingSpread: true, companyCreditCap: true },
  });
  return row ? { spread: row.lendingSpread, cap: row.companyCreditCap } : DEFAULT_TERMS;
}

/** Terms for many nations at once (the market tick). */
export async function lendingTermsFor(
  db: Db,
  countryIds: readonly string[]
): Promise<Map<string, LendingTerms>> {
  const rows = await db.nationTreasury.findMany({
    where: { countryId: { in: [...new Set(countryIds)] } },
    select: { countryId: true, lendingSpread: true, companyCreditCap: true },
  });
  return new Map(
    rows.map((r) => [r.countryId, { spread: r.lendingSpread, cap: r.companyCreditCap }])
  );
}

export async function setLendingTerms(
  db: PrismaClient,
  i: { userId: string; countryId: string; spread: number; cap: number }
): Promise<LendingTerms> {
  if (
    !Number.isFinite(i.spread) ||
    i.spread < LENDING_SPREAD_MIN ||
    i.spread > LENDING_SPREAD_MAX
  ) {
    throw new ExchangeError("INVALID_AMOUNT", "The extra spread must be from -2% to 10%");
  }
  if (!Number.isFinite(i.cap) || i.cap < 0 || i.cap > COMPANY_CREDIT_CAP_MAX) {
    throw new ExchangeError("INVALID_AMOUNT", "The credit cap must be from ₷0 to ₷250,000");
  }
  return db.$transaction(async (tx) => {
    await assertExchangeOpen(tx);
    const country = await requireCountryOwner(tx, i.countryId, i.userId);
    const treasury = await getOrCreateTreasury(tx, country.id, country.realmId);
    await tx.nationTreasury.update({
      where: { id: treasury.id },
      data: { lendingSpread: i.spread, companyCreditCap: i.cap },
    });
    return { spread: i.spread, cap: i.cap };
  });
}

/** Companies the nation's owner founded or holds any shares in. */
export async function ownerCompanyIds(db: Db, countryId: string): Promise<Set<string>> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { ownerUserId: true },
  });
  if (!country?.ownerUserId) return new Set();
  const [founded, held] = await Promise.all([
    db.company.findMany({ where: { founderId: country.ownerUserId }, select: { id: true } }),
    db.shareholding.findMany({
      where: { ownerUserId: country.ownerUserId, shares: { gt: 0 } },
      select: { companyId: true },
    }),
  ]);
  return new Set([...founded.map((c) => c.id), ...held.map((h) => h.companyId)]);
}

export async function assertNotOwnersCompany(
  db: Db,
  countryId: string,
  companyId: string
): Promise<void> {
  if ((await ownerCompanyIds(db, countryId)).has(companyId)) {
    throw new ExchangeError("FORBIDDEN", "The treasury can't deal with its owner's own companies");
  }
}
