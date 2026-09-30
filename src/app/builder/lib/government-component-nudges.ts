/**
 * Fiscal nudges applied when the player adds certain government components.
 *
 * A nudge applies once, when the component is added. It must never re-apply
 * when the builder remounts (every section switch) or when the editor loads a
 * country that already has the component: that compounded the tax rate on each
 * visit and the editor then autosaved the drift.
 */

import { ComponentType } from "~/lib/enums";
import type { EconomicInputs } from "./economy-types";

/**
 * The economic inputs after the components newly present in `next` (and absent
 * from `previous`) are applied, or null when no added component nudges anything.
 * Never mutates `inputs`.
 */
export function applyGovernmentComponentNudges(
  inputs: EconomicInputs,
  previous: readonly ComponentType[],
  next: readonly ComponentType[]
): EconomicInputs | null {
  const added = new Set(next.filter((component) => !previous.includes(component)));
  const addsSocialDemocracy = added.has(ComponentType.SOCIAL_DEMOCRACY);
  const addsFreeMarket = added.has(ComponentType.FREE_MARKET_SYSTEM);
  if (!addsSocialDemocracy && !addsFreeMarket) return null;

  const fiscalSystem = { ...inputs.fiscalSystem };
  const governmentSpending = { ...inputs.governmentSpending };

  if (addsSocialDemocracy) {
    fiscalSystem.taxRevenueGDPPercent = Math.min(fiscalSystem.taxRevenueGDPPercent * 1.2, 60);
    governmentSpending.totalSpending = Math.max(governmentSpending.totalSpending, 25);
  }
  if (addsFreeMarket) {
    fiscalSystem.taxRevenueGDPPercent = Math.max(fiscalSystem.taxRevenueGDPPercent * 0.8, 15);
  }

  return { ...inputs, fiscalSystem, governmentSpending };
}
