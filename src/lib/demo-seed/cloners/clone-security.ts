/**
 * Cloners for Security, Border Security, Defense/Military, Intelligence, and National Issues.
 */

import { type PrismaClient } from "@prisma/client";
import { cloneRecords, cloneParentChildren } from "../clone-helpers";
import * as fallbacks from "../seed-fallbacks";

type Prisma = PrismaClient;

export async function cloneSecurity(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const { count: bsCount } = await cloneRecords(
    prisma,
    "borderSecurity",
    sourceCountryId,
    demoCountryId
  );
  count += bsCount;

  const { count: threatCount } = await cloneParentChildren(
    prisma,
    "securityThreat",
    sourceCountryId,
    demoCountryId,
    [{ modelName: "threatIncident", parentField: "threatId" }]
  );
  count += threatCount;

  if (threatCount === 0) {
    count += await fallbacks.seedSecurityThreats(prisma, demoCountryId);
  }

  return count;
}

export async function cloneOrSeedDefense(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const { count: branchCount } = await cloneParentChildren(
    prisma,
    "militaryBranch",
    sourceCountryId,
    demoCountryId,
    [{ modelName: "militaryUnit", parentField: "branchId" }]
  );
  count += branchCount;

  const { count: opCount } = await cloneRecords(
    prisma,
    "militaryOperation",
    sourceCountryId,
    demoCountryId
  );
  count += opCount;

  if (count === 0) {
    return fallbacks.seedDefense(prisma, demoCountryId);
  }

  return count;
}

export async function cloneOrSeedIntelligence(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const { count: briefCount } = await cloneParentChildren(
    prisma,
    "intelligenceBriefing",
    sourceCountryId,
    demoCountryId,
    [{ modelName: "intelligenceRecommendation", parentField: "briefingId" }]
  );
  count += briefCount;

  const { count: alertCount } = await cloneRecords(
    prisma,
    "intelligenceAlert",
    sourceCountryId,
    demoCountryId
  );
  count += alertCount;

  const { count: threshCount } = await cloneRecords(
    prisma,
    "intelligenceAlertThreshold",
    sourceCountryId,
    demoCountryId
  );
  count += threshCount;

  if (count === 0) {
    return fallbacks.seedIntelligence(prisma, demoCountryId);
  }

  return count;
}

export async function cloneOrSeedNationalIssues(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  _countryName: string
): Promise<number> {
  const { count } = await cloneRecords(
    prisma,
    "nationalIssue",
    sourceCountryId,
    demoCountryId,
    { take: 10 }
  );
  return count;
}

