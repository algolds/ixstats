/**
 * Nation metrics. Country scope: stewardship from `Country.ownedSince`, the national identity
 * checklist, a Vexel coat of arms, and the nation's approved story pins. Account scope: published
 * Vexel designs for institutions and dynasties, and approved map edits (both keyed by Clerk id).
 * Durations are real time (V4); a story pin's `ixTimeYear` is an in-world year and only counts
 * alongside a floor of real months.
 */
import { RENDERED_IMAGE_URL } from "~/lib/heraldry/constants";
import type { PrismaClient } from "@prisma/client";
import { MONTH_MS } from "../time-buckets";
import type { MetricLoader } from "./registry";

const CHRONICLER_MIN_MONTHS = 6;
const IDENTITY_SYMBOLS = 3;

/** Whole real months since `ownedSince`; 0 when the date is unknown or in the future. */
export function ownedMonths(ownedSince: Date | null, now: Date): number {
  if (!ownedSince) return 0;
  return Math.max(0, Math.floor((now.getTime() - ownedSince.getTime()) / MONTH_MS));
}

type Field = string | null | undefined;

export interface IdentityFields {
  officialName: Field;
  motto: Field;
  demonym: Field;
  currency: Field;
  officialLanguages: Field;
  nationalAnthem: Field;
  nationalDay: Field;
  capitalCityId: Field;
  nationalBird: Field;
  nationalFish: Field;
  nationalFlower: Field;
  nationalDish: Field;
  nationalFruit: Field;
  nationalDrink: Field;
  nationalInstrument: Field;
  nationalSymbol: Field;
  nationalSport: Field;
}

const filled = (value: Field) => (value?.trim() ?? "") !== "";

/** Core identity filled in, a linked capital city and 3 or more national symbols. */
export function isIdentityComplete(identity: IdentityFields | null): boolean {
  if (!identity) return false;
  const core = [
    identity.officialName,
    identity.motto,
    identity.demonym,
    identity.currency,
    identity.officialLanguages,
    identity.nationalAnthem,
    identity.nationalDay,
    identity.capitalCityId,
  ];
  const symbols = [
    identity.nationalBird,
    identity.nationalFish,
    identity.nationalFlower,
    identity.nationalDish,
    identity.nationalFruit,
    identity.nationalDrink,
    identity.nationalInstrument,
    identity.nationalSymbol,
    identity.nationalSport,
  ];
  return core.every(filled) && symbols.filter(filled).length >= IDENTITY_SYMBOLS;
}

const IDENTITY_SELECT = {
  officialName: true,
  motto: true,
  demonym: true,
  currency: true,
  officialLanguages: true,
  nationalAnthem: true,
  nationalDay: true,
  capitalCityId: true,
  nationalBird: true,
  nationalFish: true,
  nationalFlower: true,
  nationalDish: true,
  nationalFruit: true,
  nationalDrink: true,
  nationalInstrument: true,
  nationalSymbol: true,
  nationalSport: true,
} as const;

/** Approved pins with their distinct real creation months (UTC) and in-world years, in one aggregate. */
async function pinTotals(db: PrismaClient, countryId: string) {
  const [row] = await db.$queryRaw<{ pins: bigint; months: bigint; years: bigint }[]>`
    SELECT count(*) AS pins,
           count(DISTINCT date_trunc('month', "createdAt" AT TIME ZONE 'UTC')) AS months,
           count(DISTINCT "ixTimeYear") AS years
    FROM story_pins
    WHERE "countryId" = ${countryId} AND status = 'approved'`;
  return {
    pins: Number(row?.pins ?? 0),
    months: Number(row?.months ?? 0),
    years: Number(row?.years ?? 0),
  };
}

export const nationLoader: MetricLoader = {
  id: "nation",
  scope: "country",
  keys: ["ownedMonths", "identityComplete", "armsAttached", "storyPinsApproved", "storyPinYears"],
  async load({ db, countryId, now }): Promise<Record<string, number>> {
    if (!countryId) return {};
    const [country, pins] = await Promise.all([
      db.country.findUnique({
        where: { id: countryId },
        select: {
          ownedSince: true,
          coatOfArms: true,
          nationalIdentity: { select: IDENTITY_SELECT },
        },
      }),
      pinTotals(db, countryId),
    ]);
    return {
      ownedMonths: ownedMonths(country?.ownedSince ?? null, now),
      identityComplete: isIdentityComplete(country?.nationalIdentity ?? null) ? 1 : 0,
      // Wiki imports also fill coatOfArms; only the Vexel render writes this URL shape.
      armsAttached: RENDERED_IMAGE_URL.test(country?.coatOfArms ?? "") ? 1 : 0,
      storyPinsApproved: pins.months >= CHRONICLER_MIN_MONTHS ? pins.pins : 0,
      storyPinYears: pins.years,
    };
  },
};

export const nationAccountLoader: MetricLoader = {
  id: "nation-account",
  scope: "account",
  keys: ["heraldryPublishedInstitutions", "mapEditsApproved"],
  async load({ db, clerkUserId }): Promise<Record<string, number>> {
    const [heraldryPublishedInstitutions, mapEditsApproved] = await Promise.all([
      db.heraldryAchievement.count({
        where: {
          ownerId: clerkUserId,
          subjectType: { in: ["INSTITUTION", "DYNASTY"] },
          isPublished: true,
        },
      }),
      db.mapEditRequest.count({ where: { userId: clerkUserId, status: "approved" } }),
    ]);
    return { heraldryPublishedInstitutions, mapEditsApproved };
  },
};
