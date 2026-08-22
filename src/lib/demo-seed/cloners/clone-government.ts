/**
 * Cloners for Government, Structure, Components, Taxes, Meetings, Policies, and Elections.
 */

import { type PrismaClient } from "@prisma/client";
import { cloneRecords, cloneParentChildren, stripRecord } from "../clone-helpers";
import * as fallbacks from "../seed-fallbacks";

type Prisma = PrismaClient;

export async function cloneGovernmentTree(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const sourceGov = await prisma.governmentStructure.findFirst({
    where: { countryId: sourceCountryId },
    select: { id: true },
  });
  const demoGov = await prisma.governmentStructure.findFirst({
    where: { countryId: demoCountryId },
    select: { id: true },
  });
  if (!demoGov) return 0;
  if (!sourceGov) {
    return fallbacks.seedGovernmentTree(prisma, demoCountryId, demoGov.id);
  }

  const sourceGovId = sourceGov.id;
  const demoGovId = demoGov.id;

  const sourceDepts = await prisma.governmentDepartment.findMany({
    where: { governmentStructureId: sourceGovId },
  });
  if (sourceDepts.length === 0) {
    return fallbacks.seedGovernmentTree(prisma, demoCountryId, demoGovId);
  }

  // Pass 1: create departments without parentDepartmentId
  const deptIdMap = new Map<string, string>();
  for (const dept of sourceDepts) {
    const data = stripRecord(dept, demoGovId, {
      countryField: "governmentStructureId",
      extraStrip: ["parentDepartmentId"],
    });
    const newDept = await prisma.governmentDepartment.create({ data: data as any });
    deptIdMap.set(dept.id, newDept.id);
    count++;
  }

  // Pass 2: link parentDepartmentId
  for (const dept of sourceDepts) {
    if (dept.parentDepartmentId) {
      const newId = deptIdMap.get(dept.id);
      const newParentId = deptIdMap.get(dept.parentDepartmentId);
      if (newId && newParentId) {
        await prisma.governmentDepartment.update({
          where: { id: newId },
          data: { parentDepartmentId: newParentId },
        });
      }
    }
  }

  // Clone officials
  const sourceOfficials = await (prisma as any).governmentOfficial.findMany({
    where: { governmentStructureId: sourceGovId },
  });
  for (const off of sourceOfficials) {
    const newDeptId = off.departmentId ? deptIdMap.get(off.departmentId) ?? null : null;
    const data = stripRecord(off, demoGovId, {
      countryField: "governmentStructureId",
      transforms: { departmentId: () => newDeptId },
    });
    await (prisma as any).governmentOfficial.create({ data });
    count++;
  }

  // Clone budget allocations
  const { count: budgetCount } = await cloneRecords(
    prisma,
    "budgetAllocation",
    sourceGovId,
    demoGovId,
    {
      countryField: "governmentStructureId",
      transforms: {
        departmentId: (oldId: string | null) => (oldId ? (deptIdMap.get(oldId) ?? null) : null),
      },
    }
  );
  count += budgetCount;

  // Clone revenue sources
  const { count: revCount } = await cloneRecords(prisma, "revenueSource", sourceGovId, demoGovId, {
    countryField: "governmentStructureId",
  });
  count += revCount;

  return count;
}

export async function cloneComponents(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;
  const compIdMap = new Map<string, string>();

  const compModels = ["governmentComponent", "economicComponent", "taxComponent"] as const;
  for (const modelName of compModels) {
    const sourceRecords = await (prisma as any)[modelName].findMany({
      where: { countryId: sourceCountryId },
    });
    const { count: c, records: created } = await cloneRecords(
      prisma,
      modelName,
      sourceCountryId,
      demoCountryId
    );
    count += c;
    for (let i = 0; i < sourceRecords.length; i++) {
      if (i < created.length) {
        compIdMap.set(sourceRecords[i].id, created[i].id);
      }
    }
  }

  if (count === 0) {
    return fallbacks.seedGovernmentComponents(prisma, demoCountryId);
  }

  const { count: synCount } = await cloneRecords(
    prisma,
    "componentSynergy",
    sourceCountryId,
    demoCountryId,
    {
      transforms: {
        primaryComponentId: (old: string) => compIdMap.get(old) ?? old,
        secondaryComponentId: (old: string) => compIdMap.get(old) ?? old,
      },
    }
  );
  count += synCount;

  const { count: crossCount } = await cloneRecords(
    prisma,
    "crossBuilderSynergy",
    sourceCountryId,
    demoCountryId
  );
  count += crossCount;

  return count;
}

