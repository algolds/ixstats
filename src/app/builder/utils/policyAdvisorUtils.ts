// Policy Advisor Utilities

import type { EconomicInputs } from '../lib/economy-data-service';
import type { PolicyAdvisorTip } from '../types/builder';

export function generatePolicyAdvisorTips(inputs: EconomicInputs): PolicyAdvisorTip[] {
  const tips: PolicyAdvisorTip[] = [];

  // High unemployment warning
  if (inputs.laborEmployment.unemploymentRate > 10) {
    tips.push({
      id: 'high-unemployment',
      section: 'labor',
      type: 'warning',
      title: 'High Unemployment Risk',
      description: 'Unemployment above 10% may lead to social instability and reduced economic growth.',
      impact: 'Consider increasing infrastructure spending or reducing labor taxes.'
    });
  }

  // Debt sustainability
  if (inputs.fiscalSystem.totalDebtGDPRatio > 100) {
    tips.push({
      id: 'debt-sustainability',
      section: 'fiscal',
      type: 'warning',
      title: 'High Debt Levels',
      description: 'Debt-to-GDP ratio above 100% may threaten fiscal sustainability.',
      impact: 'Consider reducing government spending or increasing tax revenue.'
    });
  }

  // Low education spending
  if ((inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0) < 15) {
    tips.push({
      id: 'education-investment',
      section: 'government',
      type: 'suggestion',
      title: 'Education Investment Opportunity',
      description: 'Higher education spending can boost long-term economic growth.',
      impact: 'Consider increasing education budget to 15-20% of government spending.'
    });
  }

  // Inflation optimization
  const idealInflation = 2;
  if (Math.abs(inputs.coreIndicators.inflationRate - idealInflation) > 3) {
    tips.push({
      id: 'inflation-target',
      section: 'core',
      type: 'optimization',
      title: 'Inflation Target Optimization',
      description: 'Central banks typically target 2% inflation for optimal economic stability.',
      impact: 'Adjust monetary policy to achieve target inflation rate.'
    });
  }

  // Labor force participation
  if (inputs.laborEmployment.laborForceParticipationRate < 60) {
    tips.push({
      id: 'labor-participation',
      section: 'labor',
      type: 'suggestion',
      title: 'Low Labor Participation',
      description: 'Labor force participation below 60% indicates underutilized human resources.',
      impact: 'Consider childcare support, education programs, or reduced barriers to work.'
    });
  }

  // Tax efficiency
  if ((inputs.fiscalSystem.taxRevenueGDPPercent || 0) < 20) {
    tips.push({
      id: 'tax-efficiency',
      section: 'fiscal',
      type: 'optimization',
      title: 'Tax Collection Efficiency',
      description: 'Tax revenue below 20% of GDP may indicate collection inefficiency.',
      impact: 'Consider improving tax administration or broadening the tax base.'
    });
  }

  return tips;
}