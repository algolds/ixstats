// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
/**
 * Clone-or-seed subsystem handlers for the Demo Seed system.
 *
 * Each phase tries to clone real data from the source country.
 * If no source records exist, falls back to the synthetic seeder.
 *
 * Phases are ordered to respect FK dependencies.
 */

import { type PrismaClient } from "@prisma/client";
import { cloneRecords, cloneUniqueRecord, stripRecord } from "./clone-helpers";
import * as fallbacks from "./seed-fallbacks";

type Prisma = PrismaClient;

// Allow dynamic model access for seed cloning (model names match Prisma keys)
type PrismaDynamic = Record<
  string,
  {
    findMany: (args?: unknown) => Promise<unknown[]>;
    create: (args: { data: unknown }) => Promise<unknown>;
  }
>;

// ─── Phase 1: Economics (1:1 flat models) ──────────────────────────

/** Map model name → fallback seeder function (takes prisma, countryId, [countryName]) */
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
  defenseBudget: (p, c) => fallbacks.seedDefenseBudget(p, c),
  securityAssessment: (p, c) => fallbacks.seedSecurityAssessment(p, c),
  atomicEffectiveness: (p, c) => fallbacks.seedAtomicEffectiveness(p, c),
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
      // Source had no record → use synthetic fallback
      const fb = ECONOMIC_FALLBACKS[modelName];
      if (fb) count += await fb(prisma, demoCountryId, countryName);
    }
  }

  // NPCPersonalityAssignment (1:1 @unique countryId)
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

  // CardBackgroundImage (N records, compound unique [countryId, cardType])
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

// ─── Phase 2: Government tree ──────────────────────────────────────

export async function cloneGovernmentTree(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  // Find source and demo GovernmentStructure
  const sourceGov = await prisma.governmentStructure.findFirst({
    where: { countryId: sourceCountryId },
    select: { id: true },
  });
  const demoGov = await prisma.governmentStructure.findFirst({
    where: { countryId: demoCountryId },
    select: { id: true },
  });
  if (!demoGov) return 0; // Demo must have a GovernmentStructure (created during country clone)
  if (!sourceGov) {
    // Source has no GovernmentStructure at all → use synthetic fallback
    return fallbacks.seedGovernmentTree(prisma, demoCountryId, demoGov.id);
  }

  const sourceGovId = sourceGov.id;
  const demoGovId = demoGov.id;

  // Clone GovernmentDepartment (self-referential: two-pass)
  const sourceDepts = await prisma.governmentDepartment.findMany({
    where: { governmentStructureId: sourceGovId },
  });
  if (sourceDepts.length === 0) {
    // Source has no departments → use synthetic fallback
    return fallbacks.seedGovernmentTree(prisma, demoCountryId, demoGovId);
  }

  // Pass 1: create all departments WITHOUT parentDepartmentId
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

  // Pass 2: update parentDepartmentId for departments that had one
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

  // Clone GovernmentOfficial
  const sourceOfficials = await prisma.governmentOfficial.findMany({
    where: { governmentStructureId: sourceGovId },
  });
  for (const official of sourceOfficials) {
    const data = stripRecord(official, demoGovId, {
      countryField: "governmentStructureId",
      transforms: {
        departmentId: (val: string | null) => (val ? (deptIdMap.get(val) ?? null) : null),
      },
    });
    await prisma.governmentOfficial.create({ data: data as any });
    count++;
  }

  // Clone BudgetAllocation
  const sourceBudgets = await prisma.budgetAllocation.findMany({
    where: { governmentStructureId: sourceGovId },
  });
  for (const budget of sourceBudgets) {
    const newDeptId = deptIdMap.get(budget.departmentId);
    if (!newDeptId) continue;
    const data = stripRecord(budget, demoGovId, {
      countryField: "governmentStructureId",
      transforms: { departmentId: () => newDeptId },
    });
    await prisma.budgetAllocation.create({ data: data as any });
    count++;
  }

  // Clone SubBudgetCategory
  const sourceSubBudgets = await prisma.subBudgetCategory.findMany({
    where: { departmentId: { in: Array.from(deptIdMap.keys()) } },
  });
  for (const sub of sourceSubBudgets) {
    const newDeptId = deptIdMap.get(sub.departmentId);
    if (!newDeptId) continue;
    const data = stripRecord(sub, "", {
      countryField: "___skip___",
      transforms: { departmentId: () => newDeptId },
    });
    delete data["___skip___"];
    await prisma.subBudgetCategory.create({ data: data as any });
    count++;
  }

  // Clone RevenueSource
  const { count: revCount } = await cloneRecords(prisma, "revenueSource", sourceGovId, demoGovId, {
    countryField: "governmentStructureId",
  });
  count += revCount;

  return count;
}

// ─── Phase 3: Components ──────────────────────────────────────────

