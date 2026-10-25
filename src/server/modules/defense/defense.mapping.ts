/**
 * Rows ↔ model state. The model (`~/lib/military/model`) works on plain values; these map the Prisma rows to them and
 * back, so persistence stays in one place.
 */
import type {
  DefensePolicy,
  MilitaryAsset,
  MilitaryBranch,
  MilitaryEquipmentCatalog,
  Prisma,
  ProcurementOrder,
} from "@prisma/client";
import {
  ERA_DESIGN_YEAR,
  DEFAULT_DESIGN_YEAR,
  type AssetState,
  type BranchState,
  type BranchView,
  type OrderState,
  type PolicyState,
} from "~/lib/military/model";

export function policyState(row: DefensePolicy): PolicyState {
  return {
    shares: {
      personnel: row.sharePersonnel,
      om: row.shareOm,
      procurement: row.shareProcurement,
      rd: row.shareRd,
      infrastructure: row.shareInfrastructure,
    },
    volunteerShare: row.volunteerShare,
    serviceMonths: row.serviceMonths,
    reserveYears: row.reserveYears,
    doctrine: row.doctrine,
    alertLevel: row.alertLevel,
    previousAlertLevel: row.previousAlertLevel,
    alertChangedClockMs: row.alertChangedClockMs,
    omPriority: row.omPriority,
    rdStock: row.rdStock,
    infrastructureStock: row.infrastructureStock,
    priceIndex: row.priceIndex,
    surgeStartedClockMs: row.surgeStartedClockMs,
  };
}

/** The policy columns a state writes (the CAS on lastTickClockMs is the caller's). */
export function policyData(state: PolicyState, lastTickClockMs: number) {
  return {
    sharePersonnel: state.shares.personnel,
    shareOm: state.shares.om,
    shareProcurement: state.shares.procurement,
    shareRd: state.shares.rd,
    shareInfrastructure: state.shares.infrastructure,
    volunteerShare: state.volunteerShare,
    serviceMonths: state.serviceMonths,
    reserveYears: state.reserveYears,
    doctrine: state.doctrine,
    alertLevel: state.alertLevel,
    previousAlertLevel: state.previousAlertLevel,
    alertChangedClockMs: state.alertChangedClockMs,
    omPriority: state.omPriority,
    rdStock: state.rdStock,
    infrastructureStock: state.infrastructureStock,
    priceIndex: state.priceIndex,
    surgeStartedClockMs: state.surgeStartedClockMs,
    lastTickClockMs,
  } satisfies Prisma.DefensePolicyUncheckedUpdateInput;
}

export function branchState(row: MilitaryBranch, operationWear: number): BranchState {
  return {
    id: row.id,
    domain: row.domain,
    effortShare: row.effortShare,
    targetActive: row.targetActive,
    active: row.activeDuty,
    reserves: row.reserves,
    capital: row.capital,
    condition: row.readinessCondition,
    training: row.readinessTraining,
    reserveTraining: row.reserveTraining,
    mobilisationOrder: row.mobilisationOrder,
    mobilisationOrderedClockMs: row.mobilisationOrderedClockMs,
    operationWear,
  };
}

/** The branch columns a state (and its derived view, for the P/S/mobilised snapshot) writes. */
export function branchData(state: BranchState, view: BranchView | undefined, lastTickClockMs: number) {
  return {
    activeDuty: state.active,
    reserves: state.reserves,
    capital: state.capital,
    readinessCondition: state.condition,
    readinessTraining: state.training,
    reserveTraining: state.reserveTraining,
    mobilisationOrder: state.mobilisationOrder,
    mobilisationOrderedClockMs: state.mobilisationOrderedClockMs,
    readinessPersonnel: view?.subScores.personnel ?? 0,
    readinessEquipment: view?.subScores.equipment ?? 0,
    mobilised: view?.mobilised ?? 0,
    lastTickClockMs,
  } satisfies Prisma.MilitaryBranchUncheckedUpdateInput;
}

export function orderState(row: ProcurementOrder): OrderState {
  return {
    id: row.id,
    branchId: row.branchId,
    catalogKey: row.catalogKey,
    quantity: row.quantity,
    unitCost: row.unitCost,
    unitRealValue: row.unitRealValue,
    source: row.source,
    leadMonths: row.leadMonths,
    orderedClockMs: row.orderedClockMs,
    expectedClockMs: row.expectedClockMs,
    paidSoFar: row.paidSoFar,
    status: row.status,
    designYear: row.designYear,
  };
}

type CatalogFacts = Pick<
  MilitaryEquipmentCatalog,
  "key" | "subcategory" | "capabilities" | "crewRequirement" | "acquisitionCost" | "era"
>;

/** The catalog item's role (`capabilities.role`), or null. */
export function catalogRole(capabilities: string | null | undefined): string | null {
  if (!capabilities) return null;
  try {
    const parsed: { role?: unknown } = JSON.parse(capabilities);
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

/** A catalog era's design year. */
export const eraDesignYear = (era: string | null | undefined) =>
  ERA_DESIGN_YEAR[era ?? ""] ?? DEFAULT_DESIGN_YEAR;

export function assetState(
  row: Pick<MilitaryAsset, "branchId" | "catalogKey" | "quantity" | "acquisitionCost" | "designYear">,
  catalog: CatalogFacts | undefined
): AssetState {
  return {
    branchId: row.branchId,
    catalogKey: row.catalogKey,
    subcategory: catalog?.subcategory ?? null,
    role: catalogRole(catalog?.capabilities),
    quantity: row.quantity,
    unitRealValue: catalog?.acquisitionCost ?? row.acquisitionCost,
    designYear: row.designYear ?? (catalog ? eraDesignYear(catalog.era) : null),
    crewPerUnit: catalog?.crewRequirement ?? 0,
  };
}
