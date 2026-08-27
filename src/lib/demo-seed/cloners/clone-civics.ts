/**
 * Cloners for Economics, Geography, Diplomacy, Social, History, and Activity Feed.
 */

import { type PrismaClient } from "@prisma/client";
import {
  cloneRecords,
  cloneUniqueRecord,
  cloneParentChildren,
  stripRecord,
} from "../clone-helpers";
import * as fallbacks from "../seed-fallbacks";

type Prisma = PrismaClient;

const ECONOMIC_FALLBACKS: Record<
  string,
  (p: Prisma, cid: string, name?: string) => Promise<number>
> = {
  demographics: (p, c) => fallbacks.seedDemographics(p, c),
  economicProfile: (p, c) => fallbacks.seedEconomicProfile(p, c),
  laborMarket: (p, c) => fallbacks.seedLaborMarket(p, c),
  fiscalSystem: (p, c) => fallbacks.seedFiscalSystem(p, c),
  incomeDistribution: (p, c) => fallbacks.seedIncomeDistribution(p, c),
  governmentBudget: (p, c) => fallbacks.seedGovernmentBudget(p, c),
  nationalIdentity: (p, c, n) => fallbacks.seedNationalIdentity(p, c, n ?? "Demo Nation"),
};

const UNIQUE_ECONOMIC_MODELS = Object.keys(ECONOMIC_FALLBACKS);

export async function cloneEconomics(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  for (const modelName of UNIQUE_ECONOMIC_MODELS) {
    const { count: c } = await cloneUniqueRecord(
      prisma,
      modelName,
      sourceCountryId,
      demoCountryId,
      { extraStrip: ["geom_postgis"] }
    );
    if (c > 0) {
      count += c;
    } else {
      const fb = ECONOMIC_FALLBACKS[modelName];
      if (fb) count += await fb(prisma, demoCountryId, countryName);
    }
  }

  const { count: npcCount } = await cloneUniqueRecord(
    prisma,
    "nPCPersonalityAssignment",
    sourceCountryId,
    demoCountryId
  );
  if (npcCount > 0) {
    count += npcCount;
  } else {
    count += await fallbacks.seedNPCPersonality(prisma, demoCountryId);
  }

  const { count: cardBgCount } = await cloneRecords(
    prisma,
    "cardBackgroundImage",
    sourceCountryId,
    demoCountryId,
    { extraStrip: ["uploadedAt"] }
  );
  count += cardBgCount;

  return count;
}

export async function cloneGeography(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const { count: terrCount } = await cloneRecords(
    prisma,
    "territory",
    sourceCountryId,
    demoCountryId
  );
  count += terrCount;

  const sourceSubs = await prisma.subdivision.findMany({
    where: { countryId: sourceCountryId },
  });
  if (sourceSubs.length === 0) {
    return fallbacks.seedGeography(prisma, demoCountryId);
  }

  const subIdMap = new Map<string, string>();
  for (const sub of sourceSubs) {
    const data = stripRecord(sub, demoCountryId);
    const newSub = await prisma.subdivision.create({ data: data as any });
    subIdMap.set(sub.id, newSub.id);
    count++;
  }

  const { count: cityCount } = await cloneRecords(prisma, "city", sourceCountryId, demoCountryId, {
    transforms: {
      subdivisionId: (old: string | null) => (old ? (subIdMap.get(old) ?? null) : null),
    },
  });
  count += cityCount;

  const { count: poiCount } = await cloneRecords(
    prisma,
    "pointOfInterest",
    sourceCountryId,
    demoCountryId,
    {
      transforms: {
        subdivisionId: (old: string | null) => (old ? (subIdMap.get(old) ?? null) : null),
      },
    }
  );
  count += poiCount;

  return count;
}

export async function cloneOrSeedDiplomacy(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  const sourceRelations = await prisma.diplomaticRelation.findMany({
    where: { OR: [{ country1: sourceCountryId }, { country2: sourceCountryId }] },
  });
  for (const rel of sourceRelations) {
    const data = stripRecord(rel, demoCountryId, {
      countryField: rel.country1 === sourceCountryId ? "country1" : "country2",
    });
    await prisma.diplomaticRelation.create({ data: data as any });
    count++;
  }

  const { count: embCount } = await cloneParentChildren(
    prisma,
    "embassy",
    sourceCountryId,
    demoCountryId,
    [{ modelName: "embassyMission", parentField: "embassyId" }],
    { countryField: "guestCountryId" }
  );
  count += embCount;

  if (count === 0) {
    return fallbacks.seedDiplomacy(prisma, demoCountryId, countryName);
  }

  return count;
}

export async function cloneOrSeedSocial(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  const { count: accCount } = await cloneParentChildren(
    prisma,
    "thinkpagesAccount",
    sourceCountryId,
    demoCountryId,
    [{ modelName: "thinkpagesPost", parentField: "accountId" }],
    { transforms: { clerkUserId: () => userId } }
  );
  count += accCount;

  if (accCount === 0) {
    count += await fallbacks.seedSocial(prisma, demoCountryId, userId, countryName);
  }

  count += await fallbacks.seedThinkTanks(prisma, userId, countryName);

  return count;
}

export async function cloneHistory(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const historyModels = ["vitalityHistory", "historicalDataPoint"] as const;
  for (const modelName of historyModels) {
    const { count: c } = await cloneRecords(prisma, modelName, sourceCountryId, demoCountryId, {
      take: 50,
    });
    count += c;
  }

  return count;
}

export async function cloneOrSeedActivityFeed(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  const { count } = await cloneRecords(prisma, "activityFeed", sourceCountryId, demoCountryId, {
    take: 20,
    transforms: { userId: () => userId },
  });
  if (count > 0) return count;
  return fallbacks.seedActivityFeed(prisma, demoCountryId, userId);
}

export async function seedCrisisEvents(prisma: Prisma, countryName: string): Promise<number> {
  return fallbacks.seedCrisisEvents(prisma, countryName);
}
