/**
 * Cross-border duties on contract awards, and the nation figures they read. Spec:
 * docs/specs/2026-11-01-exchange-phase-3-design.md
 *
 * A contract won by a company headquartered in another nation owes its issuing nation's tariff
 * for the contract's sector, unless the two nations have an enacted free-trade agreement. This
 * module only reads; the award code in contracts.ts moves the money when the payout is made.
 */

import { fromCents, toCents } from "./ownership";
import { countryMacroOf, type CountryMacro } from "./macro";
import type { Db } from "./guards";

/** The country figures the Exchange reads, loaded for countryMacroOf. Null when the nation is unknown. */
export async function macroOfCountry(db: Db, countryId: string): Promise<CountryMacro | null> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: {
      adjustedGdpGrowth: true,
      economicTier: true,
      governmentalEfficiency: true,
      interestRates: true,
      inflationRate: true,
      economicProfile: true,
      fiscalSystem: true,
      historicalData: {
        orderBy: { ixTimeTimestamp: "desc" },
        take: 1,
        select: { gdpGrowthRate: true },
      },
    },
  });
  return country ? countryMacroOf(country) : null;
}

/**
 * An enacted free-trade agreement between two nations, in either direction. The diplomacy
 * router records one as a `free_trade` foreign-policy action, marked `active` while it stands;
 * lifting or expiry moves it to another status. The Treaty table names its parties only as
 * free text and DiplomaticRelation.treaties is free text too, so neither can answer this.
 */
export async function hasTradeAgreement(db: Db, a: string, b: string): Promise<boolean> {
  const agreement = await db.foreignPolicyAction.findFirst({
    where: {
      actionType: "free_trade",
      status: "active",
      OR: [
        { initiatorId: a, targetId: b },
        { initiatorId: b, targetId: a },
      ],
    },
    select: { id: true },
  });
  return agreement !== null;
}

export interface TariffSource {
  type: string;
  sectorKey: string;
  issuerCountryId: string | null;
  issuerCompanyId: string | null;
}

export interface Tariff {
  /** The nation that levies the tariff and receives it. */
  countryId: string;
  rate: number;
  amount: number;
}

/** The nation whose tariff applies: a tender's own nation, or a B2B issuer's headquarters nation. */
export async function issuingNationOf(db: Db, contract: TariffSource): Promise<string | null> {
  if (contract.type === "B2G") return contract.issuerCountryId;
  if (!contract.issuerCompanyId) return null;
  const issuer = await db.company.findUnique({
    where: { id: contract.issuerCompanyId },
    select: { hqCountryId: true },
  });
  return issuer?.hqCountryId ?? null;
}

/**
 * The tariff a payout of `escrow` owes, or null when none is due: no cross-border move, a nation
 * that levies nothing on this sector, a free-trade agreement, or an amount that rounds to nothing.
 * The rate is already capped at a quarter of the value by macro.ts.
 */
export async function tariffOn(
  db: Db,
  contract: TariffSource,
  winnerHqCountryId: string | null,
  escrow: number
): Promise<Tariff | null> {
  const nation = await issuingNationOf(db, contract);
  if (!winnerHqCountryId || !nation || winnerHqCountryId === nation) return null;
  const macro = await macroOfCountry(db, nation);
  const rate = macro?.tariffFor(contract.sectorKey) ?? 0;
  if (rate <= 0) return null;
  if (await hasTradeAgreement(db, winnerHqCountryId, nation)) return null;
  const amount = fromCents(Math.round(toCents(escrow) * rate));
  return amount > 0 ? { countryId: nation, rate, amount } : null;
}
