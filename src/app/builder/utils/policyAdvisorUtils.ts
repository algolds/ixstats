// Policy Advisor Utilities

import type { EconomicInputs } from "../lib/economy-data-service";
import type { PolicyAdvisorTip } from "../types/builder";

export function generatePolicyAdvisorTips(
  inputs: EconomicInputs,
  activeSection?: string
): PolicyAdvisorTip[] {
  const tips: PolicyAdvisorTip[] = [];

  // === NATIONAL SYMBOLS SECTION ===
  if (!activeSection || activeSection === "national-symbols") {
    if (!inputs.flagUrl && !inputs.coatOfArmsUrl) {
      tips.push({
        id: "missing-symbols",
        section: "national-symbols",
        type: "suggestion",
        title: "Add National Symbols",
        description: "National symbols like flags and coat of arms strengthen national identity.",
        impact: "Upload your flag and coat of arms to enhance your country's visual identity.",
      });
    }
  }

  // === CORE INDICATORS SECTION ===
  if (!activeSection || activeSection === "core-indicators") {
    // GDP per capita optimization
    if (inputs.coreIndicators.gdpPerCapita < 10000) {
      tips.push({
        id: "low-gdp-per-capita",
        section: "core-indicators",
        type: "optimization",
        title: "GDP Per Capita Growth",
        description: "GDP per capita below $10,000 indicates significant growth potential.",
        impact: "Focus on education, infrastructure, and business-friendly policies.",
      });
    }

    // Population growth analysis
    if (inputs.demographics.populationGrowthRate < 0) {
      tips.push({
        id: "population-decline",
        section: "core-indicators",
        type: "warning",
        title: "Population Decline Risk",
        description: "Negative population growth can lead to economic stagnation.",
        impact: "Consider family support policies and immigration programs.",
      });
    } else if (inputs.demographics.populationGrowthRate > 3) {
      tips.push({
        id: "rapid-population-growth",
        section: "core-indicators",
        type: "warning",
        title: "Rapid Population Growth",
        description: "Very high population growth (>3%) strains resources and infrastructure.",
        impact: "Ensure adequate healthcare, education, and job creation.",
      });
    }

    // Inflation optimization
    const idealInflation = 2;
    if (Math.abs(inputs.coreIndicators.inflationRate - idealInflation) > 3) {
      tips.push({
        id: "inflation-target",
        section: "core-indicators",
        type: "optimization",
        title: "Inflation Target Optimization",
        description: "Central banks typically target 2% inflation for optimal economic stability.",
        impact: "Adjust monetary policy to achieve target inflation rate.",
      });
    }

    // Economic growth analysis
    if (inputs.coreIndicators.realGDPGrowthRate < 0) {
      tips.push({
        id: "economic-recession",
        section: "core-indicators",
        type: "warning",
        title: "Economic Recession",
        description: "Negative GDP growth indicates economic contraction.",
        impact: "Implement stimulus measures and structural reforms.",
      });
    }
  }

  // === LABOR & EMPLOYMENT SECTION ===
  if (!activeSection || activeSection === "labor-employment") {
    // High unemployment warning
    if (inputs.laborEmployment.unemploymentRate > 10) {
      tips.push({
        id: "high-unemployment",
        section: "labor-employment",
        type: "warning",
        title: "High Unemployment Risk",
        description:
          "Unemployment above 10% may lead to social instability and reduced economic growth.",
        impact: "Consider increasing infrastructure spending or reducing labor taxes.",
      });
    }

    // Labor force participation
    if (inputs.laborEmployment.laborForceParticipationRate < 60) {
      tips.push({
        id: "labor-participation",
        section: "labor-employment",
        type: "suggestion",
        title: "Low Labor Participation",
        description: "Labor force participation below 60% indicates underutilized human resources.",
        impact: "Consider childcare support, education programs, or reduced barriers to work.",
      });
    }

    // Minimum wage analysis
    const minWageToGdpRatio =
      (inputs.laborEmployment.minimumWage / inputs.coreIndicators.gdpPerCapita) * 100;
    if (minWageToGdpRatio < 20) {
      tips.push({
        id: "low-minimum-wage",
        section: "labor-employment",
        type: "suggestion",
        title: "Minimum Wage Consideration",
        description: "Minimum wage appears low relative to GDP per capita.",
        impact: "Consider gradual increases to improve living standards.",
      });
    } else if (minWageToGdpRatio > 60) {
      tips.push({
        id: "high-minimum-wage",
        section: "labor-employment",
        type: "warning",
        title: "High Minimum Wage Risk",
        description: "Very high minimum wage may reduce employment opportunities.",
        impact: "Monitor employment levels and adjust gradually if needed.",
      });
    }
  }

  // === FISCAL SYSTEM SECTION ===
  if (!activeSection || activeSection === "fiscal-system") {
    // Debt sustainability
    if (inputs.fiscalSystem.totalDebtGDPRatio > 100) {
      tips.push({
        id: "debt-sustainability",
        section: "fiscal-system",
        type: "warning",
        title: "High Debt Levels",
        description: "Debt-to-GDP ratio above 100% may threaten fiscal sustainability.",
        impact: "Consider reducing government spending or increasing tax revenue.",
      });
    }

    // Tax efficiency
    if ((inputs.fiscalSystem.taxRevenueGDPPercent || 0) < 20) {
      tips.push({
        id: "tax-efficiency",
        section: "fiscal-system",
        type: "optimization",
        title: "Tax Collection Efficiency",
        description: "Tax revenue below 20% of GDP may indicate collection inefficiency.",
        impact: "Consider improving tax administration or broadening the tax base.",
      });
    }

    // Budget balance analysis
    const budgetBalance =
      inputs.fiscalSystem.taxRevenueGDPPercent - inputs.fiscalSystem.governmentBudgetGDPPercent;
    if (budgetBalance < -5) {
      tips.push({
        id: "budget-deficit",
        section: "fiscal-system",
        type: "warning",
        title: "Large Budget Deficit",
        description: "Budget deficit exceeding 5% of GDP may be unsustainable.",
        impact: "Consider reducing spending or increasing revenue.",
      });
    }
  }

  // === GOVERNMENT SPENDING SECTION ===
  if (!activeSection || activeSection === "government-spending") {
    // Education spending
    const educationSpending =
      inputs.governmentSpending.spendingCategories.find((c) => c.category === "Education")
        ?.percent || 0;
    if (educationSpending < 15) {
      tips.push({
        id: "education-investment",
        section: "government-spending",
        type: "suggestion",
        title: "Education Investment Opportunity",
        description: "Higher education spending can boost long-term economic growth.",
        impact: "Consider increasing education budget to 15-20% of government spending.",
      });
    }

    // Healthcare spending
    const healthcareSpending =
      inputs.governmentSpending.spendingCategories.find((c) => c.category === "Healthcare")
        ?.percent || 0;
    if (healthcareSpending < 10) {
      tips.push({
        id: "healthcare-investment",
        section: "government-spending",
        type: "suggestion",
        title: "Healthcare Investment",
        description: "Adequate healthcare spending improves productivity and quality of life.",
        impact: "Consider allocating at least 10% of budget to healthcare.",
      });
    }

    // Infrastructure spending
    const infrastructureSpending =
      inputs.governmentSpending.spendingCategories.find((c) => c.category === "Infrastructure")
        ?.percent || 0;
    if (infrastructureSpending < 8) {
      tips.push({
        id: "infrastructure-investment",
        section: "government-spending",
        type: "optimization",
        title: "Infrastructure Development",
        description: "Infrastructure investment drives economic growth and competitiveness.",
        impact: "Consider increasing infrastructure spending to 8-12% of budget.",
      });
    }

    // Social safety net
    const socialSpending =
      inputs.governmentSpending.spendingCategories.find((c) => c.category === "Social Safety Net")
        ?.percent || 0;
    if (socialSpending < 5 && inputs.laborEmployment.unemploymentRate > 5) {
      tips.push({
        id: "social-safety-net",
        section: "government-spending",
        type: "suggestion",
        title: "Social Safety Net",
        description: "Adequate social protection helps during economic transitions.",
        impact: "Consider strengthening unemployment benefits and social assistance.",
      });
    }
  }

  // === DEMOGRAPHICS SECTION ===
  if (!activeSection || activeSection === "demographics") {
    // Age distribution analysis
    const over65 = inputs.demographics.ageDistribution.find((g) => g.group === "65+")?.percent || 0;
    if (over65 > 20) {
      tips.push({
        id: "aging-population",
        section: "demographics",
        type: "warning",
        title: "Aging Population Challenge",
        description: "High proportion of elderly citizens strains pension and healthcare systems.",
        impact: "Plan for increased healthcare costs and pension sustainability.",
      });
    }

    const under18 =
      inputs.demographics.ageDistribution.find((g) => g.group === "0-15")?.percent || 0;
    if (under18 > 40) {
      tips.push({
        id: "youth-bulge",
        section: "demographics",
        type: "optimization",
        title: "Youth Population Opportunity",
        description: "Large youth population offers economic growth potential.",
        impact: "Invest in education and job creation to harness demographic dividend.",
      });
    }

    // Life expectancy analysis
    if (inputs.demographics.lifeExpectancy < 70) {
      tips.push({
        id: "low-life-expectancy",
        section: "demographics",
        type: "warning",
        title: "Health System Investment Needed",
        description: "Life expectancy below 70 indicates potential health system deficiencies.",
        impact: "Prioritize healthcare infrastructure and preventive care.",
      });
    }
  }

  // Sort tips by priority (warnings first, then suggestions, then optimizations)
  const priorityOrder = { warning: 0, suggestion: 1, optimization: 2 };
  tips.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

  return tips;
}
