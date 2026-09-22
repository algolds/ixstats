import type { TaxSystem } from "~/types/tax-system";
import type { CoreEconomicIndicatorsData, LaborEmploymentData } from "~/types/economics";

export interface TaxEconomySyncProps {
  taxSystem?: TaxSystem;
  economicData?: {
    core?: CoreEconomicIndicatorsData;
    labor?: LaborEmploymentData;
  };
  onOptimize?: () => void;
  className?: string;
  currency?: string;
}

export interface TaxBurdenAnalysis {
  incomeClass: string;
  averageIncome: number;
  effectiveTaxRate: number;
  taxBurden: number;
  disposableIncome: number;
  populationPercent: number;
  color: string;
  status: "low" | "moderate" | "high" | "excessive";
}

export interface EconomicTierRecommendation {
  tier: "Developing" | "Emerging" | "Developed" | "Advanced";
  recommendedIncomeTaxRange: [number, number];
  recommendedCorporateTaxRange: [number, number];
  recommendedSalesTaxRange: [number, number];
  maxTaxBurden: number;
  currentAlignment: "aligned" | "undertaxed" | "overtaxed";
  recommendations: string[];
  color: string;
}

export interface EconomicImpact {
  gdpGrowthImpact: number;
  giniCoefficientChange: number;
  businessInvestmentImpact: "positive" | "neutral" | "negative";
  consumerSpendingImpact: "positive" | "neutral" | "negative";
  employmentImpact: "positive" | "neutral" | "negative";
  overallScore: number;
}

export function determineEconomicTier(
  core?: CoreEconomicIndicatorsData
): EconomicTierRecommendation["tier"] {
  if (!core) return "Emerging";
  const gdpPerCapita = core.gdpPerCapita;

  if (gdpPerCapita >= 40000) return "Advanced";
  if (gdpPerCapita >= 20000) return "Developed";
  if (gdpPerCapita >= 5000) return "Emerging";
  return "Developing";
}

export function calculateTaxBurdenAnalysis(
  taxSystem?: TaxSystem,
  labor?: LaborEmploymentData
): TaxBurdenAnalysis[] {
  if (!taxSystem?.taxCategories || !labor) {
    return [];
  }

  const averageIncome = labor.averageAnnualIncome || 50000;

  const incomeClasses = [
    {
      name: "Low Income",
      multiplier: 0.5,
      populationPercent: 40,
      color: "hsl(0, 84%, 60%)",
    },
    {
      name: "Middle Income",
      multiplier: 1.0,
      populationPercent: 40,
      color: "hsl(45, 93%, 58%)",
    },
    {
      name: "Upper Middle Income",
      multiplier: 2.0,
      populationPercent: 15,
      color: "hsl(160, 84%, 60%)",
    },
    {
      name: "High Income",
      multiplier: 5.0,
      populationPercent: 5,
      color: "hsl(217, 91%, 60%)",
    },
  ];

  return incomeClasses.map((incomeClass) => {
    const income = averageIncome * incomeClass.multiplier;

    const incomeTaxCategory = taxSystem.taxCategories?.find(
      (cat) =>
        cat.categoryName.toLowerCase().includes("income") &&
        cat.categoryType.toLowerCase().includes("personal")
    );

    const salesTaxCategory = taxSystem.taxCategories?.find(
      (cat) =>
        cat.categoryName.toLowerCase().includes("sales") ||
        cat.categoryName.toLowerCase().includes("vat")
    );

    let incomeTaxRate = 0;
    if (incomeTaxCategory && taxSystem.taxBrackets) {
      const applicableBrackets = taxSystem.taxBrackets
        .filter((b) => b.categoryId === incomeTaxCategory.id && b.isActive)
        .sort((a, b) => a.minIncome - b.minIncome);

      if (applicableBrackets.length > 0) {
        const bracket = [...applicableBrackets].reverse().find((b) => income >= b.minIncome);
        incomeTaxRate = bracket?.rate || incomeTaxCategory.baseRate || 0;
      } else {
        incomeTaxRate = incomeTaxCategory.baseRate || 0;
      }
    }

    const salesTaxRate = salesTaxCategory?.baseRate || 0;
    const effectiveTaxRate = incomeTaxRate + salesTaxRate * 0.7;
    const taxBurden = income * (effectiveTaxRate / 100);
    const disposableIncome = income - taxBurden;

    let status: TaxBurdenAnalysis["status"] = "moderate";
    if (effectiveTaxRate < 15) status = "low";
    else if (effectiveTaxRate < 30) status = "moderate";
    else if (effectiveTaxRate < 45) status = "high";
    else status = "excessive";

    return {
      incomeClass: incomeClass.name,
      averageIncome: income,
      effectiveTaxRate,
      taxBurden,
      disposableIncome,
      populationPercent: incomeClass.populationPercent,
      color: incomeClass.color,
      status,
    };
  });
}

