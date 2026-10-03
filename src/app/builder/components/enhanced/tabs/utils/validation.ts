"use client";

import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
interface ValidationMessage {
  id?: string;
  field?: string;
  message: string;
  severity: "error" | "warning" | "info" | "success";
  type?: "error" | "warning" | "info" | "success";
  tab?: string;
}

export interface SectorContribution {
  id: string;
  name: string;
  gdpContribution: number;
  employmentShare: number;
  isZeroGdp: boolean;
  isZeroEmployment: boolean;
}

interface EconomyValidationResult {
  messages: ValidationMessage[];
  byTab: {
    sectors: ValidationMessage[];
    labor: ValidationMessage[];
    demographics: ValidationMessage[];
  };
  status: "valid" | "warning" | "error";
  sectorSum: number;
  employmentSum: number;
  ageSum: number;
  hasZeroContribution: SectorContribution[];
  regionNormalized: boolean;
}

export function validateEconomy(
  economyBuilder: EconomyBuilderState,
  selectedComponents: EconomicComponentType[]
): EconomyValidationResult {
  const messages: ValidationMessage[] = [];
  const byTab: EconomyValidationResult["byTab"] = { sectors: [], labor: [], demographics: [] };
  const report = (
    tab: keyof EconomyValidationResult["byTab"] | null,
    field: string,
    message: string,
    severity: ValidationMessage["severity"]
  ) => {
    const msg: ValidationMessage = { field, message, severity };
    messages.push(msg);
    if (tab) byTab[tab].push(msg);
  };

  // Sector checks
  const sectorSum = economyBuilder.sectors.reduce((sum, s) => sum + s.gdpContribution, 0);
  const employmentSum = economyBuilder.sectors.reduce((sum, s) => sum + s.employmentShare, 0);

  const hasZeroContribution: SectorContribution[] = [];
  for (const sector of economyBuilder.sectors) {
    const isZeroGdp = sector.gdpContribution === 0;
    const isZeroEmployment = sector.employmentShare === 0;
    if (!isZeroGdp && !isZeroEmployment) continue;
    hasZeroContribution.push({
      id: sector.id,
      name: sector.name,
      gdpContribution: sector.gdpContribution,
      employmentShare: sector.employmentShare,
      isZeroGdp,
      isZeroEmployment,
    });
  }

  if (Math.abs(sectorSum - 100) > 1) {
    report(
      "sectors",
      "sectors",
      `Sector GDP contributions must sum to 100% (currently ${sectorSum.toFixed(1)}%)`,
      "error"
    );
  }
  if (Math.abs(employmentSum - 100) > 1) {
    report(
      "sectors",
      "sectors",
      `Employment shares must sum to 100% (currently ${employmentSum.toFixed(1)}%)`,
      "error"
    );
  }

  for (const sc of hasZeroContribution) {
    const parts = [sc.isZeroGdp && "0% GDP", sc.isZeroEmployment && "0% employment"].filter(
      Boolean
    );
    report("sectors", sc.id, `${sc.name} has ${parts.join(", ")}`, "warning");
  }

  // Labor checks
  const { laborForceParticipationRate, unemploymentRate } = economyBuilder.laborMarket;
  if (laborForceParticipationRate > 95) {
    report(
      "labor",
      "participationRate",
      "Labor force participation rate seems too high",
      "warning"
    );
  }
  if (laborForceParticipationRate < 20) {
    report("labor", "participationRate", "Labor force participation rate seems too low", "warning");
  }
  if (unemploymentRate < 0 || unemploymentRate > 50) {
    report("labor", "unemploymentRate", "Unemployment rate seems unrealistic", "error");
  }

  // Demographics checks
  const ageDist = economyBuilder.demographics.ageDistribution;
  const ageSum = [ageDist?.under15, ageDist?.age15to64, ageDist?.over65].reduce<number>(
    (sum, share) => sum + (share || 0),
    0
  );
  const hasValidAgeDist = Math.abs(ageSum - 100) <= 1;
  if (!hasValidAgeDist) {
    report(
      "demographics",
      "ageDistribution",
      `Age distribution must sum to 100% (currently ${ageSum.toFixed(1)}%)`,
      "error"
    );
  }

  const componentCount = selectedComponents.length;
  if (componentCount > 0) {
    report(
      null,
      "components",
      `${componentCount} atomic component${componentCount === 1 ? "" : "s"} active — modifiers applied across all tabs`,
      "info"
    );
  }

  const status: EconomyValidationResult["status"] = messages.some((m) => m.severity === "error")
    ? "error"
    : messages.some((m) => m.severity === "warning")
      ? "warning"
      : "valid";

  return {
    messages,
    byTab,
    status,
    sectorSum,
    employmentSum,
    ageSum,
    hasZeroContribution,
    regionNormalized: !hasValidAgeDist,
  };
}