export async function cloneComponents(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  // GovernmentComponent
  const sourceGovComps = await prisma.governmentComponent.findMany({
    where: { countryId: sourceCountryId },
  });

  // If source has no components at all, use synthetic fallback
  if (sourceGovComps.length === 0) {
    const econComps = await prisma.economicComponent.count({
      where: { countryId: sourceCountryId },
    });
    const taxComps = await prisma.taxComponent.count({ where: { countryId: sourceCountryId } });
    if (econComps === 0 && taxComps === 0) {
      return fallbacks.seedGovernmentComponents(prisma, demoCountryId);
    }
  }
  const govCompIdMap = new Map<string, string>();
  for (const comp of sourceGovComps) {
    const data = stripRecord(comp, demoCountryId);
    const newComp = await prisma.governmentComponent.create({ data: data as any });
    govCompIdMap.set(comp.id, newComp.id);
    count++;
  }

  // ComponentSynergy (remap primaryComponentId + secondaryComponentId)
  if (govCompIdMap.size > 0) {
    const sourceSynergies = await prisma.componentSynergy.findMany({
      where: { countryId: sourceCountryId },
    });
    for (const syn of sourceSynergies) {
      const newPrimary = govCompIdMap.get(syn.primaryComponentId);
      const newSecondary = govCompIdMap.get(syn.secondaryComponentId);
      if (!newPrimary || !newSecondary) continue;
      const data = stripRecord(syn, demoCountryId, {
        transforms: {
          primaryComponentId: () => newPrimary,
          secondaryComponentId: () => newSecondary,
        },
      });
      await prisma.componentSynergy.create({ data: data as any });
      count++;
    }
  }

  // EconomicComponent (flat)
  const { count: econCount } = await cloneRecords(
    prisma,
    "economicComponent",
    sourceCountryId,
    demoCountryId
  );
  count += econCount;

  // TaxComponent (flat)
  const { count: taxCount } = await cloneRecords(
    prisma,
    "taxComponent",
    sourceCountryId,
    demoCountryId
  );
  count += taxCount;

  // CrossBuilderSynergy (flat clone, string fields are metadata)
  const { count: crossCount } = await cloneRecords(
    prisma,
    "crossBuilderSynergy",
    sourceCountryId,
    demoCountryId
  );
  count += crossCount;

  // Fallback: seed if source had none
  if (crossCount === 0) {
    count += await fallbacks.seedCrossBuilderSynergy(prisma, demoCountryId);
  }

  return count;
}

// ─── Phase 4: Tax tree ──────────────────────────────────────────

