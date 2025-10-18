import type { GovernmentBuilderState } from '~/types/government';
import type { SuggestionItem } from '~/components/builders/SuggestionsPanel';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';

export function computeGovernmentSuggestions(state: GovernmentBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  const totalPercent = state.budgetAllocations.reduce((s, a) => s + (a.allocatedPercent || 0), 0);
  if (totalPercent > 100) {
    suggestions.push({
      id: 'budget-cap',
      title: 'Reduce allocations to 100% total',
      severity: 'warning',
      description: `Currently at ${totalPercent.toFixed(1)}%. Suggest trimming highest department by ${(totalPercent - 100).toFixed(1)}%.`,
    });
  }
  const totalRevenue = state.revenueSources.reduce((s, r) => s + (r.revenueAmount || 0), 0);
  if (state.structure.totalBudget > 0 && totalRevenue > state.structure.totalBudget * 1.25) {
    suggestions.push({
      id: 'revenue-vs-budget',
      title: 'Revenue far exceeds budget',
      severity: 'info',
      description: 'Consider lowering some revenue sources or increasing budget allocations to reflect capacity.',
    });
  }
  return suggestions;
}

export function computeTaxSuggestions(state: TaxBuilderState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  const incomeIdx = state.categories.findIndex(c => c.categoryType.toLowerCase().includes('income'));
  const corpIdx = state.categories.findIndex(c => c.categoryType.toLowerCase().includes('corporate'));
  if (state.taxSystem.alternativeMinTax) {
    if (incomeIdx >= 0) {
      const rate = state.categories[incomeIdx]?.baseRate || 0;
      if (rate < 5) suggestions.push({ id: 'income-amt-nudge', title: 'Increase Personal Income base rate', severity: 'info', description: 'AMT is enabled but personal income base rate is very low (<5%). Consider raising to reduce AMT hits.' });
    }
    if (corpIdx >= 0) {
      const rate = state.categories[corpIdx]?.baseRate || 0;
      if (rate < 10) suggestions.push({ id: 'corp-amt-nudge', title: 'Increase Corporate base rate', severity: 'info', description: 'AMT is enabled but corporate base rate is low (<10%). Consider raising.' });
    }
  }
  return suggestions;
}