export async function cloneTaxTree(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const sourceTax = await prisma.taxSystem.findFirst({
    where: { countryId: sourceCountryId },
  });
  if (!sourceTax) {
    return fallbacks.seedTaxTree(prisma, demoCountryId);
  }

  const taxData = stripRecord(sourceTax, demoCountryId);
  const demoTax = await prisma.taxSystem.create({ data: taxData as any });
  count++;

  const sourceCats = await prisma.taxCategory.findMany({
    where: { taxSystemId: sourceTax.id },
  });
  const catIdMap = new Map<string, string>();
  for (const cat of sourceCats) {
    const data = stripRecord(cat, demoTax.id, { countryField: "taxSystemId" });
    const newCat = await prisma.taxCategory.create({ data: data as any });
    catIdMap.set(cat.id, newCat.id);
    count++;
  }

  const childTables = [
    { model: "taxBracket", field: "categoryId" },
    { model: "taxExemption", field: "categoryId" },
    { model: "taxDeduction", field: "categoryId" },
  ] as const;

  for (const { model, field } of childTables) {
    for (const [sourceCatId, demoCatId] of catIdMap.entries()) {
      const records = await (prisma as any)[model].findMany({
        where: { [field]: sourceCatId },
      });
      for (const rec of records) {
        const data = stripRecord(rec, demoTax.id, {
          countryField: "taxSystemId",
          transforms: { [field]: () => demoCatId },
        });
        await (prisma as any)[model].create({ data });
        count++;
      }
    }
  }

  const { count: synCount } = await cloneRecords(
    prisma,
    "taxSynergy",
    sourceTax.id,
    demoTax.id,
    { countryField: "taxSystemId" }
  );
  count += synCount;

  const { count: histCount } = await cloneRecords(
    prisma,
    "taxPolicyHistory",
    sourceTax.id,
    demoTax.id,
    { countryField: "taxSystemId" }
  );
  count += histCount;

  return count;
}

export async function cloneOrSeedMeetings(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  const { count } = await cloneParentChildren(
    prisma,
    "cabinetMeeting",
    sourceCountryId,
    demoCountryId,
    [
      { modelName: "meetingAgendaItem", parentField: "meetingId" },
      { modelName: "meetingDecision", parentField: "meetingId" },
      { modelName: "meetingActionItem", parentField: "meetingId" },
      { modelName: "meetingVoteTopic", parentField: "meetingId" },
    ]
  );
  if (count > 0) return count;
  return fallbacks.seedMeetings(prisma, demoCountryId, userId);
}

export async function cloneOrSeedPolicies(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  const { count } = await cloneParentChildren(
    prisma,
    "policy",
    sourceCountryId,
    demoCountryId,
    [
      { modelName: "policyEffectLog", parentField: "policyId" },
      { modelName: "policyReview", parentField: "policyId" },
    ]
  );
  if (count > 0) return count;
  return fallbacks.seedPolicies(prisma, demoCountryId, userId);
}

export async function cloneOrSeedElections(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  const { count: partyCount, records: parties } = await cloneRecords(
    prisma,
    "politicalParty",
    sourceCountryId,
    demoCountryId
  );
  count += partyCount;

  if (partyCount === 0) {
    return fallbacks.seedElections(prisma, demoCountryId);
  }

  const sourceParties = await prisma.politicalParty.findMany({
    where: { countryId: sourceCountryId },
  });
  const partyIdMap = new Map<string, string>();
  for (let i = 0; i < sourceParties.length; i++) {
    if (i < parties.length) {
      partyIdMap.set(sourceParties[i]!.id, parties[i].id);
    }
  }

  const { count: electCount, idMap: electIdMap } = await cloneParentChildren(
    prisma,
    "election",
    sourceCountryId,
    demoCountryId,
    [
      {
        modelName: "electionCandidate",
        parentField: "electionId",
        transforms: {
          partyId: (old: string | null) => (old ? (partyIdMap.get(old) ?? null) : null),
        },
      },
      {
        modelName: "electionResult",
        parentField: "electionId",
        transforms: {
          partyId: (old: string) => partyIdMap.get(old) ?? old,
        },
      },
    ]
  );
  count += electCount;

  const { count: legCount, idMap: legIdMap } = await cloneParentChildren(
    prisma,
    "legislature",
    sourceCountryId,
    demoCountryId,
    [
      {
        modelName: "legislatureSeat",
        parentField: "legislatureId",
        transforms: {
          partyId: (old: string | null) => (old ? (partyIdMap.get(old) ?? null) : null),
        },
      },
    ],
    {
      transforms: {
        lastElectionId: (old: string | null) => (old ? (electIdMap.get(old) ?? null) : null),
      },
    }
  );
  count += legCount;

  return count;
}