export async function cloneTaxTree(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  // TaxSystem (1:1 @unique countryId)
  const sourceTaxSystem = await prisma.taxSystem.findFirst({
    where: { countryId: sourceCountryId },
  });
  if (!sourceTaxSystem) {
    // Source has no tax system → use synthetic fallback
    return fallbacks.seedTaxTree(prisma, demoCountryId);
  }

  const taxData = stripRecord(sourceTaxSystem as any, demoCountryId);
  // Fill any NULL required fields with sensible defaults
  if (!taxData.taxSystemName) taxData.taxSystemName = "National Revenue Service";
  if (!taxData.taxAuthority) taxData.taxAuthority = "Department of Revenue";
  if (!taxData.fiscalYear) taxData.fiscalYear = "calendar";
  if (taxData.complianceRate == null) taxData.complianceRate = 92;
  if (taxData.collectionEfficiency == null) taxData.collectionEfficiency = 87;
  const demoTaxSystem = await prisma.taxSystem.create({ data: taxData as any });
  count++;

  const sourceTaxSystemId = sourceTaxSystem.id;
  const demoTaxSystemId = demoTaxSystem.id;

  // TaxCategory
  const sourceCategories = await prisma.taxCategory.findMany({
    where: { taxSystemId: sourceTaxSystemId },
  });
  const categoryIdMap = new Map<string, string>();
  for (const cat of sourceCategories) {
    const data = stripRecord(cat, "", {
      countryField: "___skip___",
      transforms: { taxSystemId: () => demoTaxSystemId },
    });
    delete data["___skip___"];
    const newCat = await prisma.taxCategory.create({ data: data as any });
    categoryIdMap.set(cat.id, newCat.id);
    count++;
  }

  // TaxBracket (taxSystemId + categoryId)
  const sourceBrackets = await prisma.taxBracket.findMany({
    where: { taxSystemId: sourceTaxSystemId },
  });
  for (const bracket of sourceBrackets) {
    const newCatId = categoryIdMap.get(bracket.categoryId);
    if (!newCatId) continue;
    const data = stripRecord(bracket, "", {
      countryField: "___skip___",
      transforms: {
        taxSystemId: () => demoTaxSystemId,
        categoryId: () => newCatId,
      },
    });
    delete data["___skip___"];
    await prisma.taxBracket.create({ data: data as any });
    count++;
  }

  // TaxExemption (taxSystemId + optional categoryId)
  const sourceExemptions = await prisma.taxExemption.findMany({
    where: { taxSystemId: sourceTaxSystemId },
  });
  for (const exemption of sourceExemptions) {
    const newCatId = exemption.categoryId
      ? (categoryIdMap.get(exemption.categoryId) ?? null)
      : null;
    const data = stripRecord(exemption, "", {
      countryField: "___skip___",
      transforms: {
        taxSystemId: () => demoTaxSystemId,
        categoryId: () => newCatId,
      },
    });
    delete data["___skip___"];
    await prisma.taxExemption.create({ data: data as any });
    count++;
  }

  // TaxDeduction (categoryId only)
  const sourceCategoryIds = Array.from(categoryIdMap.keys());
  if (sourceCategoryIds.length > 0) {
    const sourceDeductions = await prisma.taxDeduction.findMany({
      where: { categoryId: { in: sourceCategoryIds } },
    });
    for (const deduction of sourceDeductions) {
      const newCatId = categoryIdMap.get(deduction.categoryId);
      if (!newCatId) continue;
      const data = stripRecord(deduction, "", {
        countryField: "___skip___",
        transforms: { categoryId: () => newCatId },
      });
      delete data["___skip___"];
      await prisma.taxDeduction.create({ data: data as any });
      count++;
    }
  }

  // TaxPolicy (taxSystemId)
  const sourcePolicies = await prisma.taxPolicy.findMany({
    where: { taxSystemId: sourceTaxSystemId },
  });
  for (const policy of sourcePolicies) {
    const data = stripRecord(policy, "", {
      countryField: "___skip___",
      transforms: { taxSystemId: () => demoTaxSystemId },
    });
    delete data["___skip___"];
    await prisma.taxPolicy.create({ data: data as any });
    count++;
  }

  // Post-clone check: if source had no categories or no brackets, seed them
  const demoCategories = await prisma.taxCategory.count({
    where: { taxSystemId: demoTaxSystemId },
  });
  if (demoCategories === 0) {
    // Delete the empty cloned TaxSystem and fall back to full synthetic seed
    await prisma.taxSystem.delete({ where: { id: demoTaxSystemId } });
    return fallbacks.seedTaxTree(prisma, demoCountryId);
  }

  const demoBrackets = await prisma.taxBracket.count({ where: { taxSystemId: demoTaxSystemId } });
  if (demoBrackets === 0) {
    // Source had categories but no brackets — seed standard brackets + deductions for each category
    const cats = await prisma.taxCategory.findMany({
      where: { taxSystemId: demoTaxSystemId },
      select: { id: true, categoryType: true },
    });
    for (const cat of cats) {
      if (cat.categoryType === "income") {
        await prisma.taxBracket.createMany({
          data: [
            {
              taxSystemId: demoTaxSystemId,
              categoryId: cat.id,
              bracketName: "Lower Rate",
              minIncome: 0,
              maxIncome: 50000,
              rate: 10,
              marginalRate: true,
              isActive: true,
              priority: 10,
            },
            {
              taxSystemId: demoTaxSystemId,
              categoryId: cat.id,
              bracketName: "Standard Rate",
              minIncome: 50001,
              maxIncome: 150000,
              rate: 22,
              marginalRate: true,
              isActive: true,
              priority: 20,
            },
            {
              taxSystemId: demoTaxSystemId,
              categoryId: cat.id,
              bracketName: "Higher Rate",
              minIncome: 150001,
              maxIncome: 500000,
              rate: 32,
              marginalRate: true,
              isActive: true,
              priority: 30,
            },
            {
              taxSystemId: demoTaxSystemId,
              categoryId: cat.id,
              bracketName: "Top Rate",
              minIncome: 500001,
              rate: 37,
              marginalRate: true,
              isActive: true,
              priority: 40,
            },
          ],
        });
        count += 4;
      } else if (cat.categoryType === "corporate") {
        await prisma.taxBracket.create({
          data: {
            taxSystemId: demoTaxSystemId,
            categoryId: cat.id,
            bracketName: "Standard Rate",
            minIncome: 0,
            rate: 21,
            marginalRate: false,
            isActive: true,
            priority: 10,
          },
        });
        count++;
      }
    }
  }

  // Ensure deductions exist (if cloned source had none)
  const demoDeductions = await prisma.taxDeduction.count({
    where: { categoryId: { in: Array.from(categoryIdMap.values()) } },
  });
  if (demoDeductions === 0 && categoryIdMap.size > 0) {
    for (const [_sourceId, newCatId] of categoryIdMap) {
      const cat = await prisma.taxCategory.findUnique({
        where: { id: newCatId },
        select: { categoryType: true },
      });
      if (cat?.categoryType === "income") {
        await prisma.taxDeduction.createMany({
          data: [
            {
              categoryId: newCatId,
              deductionName: "Charitable Donations",
              deductionType: "charitable",
              description: "Deduction for verified charitable contributions.",
              percentage: 100,
              isActive: true,
              priority: 10,
            },
            {
              categoryId: newCatId,
              deductionName: "Mortgage Interest",
              deductionType: "housing",
              description: "Deduction for primary residence mortgage interest.",
              maximumAmount: 750000,
              isActive: true,
              priority: 20,
            },
            {
              categoryId: newCatId,
              deductionName: "Medical Expenses",
              deductionType: "medical",
              description: "Deduction for out-of-pocket medical costs.",
              percentage: 100,
              isActive: true,
              priority: 30,
            },
            {
              categoryId: newCatId,
              deductionName: "Education Expenses",
              deductionType: "education",
              description: "Deduction for qualifying tuition and materials.",
              maximumAmount: 10000,
              isActive: true,
              priority: 40,
            },
          ],
        });
        count += 4;
      } else if (cat?.categoryType === "corporate") {
        await prisma.taxDeduction.createMany({
          data: [
            {
              categoryId: newCatId,
              deductionName: "Business Expenses",
              deductionType: "operational",
              description: "Standard deduction for operating costs.",
              percentage: 100,
              isActive: true,
              priority: 10,
            },
            {
              categoryId: newCatId,
              deductionName: "R&D Tax Credit",
              deductionType: "research",
              description: "Credit for qualifying R&D expenditures.",
              percentage: 20,
              isActive: true,
              priority: 20,
            },
          ],
        });
        count += 2;
      }
    }
  }

  return count;
}