export function calculateTierRecommendation(
  economicTier: EconomicTierRecommendation["tier"],
  taxSystem?: TaxSystem,
  taxBurdenAnalysis: TaxBurdenAnalysis[] = []
): EconomicTierRecommendation {
  const tierConfig: Record<
    EconomicTierRecommendation["tier"],
    Omit<EconomicTierRecommendation, "currentAlignment" | "recommendations">
  > = {
    Developing: {
      tier: "Developing",
      recommendedIncomeTaxRange: [10, 25],
      recommendedCorporateTaxRange: [15, 30],
      recommendedSalesTaxRange: [5, 12],
      maxTaxBurden: 25,
      color: "hsl(0, 84%, 60%)",
    },
    Emerging: {
      tier: "Emerging",
      recommendedIncomeTaxRange: [15, 30],
      recommendedCorporateTaxRange: [20, 35],
      recommendedSalesTaxRange: [8, 15],
      maxTaxBurden: 35,
      color: "hsl(45, 93%, 58%)",
    },
    Developed: {
      tier: "Developed",
      recommendedIncomeTaxRange: [20, 40],
      recommendedCorporateTaxRange: [20, 30],
      recommendedSalesTaxRange: [10, 20],
      maxTaxBurden: 45,
      color: "hsl(160, 84%, 60%)",
    },
    Advanced: {
      tier: "Advanced",
      recommendedIncomeTaxRange: [25, 50],
      recommendedCorporateTaxRange: [18, 28],
      recommendedSalesTaxRange: [15, 25],
      maxTaxBurden: 50,
      color: "hsl(217, 91%, 60%)",
    },
  };

  const config = tierConfig[economicTier];
  let currentAlignment: EconomicTierRecommendation["currentAlignment"] = "aligned";
  const recommendations: string[] = [];

  if (!taxSystem?.taxCategories) {
    return {
      ...config,
      currentAlignment: "aligned",
      recommendations: ["Configure tax system to receive recommendations"],
    };
  }

  const incomeTax = taxSystem.taxCategories.find(
    (cat) =>
      cat.categoryName.toLowerCase().includes("income") &&
      cat.categoryType.toLowerCase().includes("personal")
  );
  const corporateTax = taxSystem.taxCategories.find((cat) =>
    cat.categoryName.toLowerCase().includes("corporate")
  );
  const salesTax = taxSystem.taxCategories.find(
    (cat) =>
      cat.categoryName.toLowerCase().includes("sales") ||
      cat.categoryName.toLowerCase().includes("vat")
  );

  const incomeTaxRate = incomeTax?.baseRate || 0;
  const corporateTaxRate = corporateTax?.baseRate || 0;
  const salesTaxRate = salesTax?.baseRate || 0;

  if (incomeTaxRate < config.recommendedIncomeTaxRange[0]) {
    currentAlignment = "undertaxed";
    recommendations.push(
      `Consider increasing income tax from ${incomeTaxRate}% to ${config.recommendedIncomeTaxRange[0]}-${config.recommendedIncomeTaxRange[1]}% range for ${economicTier} economies`
    );
  } else if (incomeTaxRate > config.recommendedIncomeTaxRange[1]) {
    currentAlignment = "overtaxed";
    recommendations.push(
      `Income tax rate of ${incomeTaxRate}% exceeds optimal range (${config.recommendedIncomeTaxRange[0]}-${config.recommendedIncomeTaxRange[1]}%) for ${economicTier} economies`
    );
  }

  if (corporateTaxRate < config.recommendedCorporateTaxRange[0]) {
    recommendations.push(
      `Corporate tax rate of ${corporateTaxRate}% is below recommended range (${config.recommendedCorporateTaxRange[0]}-${config.recommendedCorporateTaxRange[1]}%)`
    );
  } else if (corporateTaxRate > config.recommendedCorporateTaxRange[1]) {
    currentAlignment = "overtaxed";
    recommendations.push(
      `High corporate tax rate (${corporateTaxRate}%) may discourage business investment. Consider reducing to ${config.recommendedCorporateTaxRange[0]}-${config.recommendedCorporateTaxRange[1]}% range`
    );
  }

  if (salesTaxRate > config.recommendedSalesTaxRange[1]) {
    recommendations.push(
      `Sales tax rate of ${salesTaxRate}% is high. Consider reducing to ${config.recommendedSalesTaxRange[0]}-${config.recommendedSalesTaxRange[1]}% to stimulate consumer spending`
    );
  }

  const avgTaxBurden = taxBurdenAnalysis.reduce(
    (sum, item) => sum + (item.effectiveTaxRate * item.populationPercent) / 100,
    0
  );

  if (avgTaxBurden > config.maxTaxBurden) {
    currentAlignment = "overtaxed";
    recommendations.push(
      `Average tax burden (${avgTaxBurden.toFixed(1)}%) exceeds recommended maximum (${config.maxTaxBurden}%) for ${economicTier} economies`
    );
  }

  const lowIncomeBurden = taxBurdenAnalysis.find((t) => t.incomeClass === "Low Income");
  const highIncomeBurden = taxBurdenAnalysis.find((t) => t.incomeClass === "High Income");

  if (lowIncomeBurden && highIncomeBurden) {
    if (lowIncomeBurden.effectiveTaxRate >= highIncomeBurden.effectiveTaxRate) {
      recommendations.push(
        "WARNING: Tax system appears regressive. High earners should have higher effective tax rates than low earners"
      );
    } else if (highIncomeBurden.effectiveTaxRate - lowIncomeBurden.effectiveTaxRate < 10) {
      recommendations.push(
        "Consider making tax system more progressive by increasing rates for higher income brackets"
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Tax system is well-aligned with economic tier. Continue monitoring economic indicators."
    );
  }

  return {
    ...config,
    currentAlignment,
    recommendations,
  };
}

export function calculateEconomicImpact(
  taxSystem?: TaxSystem,
  economicData?: { core?: CoreEconomicIndicatorsData },
  taxBurdenAnalysis: TaxBurdenAnalysis[] = [],
  tierRecommendation?: EconomicTierRecommendation
): EconomicImpact {
  if (!taxSystem?.taxCategories || !economicData?.core || !tierRecommendation) {
    return {
      gdpGrowthImpact: 0,
      giniCoefficientChange: 0,
      businessInvestmentImpact: "neutral",
      consumerSpendingImpact: "neutral",
      employmentImpact: "neutral",
      overallScore: 50,
    };
  }

  const avgTaxBurden = taxBurdenAnalysis.reduce(
    (sum, item) => sum + (item.effectiveTaxRate * item.populationPercent) / 100,
    0
  );

  const corporateTax = taxSystem.taxCategories.find((cat) =>
    cat.categoryName.toLowerCase().includes("corporate")
  );
  const corporateTaxRate = corporateTax?.baseRate || 0;

  const salesTax = taxSystem.taxCategories.find(
    (cat) =>
      cat.categoryName.toLowerCase().includes("sales") ||
      cat.categoryName.toLowerCase().includes("vat")
  );
  const salesTaxRate = salesTax?.baseRate || 0;

  const optimalTaxBurden = tierRecommendation.maxTaxBurden * 0.8;
  const taxBurdenDiff = avgTaxBurden - optimalTaxBurden;
  const gdpGrowthImpact = -taxBurdenDiff * 0.15;

  const progressivity =
    taxBurdenAnalysis.length >= 2
      ? taxBurdenAnalysis[taxBurdenAnalysis.length - 1].effectiveTaxRate -
        taxBurdenAnalysis[0].effectiveTaxRate
      : 0;
  const giniCoefficientChange = -progressivity * 0.05;

  let businessInvestmentImpact: EconomicImpact["businessInvestmentImpact"] = "neutral";
  if (corporateTaxRate < tierRecommendation.recommendedCorporateTaxRange[0]) {
    businessInvestmentImpact = "positive";
  } else if (corporateTaxRate > tierRecommendation.recommendedCorporateTaxRange[1]) {
    businessInvestmentImpact = "negative";
  }

  let consumerSpendingImpact: EconomicImpact["consumerSpendingImpact"] = "neutral";
  if (
    salesTaxRate > tierRecommendation.recommendedSalesTaxRange[1] ||
    avgTaxBurden > tierRecommendation.maxTaxBurden
  ) {
    consumerSpendingImpact = "negative";
  } else if (
    salesTaxRate < tierRecommendation.recommendedSalesTaxRange[0] &&
    avgTaxBurden < optimalTaxBurden
  ) {
    consumerSpendingImpact = "positive";
  }

  let employmentImpact: EconomicImpact["employmentImpact"] = "neutral";
  if (corporateTaxRate > tierRecommendation.recommendedCorporateTaxRange[1] + 5) {
    employmentImpact = "negative";
  } else if (corporateTaxRate < tierRecommendation.recommendedCorporateTaxRange[0]) {
    employmentImpact = "positive";
  }

  let overallScore = 50;
  if (tierRecommendation.currentAlignment === "aligned") overallScore += 25;
  else if (tierRecommendation.currentAlignment === "overtaxed") overallScore -= 15;
  else overallScore -= 10;

  if (businessInvestmentImpact === "positive") overallScore += 10;
  else if (businessInvestmentImpact === "negative") overallScore -= 10;

  if (consumerSpendingImpact === "positive") overallScore += 10;
  else if (consumerSpendingImpact === "negative") overallScore -= 10;

  if (progressivity > 15) overallScore += 5;

  return {
    gdpGrowthImpact,
    giniCoefficientChange,
    businessInvestmentImpact,
    consumerSpendingImpact,
    employmentImpact,
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };
}
