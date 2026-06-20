/**
 * Tax Builder Suggestions Engine
 *
 * Consolidates intelligence-based suggestions including:
 * - Tax system optimization suggestions
 * - Economic data-based recommendations
 * - AMT and bracket suggestions
 * - Revenue optimization hints
 */

import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { SuggestionItem } from "~/components/builders/SuggestionsPanel";
import { computeTaxSuggestions as baseComputeTaxSuggestions } from "~/components/builders/suggestions/utils";

/**
 * Compute comprehensive tax suggestions based on builder state
 */
export function computeTaxSuggestions(builderState: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // Get base suggestions from existing utility
  const baseSuggestions = baseComputeTaxSuggestions(builderState);
  suggestions.push(...baseSuggestions);

  // Add economic optimization suggestions
  suggestions.push(...getEconomicOptimizationSuggestions(builderState));

  // Add bracket structure suggestions
  suggestions.push(...getBracketStructureSuggestions(builderState));

  // Add compliance and efficiency suggestions
  suggestions.push(...getComplianceEfficiencySuggestions(builderState));

  // Add revenue balance suggestions
  suggestions.push(...getRevenueBalanceSuggestions(builderState));

  return suggestions;
}

/**
 * Economic optimization suggestions
 */
function getEconomicOptimizationSuggestions(builderState: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // Check for regressive tax structures
  const hasRegressiveStructure = builderState.categories.some(
    (cat: TaxBuilderState["categories"][number], idx: number) => {
      const brackets = builderState.brackets[idx.toString()] || [];
      if (brackets.length < 2) return false;

      const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rate < sorted[i - 1].rate) return true;
      }
      return false;
    }
  );

  if (hasRegressiveStructure) {
    suggestions.push({
      id: "regressive-structure-warning",
      title: "Regressive tax structure detected",
      description:
        "Some tax brackets have decreasing rates, which may create unintended incentives and reduce revenue.",
      severity: "warning",
    });
  }

  // Check for missing corporate tax
  const hasCorporateTax = builderState.categories.some(
    (cat: TaxBuilderState["categories"][number]) =>
      cat.categoryName.toLowerCase().includes("corporate")
  );

  if (!hasCorporateTax && builderState.categories.length > 0) {
    suggestions.push({
      id: "missing-corporate-tax",
      title: "Consider adding corporate income tax",
      description:
        "Most tax systems include corporate taxation. Adding a corporate tax category could diversify revenue sources.",
      severity: "info",
    });
  }

  // Check for VAT/sales tax
  const hasIndirectTax = builderState.categories.some(
    (cat: TaxBuilderState["categories"][number]) => cat.categoryType === "Indirect Tax"
  );

  if (!hasIndirectTax && builderState.categories.length > 0) {
    suggestions.push({
      id: "missing-indirect-tax",
      title: "Consider adding indirect taxation",
      description:
        "Indirect taxes (VAT, sales tax) provide stable revenue and are easier to collect than income taxes.",
      severity: "info",
    });
  }

  return suggestions;
}

/**
 * Bracket structure suggestions
 */
function getBracketStructureSuggestions(builderState: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  builderState.categories.forEach((cat: TaxBuilderState["categories"][number], idx: number) => {
    const brackets = builderState.brackets[idx.toString()] || [];

    // Progressive categories with no brackets
    if (cat.calculationMethod === "progressive" && brackets.length === 0) {
      suggestions.push({
        id: `missing-brackets-${idx}`,
        title: `Add tax brackets for ${cat.categoryName}`,
        description:
          "Progressive taxation requires defined income brackets. Add at least one bracket to enable progressive calculation.",
        severity: "warning",
      });
    }

    // Check for large gaps between brackets
    if (brackets.length >= 2) {
      const sorted = [...brackets].sort(
        (a: { minIncome: number }, b: { minIncome: number }) => a.minIncome - b.minIncome
      );
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.maxIncome && curr.minIncome - prev.maxIncome > prev.maxIncome * 0.5) {
          suggestions.push({
            id: `bracket-gap-${idx}-${i}`,
            title: `Large gap in ${cat.categoryName} brackets`,
            description: `There's a significant gap between bracket ${i} and ${i + 1}. Consider adding intermediate brackets for smoother progression.`,
            severity: "info",
          });
          break; // Only report once per category
        }
      }
    }

    // Check for very high top marginal rates
    if (brackets.length > 0) {
      const maxRate = Math.max(...brackets.map((b: { rate: number }) => b.rate));
      if (maxRate > 60) {
        suggestions.push({
          id: `high-marginal-rate-${idx}`,
          title: `Very high top rate in ${cat.categoryName}`,
          description: `The top marginal rate of ${maxRate}% may discourage economic activity. Consider moderating to 45-55% range.`,
          severity: "info",
        });
      }
    }
  });

  return suggestions;
}