// ─── Phase 5: Security ──────────────────────────────────────────

export async function cloneSecurity(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  // BorderSecurity (1:1 @unique countryId) → NeighborThreatAssessment
  const sourceBorder = await prisma.borderSecurity.findFirst({
    where: { countryId: sourceCountryId },
  });
  if (!sourceBorder) {
    // Source has no border security → use synthetic fallback
    count += await fallbacks.seedBorderSecurity(prisma, demoCountryId);
  } else {
    const borderData = stripRecord(sourceBorder as any, demoCountryId);
    const demoBorder = await prisma.borderSecurity.create({ data: borderData as any });
    count++;

    // NeighborThreatAssessment
    const sourceNeighbors = await prisma.neighborThreatAssessment.findMany({
      where: { borderSecurityId: sourceBorder.id },
    });
    for (const neighbor of sourceNeighbors) {
      const data = stripRecord(neighbor, "", {
        countryField: "___skip___",
        transforms: { borderSecurityId: () => demoBorder.id },
      });
      delete data["___skip___"];
      await prisma.neighborThreatAssessment.create({ data: data as any });
      count++;
    }
  }

  // SecurityThreat → ThreatIncident
  const sourceThreats = await prisma.securityThreat.findMany({
    where: { countryId: sourceCountryId },
  });
  const threatIdMap = new Map<string, string>();
  for (const threat of sourceThreats) {
    const data = stripRecord(threat, demoCountryId, {
      transforms: { userId: () => null },
    });
    const newThreat = await prisma.securityThreat.create({ data: data as any });
    threatIdMap.set(threat.id, newThreat.id);
    count++;
  }

  if (threatIdMap.size > 0) {
    for (const [oldThreatId, newThreatId] of threatIdMap) {
      const sourceIncidents = await prisma.threatIncident.findMany({
        where: { threatId: oldThreatId },
      });
      for (const incident of sourceIncidents) {
        const data = stripRecord(incident, "", {
          countryField: "___skip___",
          transforms: { threatId: () => newThreatId },
        });
        delete data["___skip___"];
        await prisma.threatIncident.create({ data: data as any });
        count++;
      }
    }
  } else {
    // Source had no security threats → use synthetic fallback
    count += await fallbacks.seedSecurityThreats(prisma, demoCountryId);
  }

  return count;
}

// ─── Phase 6: Geography ──────────────────────────────────────────

