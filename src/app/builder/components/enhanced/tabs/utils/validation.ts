"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useMemo } from "react";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import type { ValidationMessage } from "~/components/shared/feedback/ValidationFeedback";

export interface SectorContribution {
  id: string;
  name: string;
  gdpContribution: number;
  employmentShare: number;
  isZeroGdp: boolean;
  isZeroEmployment: boolean;
}

export interface EconomyValidationResult {
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

  // Sector checks
  const sectorSum = economyBuilder.sectors.reduce((sum, s) => sum + s.gdpContribution, 0);
  const employmentSum = economyBuilder.sectors.reduce((sum, s) => sum + s.employmentShare, 0);

  const hasZeroContribution: SectorContribution[] = [];
  for (const sector of economyBuilder.sectors) {
    const isZeroGdp = sector.gdpContribution === 0;
    const isZeroEmployment = sector.employmentShare === 0;
    if (isZeroGdp || isZeroEmployment) {
      hasZeroContribution.push({
        id: sector.id,
        name: sector.name,
        gdpContribution: sector.gdpContribution,
        employmentShare: sector.employmentShare,
        isZeroGdp,
        isZeroEmployment,
      });
    }
  }

  if (Math.abs(sectorSum - 100) > 1) {
    const msg: ValidationMessage = {
      field: "sectors",
      message: `Sector GDP contributions must sum to 100% (currently ${sectorSum.toFixed(1)}%)`,
      severity: "error",
    };
    messages.push(msg);
    byTab.sectors.push(msg);
  }

  if (Math.abs(employmentSum - 100) > 1) {
    const msg: ValidationMessage = {
      field: "sectors",
      message: `Employment shares must sum to 100% (currently ${employmentSum.toFixed(1)}%)`,
      severity: "error",
    };
    messages.push(msg);
    byTab.sectors.push(msg);
  }

  for (const sc of hasZeroContribution) {
    if (sc.isZeroGdp || sc.isZeroEmployment) {
      const parts: string[] = [];
      if (sc.isZeroGdp) parts.push("0% GDP");
      if (sc.isZeroEmployment) parts.push("0% employment");
      const msg: ValidationMessage = {
        field: sc.id,
        message: `${sc.name} has ${parts.join(", ")}`,
        severity: "warning",
      };
      messages.push(msg);
      byTab.sectors.push(msg);
    }
  }

  // Labor checks
  if (economyBuilder.laborMarket.laborForceParticipationRate > 95) {
    const msg: ValidationMessage = {
      field: "participationRate",
      message: "Labor force participation rate seems too high",
      severity: "warning",
    };
    messages.push(msg);
    byTab.labor.push(msg);
  }

  if (economyBuilder.laborMarket.laborForceParticipationRate < 20) {
    const msg: ValidationMessage = {
      field: "participationRate",
      message: "Labor force participation rate seems too low",
      severity: "warning",
    };
    messages.push(msg);
    byTab.labor.push(msg);
  }

  if (
    economyBuilder.laborMarket.unemploymentRate < 0 ||
    economyBuilder.laborMarket.unemploymentRate > 50
  ) {
    const msg: ValidationMessage = {
      field: "unemploymentRate",
      message: "Unemployment rate seems unrealistic",
      severity: "error",
    };
    messages.push(msg);
    byTab.labor.push(msg);
  }

  // Demographics checks
  const ageDist = economyBuilder.demographics.ageDistribution;
  const ageSum = (ageDist?.under15 || 0) + (ageDist?.age15to64 || 0) + (ageDist?.over65 || 0);

  if (Math.abs(ageSum - 100) > 1) {
    const msg: ValidationMessage = {
      field: "ageDistribution",
      message: `Age distribution must sum to 100% (currently ${ageSum.toFixed(1)}%)`,
      severity: "error",
    };
    messages.push(msg);
    byTab.demographics.push(msg);
  }

  const hasValidAgeDist = Math.abs(ageSum - 100) <= 1;

  // Component impact info
  const hasComponentImpact = selectedComponents.length > 0;
  if (hasComponentImpact) {
    const msg: ValidationMessage = {
      field: "components",
      message: `${selectedComponents.length} atomic component${selectedComponents.length === 1 ? "" : "s"} active — modifiers applied across all tabs`,
      severity: "info",
    };
    messages.push(msg);
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

export function scrollToField(fieldKey: string) {
  const el = document.querySelector(`[data-field="${fieldKey}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-red-500/50", "rounded-lg");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-red-500/50", "rounded-lg");
    }, 2000);
  }
}