/**
 * Compliance and efficiency suggestions
 */
function getComplianceEfficiencySuggestions(builderState: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // Low compliance rate
  if (builderState.taxSystem.complianceRate && builderState.taxSystem.complianceRate < 75) {
    suggestions.push({
      id: "low-compliance-rate",
      title: "Low tax compliance rate",
      description: `Compliance rate of ${builderState.taxSystem.complianceRate}% is below recommended 75%. Consider simplifying tax structure or improving enforcement.`,
      severity: "warning",
    });
  }

  // Low collection efficiency
  if (
    builderState.taxSystem.collectionEfficiency &&
    builderState.taxSystem.collectionEfficiency < 80
  ) {
    suggestions.push({
      id: "low-collection-efficiency",
      title: "Low collection efficiency",
      description: `Collection efficiency of ${builderState.taxSystem.collectionEfficiency}% suggests administrative challenges. Target 85-90% for optimal revenue.`,
      severity: "warning",
    });
  }

  // Too many categories (complexity)
  if (builderState.categories.length > 10) {
    suggestions.push({
      id: "too-many-categories",
      title: "Complex tax system",
      description: `${builderState.categories.length} tax categories may be difficult to administer. Consider consolidating similar categories.`,
      severity: "info",
    });
  }

  return suggestions;
}

/**
 * Revenue balance suggestions
 */
function getRevenueBalanceSuggestions(builderState: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // Check for balanced revenue sources
  if (builderState.categories.length >= 3) {
    const directTaxCount = builderState.categories.filter(
      (cat: TaxBuilderState["categories"][number]) => cat.categoryType === "Direct Tax"
    ).length;
    const indirectTaxCount = builderState.categories.filter(
      (cat: TaxBuilderState["categories"][number]) => cat.categoryType === "Indirect Tax"
    ).length;

    const directRatio = directTaxCount / builderState.categories.length;

    if (directRatio > 0.8) {
      suggestions.push({
        id: "revenue-imbalance-direct",
        title: "Heavy reliance on direct taxation",
        description:
          "Most revenue comes from direct taxes. Consider adding more indirect taxes for revenue stability.",
        severity: "info",
      });
    } else if (directRatio < 0.3) {
      suggestions.push({
        id: "revenue-imbalance-indirect",
        title: "Heavy reliance on indirect taxation",
        description:
          "Most revenue comes from indirect taxes. Consider balancing with direct taxes for equity.",
        severity: "info",
      });
    }
  }

  // Flat tax system without exemptions
  if (
    !builderState.taxSystem.progressiveTax &&
    builderState.exemptions.length === 0 &&
    builderState.categories.length > 0
  ) {
    suggestions.push({
      id: "flat-tax-no-exemptions",
      title: "Flat tax without exemptions",
      description:
        "Flat tax systems typically include exemptions or deductions to protect lower-income taxpayers. Consider adding exemptions.",
      severity: "info",
    });
  }

  return suggestions;
}

/**
 * Parse intelligence updates for tax-specific insights
 */
export function parseIntelligenceForTaxSuggestions(
  intelligenceData: any,
  builderState: TaxBuilderState
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // This would parse real-time intelligence data if available
  // For now, return empty array as intelligence integration is feature-flagged
  if (!intelligenceData) return suggestions;

  // Example: Parse economic indicators for tax policy suggestions
  if (intelligenceData.economy?.gdpGrowth) {
    const gdpGrowth = intelligenceData.economy.gdpGrowth;
    if (gdpGrowth < 0 && builderState.categories.length > 0) {
      suggestions.push({
        id: "economic-downturn-tax-relief",
        title: "Economic downturn detected",
        description:
          "GDP growth is negative. Consider temporary tax relief or stimulus measures to support economic recovery.",
        severity: "warning",
      });
    }
  }

  return suggestions;
}