export async function cloneGeography(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;
  const geoStrip = ["geom_postgis"];

  // Territory (flat)
  const { count: terCount } = await cloneRecords(
    prisma,
    "territory",
    sourceCountryId,
    demoCountryId,
    { extraStrip: geoStrip }
  );
  count += terCount;

  // Subdivision → City, PointOfInterest
  const sourceSubdivisions = await prisma.subdivision.findMany({
    where: { countryId: sourceCountryId },
  });
  const subdivIdMap = new Map<string, string>();
  const { updateSubdivisionSpatialProfile } = await import("~/lib/country-geo");
  for (const sub of sourceSubdivisions) {
    const data = stripRecord(sub, demoCountryId, { extraStrip: geoStrip });
    const newSub = await prisma.subdivision.create({ data: data as any });
    subdivIdMap.set(sub.id, newSub.id);

    // Force geom_postgis and update spatial profile
    if (
      newSub.geometry &&
      (newSub.geometry as any).coordinates &&
      (newSub.geometry as any).coordinates.length > 0
    ) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE subdivisions SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
          JSON.stringify(newSub.geometry),
          newSub.id
        );
        await updateSubdivisionSpatialProfile(prisma, newSub.id);
      } catch (err) {
        console.warn(`[cloneGeography] Failed to update subdivision spatial profile:`, err);
      }
    }

    count++;
  }

  // City
  const sourceCities = await prisma.city.findMany({
    where: { countryId: sourceCountryId },
  });
  const { updateCitySpatialProfile } = await import("~/lib/country-geo");
  for (const city of sourceCities) {
    const newSubId = city.subdivisionId ? (subdivIdMap.get(city.subdivisionId) ?? null) : null;
    const data = stripRecord(city, demoCountryId, {
      extraStrip: geoStrip,
      transforms: { subdivisionId: () => newSubId },
    });
    const newCity = await prisma.city.create({ data: data as any });

    // Force geom_postgis and update spatial profile
    if (newCity.coordinates) {
      try {
        const coords = newCity.coordinates as any;
        const lng = Array.isArray(coords) ? coords[0] : coords.lng;
        const lat = Array.isArray(coords) ? coords[1] : coords.lat;
        await prisma.$executeRawUnsafe(
          `UPDATE cities SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
          Number(lng),
          Number(lat),
          newCity.id
        );
        await updateCitySpatialProfile(prisma, newCity.id);
      } catch (err) {
        console.warn(`[cloneGeography] Failed to update city spatial profile:`, err);
      }
    }

    count++;
  }

  // PointOfInterest
  const sourcePois = await prisma.pointOfInterest.findMany({
    where: { countryId: sourceCountryId },
  });
  for (const poi of sourcePois) {
    const newSubId = poi.subdivisionId ? (subdivIdMap.get(poi.subdivisionId) ?? null) : null;
    const data = stripRecord(poi, demoCountryId, {
      extraStrip: geoStrip,
      transforms: { subdivisionId: () => newSubId },
    });
    const newPoi = await prisma.pointOfInterest.create({ data: data as any });

    // Force PostGIS geom
    if (newPoi.coordinates) {
      try {
        const coords = newPoi.coordinates as any;
        const lng = Array.isArray(coords) ? coords[0] : coords.lng;
        const lat = Array.isArray(coords) ? coords[1] : coords.lat;
        await prisma.$executeRawUnsafe(
          `UPDATE points_of_interest SET geom_postgis = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
          Number(lng),
          Number(lat),
          newPoi.id
        );
      } catch (err) {
        console.warn(`[cloneGeography] Failed to update POI geom:`, err);
      }
    }

    count++;
  }

  // If source had no geography data at all, use synthetic fallback
  if (count === 0) {
    return fallbacks.seedGeography(prisma, demoCountryId);
  }

  return count;
}

// ─── Phase 7: Meetings (clone or seed) ──────────────────────────

export async function cloneOrSeedMeetings(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  // Check if source has meetings
  const sourceCount = await prisma.cabinetMeeting.count({
    where: { countryId: sourceCountryId },
  });

  if (sourceCount === 0) {
    return fallbacks.seedMeetings(prisma, demoCountryId, userId);
  }

  let count = 0;

  // Clone CabinetMeeting → children
  const sourceMeetings = await prisma.cabinetMeeting.findMany({
    where: { countryId: sourceCountryId },
  });

  for (const meeting of sourceMeetings) {
    const data = stripRecord(meeting, demoCountryId, {
      transforms: { userId: () => userId },
    });
    const newMeeting = await prisma.cabinetMeeting.create({ data });
    count++;

    // Clone child records for this meeting
    const childModels = [
      "meetingAgendaItem",
      "meetingAttendance",
      "meetingDecision",
      "meetingActionItem",
    ];
    for (const childModel of childModels) {
      const model = (prisma as unknown as PrismaDynamic)[childModel];
      if (!model) continue;
      const children = await model.findMany({
        where: { meetingId: meeting.id },
      });
      for (const child of children) {
        const childData = stripRecord(child as any, "", {
          countryField: "___skip___",
          transforms: { meetingId: () => newMeeting.id },
        });
        delete childData["___skip___"];
        await model.create({ data: childData as any });
        count++;
      }
    }
  }

  // Ensure completed meetings have decisions (source may have had none)
  count += await fallbacks.seedMeetingDecisionsIfMissing(prisma, demoCountryId);

  return count;
}

// ─── Phase 8: Policies (clone or seed) ──────────────────────────

export async function cloneOrSeedPolicies(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  const sourceCount = await prisma.policy.count({
    where: { countryId: sourceCountryId },
  });

  if (sourceCount === 0) {
    return fallbacks.seedPolicies(prisma, demoCountryId, userId);
  }

  let count = 0;

  const sourcePolicies = await prisma.policy.findMany({
    where: { countryId: sourceCountryId },
  });

  for (const policy of sourcePolicies) {
    const data = stripRecord(policy, demoCountryId, {
      transforms: {
        userId: () => userId,
        // JSON reference fields are metadata, null them to avoid stale IDs
        relatedGovernmentComponents: () => null,
      },
    });
    const newPolicy = await prisma.policy.create({ data: data as any });
    count++;

    // PolicyEffectLog
    const effectLogs = await prisma.policyEffectLog.findMany({
      where: { policyId: policy.id },
    });
    for (const log of effectLogs) {
      const logData = stripRecord(log as any, "", {
        countryField: "___skip___",
        transforms: { policyId: () => newPolicy.id },
      });
      delete logData["___skip___"];
      await prisma.policyEffectLog.create({ data: logData as any });
      count++;
    }
  }

  return count;
}

