"use client";

import { useState, useEffect, useCallback } from "react";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface FeedbackMetric {
  label: string;
  value: number;
  change?: number;
  changePercent?: number;
  trend: "up" | "down" | "stable";
  status: "good" | "warning" | "danger";
  unit?: string;
}

interface FeedbackSection {
  title: string;
  metrics: FeedbackMetric[];
}

interface RealTimeFeedback {
  overallScore: number;
  sections: FeedbackSection[];
  recommendations: string[];
}

export function useRealTimeFeedback(
  currentInputs: EconomicInputs | null,
  originalInputs: EconomicInputs | null,
  enabled: boolean = true
) {
  const [feedback, setFeedback] = useState<RealTimeFeedback | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateFeedback = useCallback(
    async (inputs: EconomicInputs, original: EconomicInputs | null) => {
      if (!inputs || !enabled) return null;

      setIsCalculating(true);

      // Simulate async calculation (could be replaced with actual API call)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const metrics: FeedbackSection[] = [];
      const recommendations: string[] = [];

      // Economic Health Analysis
      const economicHealth: FeedbackMetric[] = [];

      // GDP Per Capita Analysis
      const gdpPerCapita = inputs.coreIndicators.gdpPerCapita;
      const originalGdpPerCapita = original?.coreIndicators.gdpPerCapita || gdpPerCapita;
      const gdpChange = gdpPerCapita - originalGdpPerCapita;
      const gdpChangePercent =
        originalGdpPerCapita > 0 ? (gdpChange / originalGdpPerCapita) * 100 : 0;

      economicHealth.push({
        label: "GDP per Capita",
        value: gdpPerCapita,
        change: gdpChange,
        changePercent: gdpChangePercent,
        trend: gdpChange > 0 ? "up" : gdpChange < 0 ? "down" : "stable",
        status: gdpPerCapita >= 50000 ? "good" : gdpPerCapita >= 25000 ? "warning" : "danger",
        unit: "$",
      });

      // Growth Rate Analysis
      const growthRate = inputs.coreIndicators.realGDPGrowthRate;
      const originalGrowthRate = original?.coreIndicators.realGDPGrowthRate || growthRate;
      const growthChange = growthRate - originalGrowthRate;

      economicHealth.push({
        label: "Growth Rate",
        value: growthRate,
        change: growthChange,
        trend: growthChange > 0 ? "up" : growthChange < 0 ? "down" : "stable",
        status: growthRate >= 3 ? "good" : growthRate >= 1 ? "warning" : "danger",
        unit: "%",
      });

      // Unemployment Rate Analysis
      const unemploymentRate = inputs.laborEmployment.unemploymentRate;
      const originalUnemploymentRate =
        original?.laborEmployment.unemploymentRate || unemploymentRate;
      const unemploymentChange = unemploymentRate - originalUnemploymentRate;

      economicHealth.push({
        label: "Unemployment",
        value: unemploymentRate,
        change: unemploymentChange,
        trend: unemploymentChange < 0 ? "up" : unemploymentChange > 0 ? "down" : "stable", // Lower is better
        status: unemploymentRate <= 5 ? "good" : unemploymentRate <= 8 ? "warning" : "danger",
        unit: "%",
      });

      metrics.push({
        title: "Economic Health",
        metrics: economicHealth,
      });

      // Fiscal Stability Analysis
      const fiscalHealth: FeedbackMetric[] = [];

      // Debt to GDP Ratio
      const debtRatio = inputs.fiscalSystem.totalDebtGDPRatio;
      const originalDebtRatio = original?.fiscalSystem.totalDebtGDPRatio || debtRatio;
      const debtChange = debtRatio - originalDebtRatio;

      fiscalHealth.push({
        label: "Debt/GDP Ratio",
        value: debtRatio,
        change: debtChange,
        trend: debtChange < 0 ? "up" : debtChange > 0 ? "down" : "stable", // Lower is better
        status: debtRatio <= 60 ? "good" : debtRatio <= 90 ? "warning" : "danger",
        unit: "%",
      });

      // Budget Balance
      const budgetBalance = inputs.fiscalSystem.budgetDeficitSurplus;
      const originalBudgetBalance = original?.fiscalSystem.budgetDeficitSurplus || budgetBalance;
      const budgetChange = budgetBalance - originalBudgetBalance;

      fiscalHealth.push({
        label: "Budget Balance",
        value: budgetBalance,
        change: budgetChange,
        trend: budgetChange > 0 ? "up" : budgetChange < 0 ? "down" : "stable",
        status:
          budgetBalance >= 0
            ? "good"
            : budgetBalance >= -inputs.coreIndicators.nominalGDP * 0.03
              ? "warning"
              : "danger",
        unit: "$",
      });

      metrics.push({
        title: "Fiscal Stability",
        metrics: fiscalHealth,
      });

      // Social Indicators
      const socialHealth: FeedbackMetric[] = [];

      // Life Expectancy
      const lifeExpectancy = inputs.demographics.lifeExpectancy;
      const originalLifeExpectancy = original?.demographics.lifeExpectancy || lifeExpectancy;
      const lifeExpectancyChange = lifeExpectancy - originalLifeExpectancy;

      socialHealth.push({
        label: "Life Expectancy",
        value: lifeExpectancy,
        change: lifeExpectancyChange,
        trend: lifeExpectancyChange > 0 ? "up" : lifeExpectancyChange < 0 ? "down" : "stable",
        status: lifeExpectancy >= 80 ? "good" : lifeExpectancy >= 75 ? "warning" : "danger",
        unit: " years",
      });

      // Literacy Rate
      const literacyRate = inputs.demographics.literacyRate;
      const originalLiteracyRate = original?.demographics.literacyRate || literacyRate;
      const literacyChange = literacyRate - originalLiteracyRate;

      socialHealth.push({
        label: "Literacy Rate",
        value: literacyRate,
        change: literacyChange,
        trend: literacyChange > 0 ? "up" : literacyChange < 0 ? "down" : "stable",
        status: literacyRate >= 95 ? "good" : literacyRate >= 85 ? "warning" : "danger",
        unit: "%",
      });

      metrics.push({
        title: "Social Development",
        metrics: socialHealth,
      });

      // Generate recommendations based on metrics
      if (gdpPerCapita < 25000) {
        recommendations.push(
          "Consider increasing investment in education and infrastructure to boost GDP per capita"
        );
      }
      if (growthRate < 2) {
        recommendations.push(
          "Economic growth is below healthy levels - review fiscal and monetary policies"
        );
      }
      if (unemploymentRate > 8) {
        recommendations.push("High unemployment detected - consider job creation programs");
      }
      if (debtRatio > 90) {
        recommendations.push("Debt levels are concerning - implement debt reduction strategies");
      }
      if (budgetBalance < -inputs.coreIndicators.nominalGDP * 0.05) {
        recommendations.push(
          "Large budget deficit - consider reducing spending or increasing revenue"
        );
      }

      // Calculate overall score
      const allMetrics = metrics.flatMap((section) => section.metrics);
      const goodCount = allMetrics.filter((m) => m.status === "good").length;
      const overallScore = (goodCount / allMetrics.length) * 100;

      setIsCalculating(false);

      return {
        overallScore,
        sections: metrics,
        recommendations,
      };
    },
    [enabled]
  );

  useEffect(() => {
    if (currentInputs && enabled) {
      calculateFeedback(currentInputs, originalInputs).then(setFeedback);
    } else {
      setFeedback(null);
    }
  }, [currentInputs, originalInputs, enabled, calculateFeedback]);

  return {
    feedback,
    isCalculating,
    recalculate: () => {
      if (currentInputs) {
        calculateFeedback(currentInputs, originalInputs).then(setFeedback);
      }
    },
  };
}
