import { ComponentType } from "~/lib/enums";
import { CONFLICT_RULES } from "~/lib/atomic-builder-state";
import type { MatchResult } from "./wiki-attribute-matcher";

export interface ConflictReport {
  type: "component_conflict" | "data_inconsistency" | "budget_overflow";
  componentA?: ComponentType;
  componentB?: ComponentType;
  description: string;
  severity: "high" | "medium" | "low";
  autoResolved: boolean;
  resolution?: string;
}

export function detectWikiImportConflicts(
  matchResult: MatchResult,
  data: {
    gdpInfobox?: number;
    gdpEconomyBuilder?: number;
    totalBudget?: number;
    budgetAllocations?: Array<{ allocatedPercent: number }>;
  }
): ConflictReport[] {
  const reports: ConflictReport[] = [];

  // 1. Component conflicts
  const selectedComponents = matchResult.selected.map((m) => m.component);

  for (const rule of CONFLICT_RULES) {
    const [compA, compB] = rule.components;
    const hasA = selectedComponents.includes(compA);
    const hasB = selectedComponents.includes(compB);

    if (hasA && hasB) {
      const matchA = matchResult.selected.find((m) => m.component === compA)!;
      const matchB = matchResult.selected.find((m) => m.component === compB)!;
      const lowerComponent = matchA.score <= matchB.score ? matchA : matchB;
      const removedComponent = lowerComponent.component;
      const keptComponent = lowerComponent.component === compA ? compB : compA;

      reports.push({
        type: "component_conflict",
        componentA: compA,
        componentB: compB,
        description: rule.description,
        severity: "high",
        autoResolved: true,
        resolution: `Auto-resolved by removing ${removedComponent} (lower score: ${lowerComponent.score}), keeping ${keptComponent}`,
      });
    }
  }

  // 2. Data inconsistencies - GDP mismatch
  if (data.gdpInfobox !== undefined && data.gdpEconomyBuilder !== undefined) {
    const infoboxGdp = data.gdpInfobox;
    const builderGdp = data.gdpEconomyBuilder;

    if (infoboxGdp > 0 && builderGdp > 0) {
      const diffPercent = (Math.abs(infoboxGdp - builderGdp) / infoboxGdp) * 100;

      if (diffPercent > 10) {
        reports.push({
          type: "data_inconsistency",
          description: `GDP mismatch: infobox (${infoboxGdp}) differs from economy builder (${builderGdp}) by ${diffPercent.toFixed(1)}%`,
          severity: "medium",
          autoResolved: true,
          resolution: `Auto-resolved by using infobox GDP value (${infoboxGdp}) as source of truth`,
        });
      }
    }
  }

  // 3. Budget overflow
  if (data.budgetAllocations && data.budgetAllocations.length > 0) {
    const totalAllocated = data.budgetAllocations.reduce(
      (sum, alloc) => sum + alloc.allocatedPercent,
      0
    );

    if (totalAllocated > 100) {
      reports.push({
        type: "budget_overflow",
        description: `Budget allocations total ${totalAllocated.toFixed(1)}%, exceeding 100% limit`,
        severity: "high",
        autoResolved: true,
        resolution: `Auto-resolved by scaling all allocations proportionally (factor: ${(100 / totalAllocated).toFixed(4)})`,
      });
    }
  }

  return reports;
}