// ─── Phase 9: Elections (clone or seed) ──────────────────────────

export async function cloneOrSeedElections(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  const partyCount = await prisma.politicalParty.count({
    where: { countryId: sourceCountryId },
  });

  if (partyCount === 0) {
    return fallbacks.seedElections(prisma, demoCountryId);
  }

  let count = 0;

  // Clone PoliticalParty
  const sourceParties = await prisma.politicalParty.findMany({
    where: { countryId: sourceCountryId },
  });
  const partyIdMap = new Map<string, string>();
  for (const party of sourceParties) {
    const data = stripRecord(party, demoCountryId);
    const newParty = await prisma.politicalParty.create({ data: data as any });
    partyIdMap.set(party.id, newParty.id);
    count++;
  }

  // Clone Legislature (1:1)
  const sourceLeg = await prisma.legislature.findFirst({
    where: { countryId: sourceCountryId },
  });
  let demoLegId: string | null = null;
  if (sourceLeg) {
    const legData = stripRecord(sourceLeg as any, demoCountryId);
    const demoLeg = await prisma.legislature.create({ data: legData as any });
    demoLegId = demoLeg.id;
    count++;

    // Clone LegislativeSeat (legislatureId + partyId)
    const sourceSeats = await prisma.legislativeSeat.findMany({
      where: { legislatureId: sourceLeg.id },
    });
    for (const seat of sourceSeats) {
      const newPartyId = partyIdMap.get(seat.partyId);
      if (!newPartyId) continue;
      const data = stripRecord(seat, "", {
        countryField: "___skip___",
        transforms: {
          legislatureId: () => demoLeg.id,
          partyId: () => newPartyId,
        },
      });
      delete data["___skip___"];
      await prisma.legislativeSeat.create({ data: data as any });
      count++;
    }
  }

  // Clone Elections
  const sourceElections = await prisma.election.findMany({
    where: { countryId: sourceCountryId },
  });
  for (const election of sourceElections) {
    const data = stripRecord(election, demoCountryId, {
      transforms: {
        legislatureId: () => demoLegId,
      },
    });
    const newElection = await prisma.election.create({ data: data as any });
    count++;

    // Clone ElectionCandidate
    const sourceCandidates = await prisma.electionCandidate.findMany({
      where: { electionId: election.id },
    });
    const candidateIdMap = new Map<string, string>();
    for (const candidate of sourceCandidates) {
      const newPartyId = candidate.partyId ? (partyIdMap.get(candidate.partyId) ?? null) : null;
      const candData = stripRecord(candidate, "", {
        countryField: "___skip___",
        transforms: {
          electionId: () => newElection.id,
          partyId: () => newPartyId,
        },
      });
      delete candData["___skip___"];
      const newCand = await prisma.electionCandidate.create({ data: candData as any });
      candidateIdMap.set(candidate.id, newCand.id);
      count++;
    }

    // Clone ElectionResult
    const sourceResults = await prisma.electionResult.findMany({
      where: { electionId: election.id },
    });
    for (const result of sourceResults) {
      const newCandId = candidateIdMap.get(result.candidateId);
      if (!newCandId) continue;
      const resData = stripRecord(result, "", {
        countryField: "___skip___",
        transforms: {
          electionId: () => newElection.id,
          candidateId: () => newCandId,
        },
      });
      delete resData["___skip___"];
      await prisma.electionResult.create({ data: resData as any });
      count++;
    }
  }

  return count;
}

// ─── Phase 10: Military (clone or seed) ──────────────────────────

export async function cloneOrSeedDefense(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  const branchCount = await prisma.militaryBranch.count({
    where: { countryId: sourceCountryId },
  });

  if (branchCount === 0) {
    return fallbacks.seedDefense(prisma, demoCountryId);
  }

  let count = 0;

  // Clone MilitaryBranch → MilitaryUnit
  const sourceBranches = await prisma.militaryBranch.findMany({
    where: { countryId: sourceCountryId },
  });
  for (const branch of sourceBranches) {
    const data = stripRecord(branch as any, demoCountryId);
    const newBranch = await prisma.militaryBranch.create({ data: data as any });
    count++;

    const sourceUnits = await prisma.militaryUnit.findMany({
      where: { branchId: branch.id },
    });
    for (const unit of sourceUnits) {
      const unitData = stripRecord(unit, "", {
        countryField: "___skip___",
        transforms: { branchId: () => newBranch.id },
      });
      delete unitData["___skip___"];
      await prisma.militaryUnit.create({ data: unitData });
      count++;
    }
  }

  // Clone MilitaryOperation
  const { count: opsCount } = await cloneRecords(
    prisma,
    "militaryOperation",
    sourceCountryId,
    demoCountryId,
    {
      transforms: {
        // Null out JSON fields that reference asset IDs
        assetsDeployed: () => null,
      },
    }
  );
  count += opsCount;

  return count;
}

