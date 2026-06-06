/**
 * Government Warnings — pure helper functions for computing government builder warnings.
 *
 * Extracted from GovernmentStep.tsx so that both the inline Verification Checkpoint
 * and the unified `useBuilderAlerts` hook share a single source of truth.
 *
 * All functions are pure: no hooks, no state, no side effects.
 */

export interface GovernmentWarnings {
  gdpCapWarning: string | null;
  deltaWarning: string | null;
  currencyChangeWarning: string | null;
}

/**
 * Compute all government builder warnings from the current builder state.
 *
 * @param governmentStructure - The full government builder structure
 * @param nominalGDP - The country's nominal GDP
 * @param baselineBudget - The initial budget value captured on mount (null if unavailable)
 * @param baselineCurrency - The initial currency captured on mount (null if unavailable)
 */
export function computeGovernmentWarnings(
  governmentStructure: {
    structure?: {
      totalBudget?: number;
      budgetCurrency?: string;
    };
  } | null,
  nominalGDP: number,
  baselineBudget: number | null,
  baselineCurrency: string | null
): GovernmentWarnings {
  // GDP cap warning
  const budget = governmentStructure?.structure?.totalBudget || 0;
  const gdpCapWarning =
    budget > nominalGDP && nominalGDP > 0
      ? `GDP Threshold Violated: Total budget cannot exceed your country's nominal GDP (${nominalGDP.toLocaleString()}). Please adjust the budget allocation or structure.`
      : null;

  // Delta warning (only if baseline is available)
  let deltaWarning: string | null = null;
  if (baselineBudget !== null && budget > 0) {
    const deltaPct = Math.abs((budget - baselineBudget) / baselineBudget) * 100;
    if (deltaPct > 25) {
      deltaWarning = `Budget Delta Alert: The proposed budget of ${budget.toLocaleString()} has changed by ${deltaPct.toFixed(1)}% compared to the country's baseline. Ensure revenue channels are sufficient to avoid instability.`;
    }
  }

  // Currency change warning (only if baseline is available)
  const currentCurrency = governmentStructure?.structure?.budgetCurrency || null;
  const currencyChangeWarning =
    baselineCurrency !== null && currentCurrency !== null && currentCurrency !== baselineCurrency
      ? `Currency Conversion: Budget currency has changed from "${baselineCurrency}" to "${currentCurrency}". Ensure this aligns with trade partners.`
      : null;

  return { gdpCapWarning, deltaWarning, currencyChangeWarning };
}