// ─── Phase 11: Intelligence (clone or seed) ──────────────────────

export async function cloneOrSeedIntelligence(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  const briefingCount = await prisma.intelligenceBriefing.count({
    where: { countryId: sourceCountryId },
  });

  if (briefingCount === 0) {
    return fallbacks.seedIntelligence(prisma, demoCountryId);
  }

  let count = 0;

  // Clone IntelligenceBriefing → IntelligenceRecommendation
  const sourceBriefings = await prisma.intelligenceBriefing.findMany({
    where: { countryId: sourceCountryId },
  });
  for (const briefing of sourceBriefings) {
    const data = stripRecord(briefing, demoCountryId);
    const newBriefing = await prisma.intelligenceBriefing.create({ data });
    count++;

    // IntelligenceRecommendation
    const sourceRecs = await prisma.intelligenceRecommendation.findMany({
      where: { briefingId: briefing.id },
    });
    for (const rec of sourceRecs) {
      const recData = stripRecord(rec, demoCountryId, {
        transforms: { briefingId: () => newBriefing.id },
      });
      await prisma.intelligenceRecommendation.create({ data: recData });
      count++;
    }
  }

  // Clone IntelligenceAlert
  const { count: alertCount } = await cloneRecords(
    prisma,
    "intelligenceAlert",
    sourceCountryId,
    demoCountryId
  );
  count += alertCount;

  // Clone IntelligenceAlertThreshold
  try {
    const { count: threshCount } = await cloneRecords(
      prisma,
      "intelligenceAlertThreshold",
      sourceCountryId,
      demoCountryId
    );
    count += threshCount;
  } catch {
    // Model may not have records
  }

  return count;
}

// ─── Phase 12: National Issues (clone or seed) ──────────────────

export async function cloneOrSeedNationalIssues(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  countryName: string
): Promise<number> {
  const issueCount = await prisma.nationalIssue.count({
    where: { countryId: sourceCountryId },
  });

  if (issueCount === 0) {
    return fallbacks.seedNationalIssues(prisma, demoCountryId, countryName);
  }

  let count = 0;

  // Clone NationalIssue → NationalIssueConsequence
  const sourceIssues: any[] = await prisma.nationalIssue.findMany({
    where: { countryId: sourceCountryId },
  });
  for (const issue of sourceIssues) {
    const data = stripRecord(issue as any, demoCountryId);
    const newIssue = await prisma.nationalIssue.create({ data: data as any });
    count++;

    const sourceConsequences = await prisma.nationalIssueConsequence.findMany({
      where: { issueId: issue.id },
    });
    for (const consequence of sourceConsequences) {
      const consData = stripRecord(consequence, "", {
        countryField: "___skip___",
        transforms: { issueId: () => newIssue.id },
      });
      delete consData["___skip___"];
      await prisma.nationalIssueConsequence.create({ data: consData });
      count++;
    }
  }

  return count;
}

// ─── Phase 13: Diplomacy (clone or seed) ──────────────────────────

export async function cloneOrSeedDiplomacy(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  countryName: string
): Promise<number> {
  // Check if source has diplomatic relations
  const relCount = await prisma.diplomaticRelation.count({
    where: { OR: [{ country1: sourceCountryId }, { country2: sourceCountryId }] },
  });
  const embCount = await prisma.embassy.count({
    where: { OR: [{ hostCountryId: sourceCountryId }, { guestCountryId: sourceCountryId }] },
  });

  if (relCount === 0 && embCount === 0) {
    const base = await fallbacks.seedDiplomacy(prisma, demoCountryId, countryName);
    const extras = await fallbacks.seedDiplomacyExtras(prisma, demoCountryId, countryName);
    const channels = await fallbacks.seedSecureChannels(prisma, demoCountryId, countryName);
    return base + extras + channels;
  }

  let count = 0;

  // Clone DiplomaticRelation (cross-country: remap whichever field matches)
  const sourceRelations: any[] = await prisma.diplomaticRelation.findMany({
    where: { OR: [{ country1: sourceCountryId }, { country2: sourceCountryId }] },
  });
  for (const rel of sourceRelations) {
    const data = stripRecord(rel, "", { countryField: "___skip___" });
    delete data["___skip___"];
    // Remap whichever country field matches the source
    if (rel.country1 === sourceCountryId) {
      data.country1 = demoCountryId;
    }
    if (rel.country2 === sourceCountryId) {
      data.country2 = demoCountryId;
    }
    await prisma.diplomaticRelation.create({ data });
    count++;
  }

  // Clone Embassy → EmbassyMission (cross-country: remap host/guest)
  const sourceEmbassies: any[] = await prisma.embassy.findMany({
    where: { OR: [{ hostCountryId: sourceCountryId }, { guestCountryId: sourceCountryId }] },
  });
  for (const embassy of sourceEmbassies) {
    const data = stripRecord(embassy, "", { countryField: "___skip___" });
    delete data["___skip___"];
    if (embassy.hostCountryId === sourceCountryId) {
      data.hostCountryId = demoCountryId;
    }
    if (embassy.guestCountryId === sourceCountryId) {
      data.guestCountryId = demoCountryId;
    }
    const newEmbassy = await prisma.embassy.create({ data });
    count++;

    // EmbassyMission
    const sourceMissions: any[] = await prisma.embassyMission.findMany({
      where: { embassyId: embassy.id },
    });
    for (const mission of sourceMissions) {
      const missionData = stripRecord(mission, "", {
        countryField: "___skip___",
        transforms: { embassyId: () => newEmbassy.id },
      });
      delete missionData["___skip___"];
      await prisma.embassyMission.create({ data: missionData });
      count++;
    }
  }

  // Always seed diplomacy extras (alliances, foreign policy, cultural exchanges, bilateral trade)
  // These are additive — they check for existing records before creating
  count += await fallbacks.seedDiplomacyExtras(prisma, demoCountryId, countryName);

  // Always seed secure diplomatic channels (additive — references already-seeded embassies/alliances)
  count += await fallbacks.seedSecureChannels(prisma, demoCountryId, countryName);

  return count;
}

// ─── Phase 14: Social (clone or seed) ──────────────────────────

export async function cloneOrSeedSocial(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string,
  countryName: string
): Promise<number> {
  const accountCount = await prisma.thinkpagesAccount.count({
    where: { countryId: sourceCountryId },
  });

  let count = 0;

  if (accountCount === 0) {
    count += await fallbacks.seedSocial(prisma, demoCountryId, userId, countryName);
  } else {
    // Clone ThinkpagesAccount → ThinkpagesPost
    const sourceAccounts: any[] = await prisma.thinkpagesAccount.findMany({
      where: { countryId: sourceCountryId },
    });
    for (const account of sourceAccounts) {
      const data = stripRecord(account, demoCountryId, {
        transforms: {
          clerkUserId: () => userId,
          username: (val: string) => `${val}_demo_${Date.now()}`,
        },
      });
      const newAccount = await prisma.thinkpagesAccount.create({ data });
      count++;

      const sourcePosts: any[] = await prisma.thinkpagesPost.findMany({
        where: { accountId: account.id },
      });
      for (const post of sourcePosts) {
        const postData = stripRecord(post, "", {
          countryField: "___skip___",
          transforms: { accountId: () => newAccount.id },
        });
        delete postData["___skip___"];
        await prisma.thinkpagesPost.create({ data: postData });
        count++;
      }
    }
  }

  // Always seed ThinkTank groups and ThinkShare DMs (additive, with internal guards)
  count += await fallbacks.seedThinkTanks(prisma, userId, countryName);
  count += await fallbacks.seedThinkShareDMs(prisma, userId, countryName);

  return count;
}

// ─── Phase 15: History (limited clone) ──────────────────────────

export async function cloneHistory(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string
): Promise<number> {
  let count = 0;

  // HistoricalDataPoint (last 90 records)
  const { count: histCount } = await cloneRecords(
    prisma,
    "historicalDataPoint",
    sourceCountryId,
    demoCountryId,
    { orderBy: { ixTimeTimestamp: "desc" }, take: 90 }
  );
  count += histCount;

  // VitalityHistory (last 30 records, no FK relation)
  const { count: vitalCount } = await cloneRecords(
    prisma,
    "vitalityHistory",
    sourceCountryId,
    demoCountryId,
    { orderBy: { timestamp: "desc" }, take: 30 }
  );
  count += vitalCount;

  // ComponentEffectivenessHistory (last 30 records, no FK relation)
  const { count: compHistCount } = await cloneRecords(
    prisma,
    "componentEffectivenessHistory",
    sourceCountryId,
    demoCountryId,
    { orderBy: { timestamp: "desc" }, take: 30 }
  );
  count += compHistCount;

  // If source had no history data at all, use synthetic fallback
  if (count === 0) {
    return fallbacks.seedHistory(prisma, demoCountryId);
  }

  return count;
}

// ─── Phase 16: Crisis Events (seed only, global model) ──────────

export async function seedCrisisEvents(prisma: Prisma, countryName: string): Promise<number> {
  return fallbacks.seedCrisisEvents(prisma, countryName);
}

// ─── Phase 17: Activity Feed (clone or seed) ────────────────────

export async function cloneOrSeedActivityFeed(
  prisma: Prisma,
  sourceCountryId: string,
  demoCountryId: string,
  userId: string
): Promise<number> {
  const { count } = await cloneRecords(prisma, "activityFeed", sourceCountryId, demoCountryId, {
    orderBy: { createdAt: "desc" },
    take: 30,
    transforms: { userId: () => userId },
  });
  if (count > 0) return count;

  // Source had no activity feed → use synthetic fallback
  return fallbacks.seedActivityFeed(prisma, demoCountryId, userId);
}
