/**
 * Tax Data Parser
 * Intelligently parses data from Core Indicators and Government Builder to pre-populate Tax Builder
 */

import type {
  TaxSystemInput,
  TaxCategoryInput,
  TaxBracketInput,
  TaxExemptionInput,
  TaxDeductionInput,
} from "~/types/tax-system";
import type {
  GovernmentBuilderState,
  DepartmentInput,
  RevenueSourceInput,
} from "~/types/government";
import type { CoreEconomicIndicators } from "~/app/builder/lib/economy-data-service";
import { CALCULATION_METHODS } from "~/types/tax-system";

export interface ParsedTaxData {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>;
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>;
}

interface TaxParsingOptions {
  useAggressiveParsing?: boolean;
  includeGovernmentPolicies?: boolean;
  autoGenerateBrackets?: boolean;
  targetRevenueMatch?: boolean;
}

/**
 * Main parsing function - combines core indicators and government data
 */
export function parseEconomicDataForTaxSystem(
  coreIndicators: CoreEconomicIndicators,
  governmentData?: GovernmentBuilderState,
  options: TaxParsingOptions = {}
): ParsedTaxData {
  const {
    useAggressiveParsing = true,
    includeGovernmentPolicies = true,
    autoGenerateBrackets = true,
    targetRevenueMatch = true,
  } = options;

  // Parse core tax system structure
  const taxSystem = parseTaxSystemFromCoreIndicators(coreIndicators);

  // Parse tax categories from multiple sources
  const categories: TaxCategoryInput[] = [];
  const brackets: Record<string, TaxBracketInput[]> = {};
  const exemptions: TaxExemptionInput[] = [];
  const deductions: Record<string, TaxDeductionInput[]> = {};

  // 1. Parse income tax from GDP per capita
  const incomeTaxData = parseIncomeTaxFromGDP(coreIndicators, autoGenerateBrackets);
  if (incomeTaxData) {
    const categoryIndex = categories.length;
    categories.push(incomeTaxData.category);
    if (incomeTaxData.brackets) {
      brackets[categoryIndex.toString()] = incomeTaxData.brackets;
    }
    if (incomeTaxData.deductions) {
      deductions[categoryIndex.toString()] = incomeTaxData.deductions;
    }
  }

  // 2. Parse corporate tax from economic tier
  const corporateTaxData = parseCorporateTaxFromEconomy(coreIndicators, autoGenerateBrackets);
  if (corporateTaxData) {
    const categoryIndex = categories.length;
    categories.push(corporateTaxData.category);
    if (corporateTaxData.brackets) {
      brackets[categoryIndex.toString()] = corporateTaxData.brackets;
    }
  }

  // 3. Parse sales tax/VAT
  const salesTaxData = parseSalesTaxFromEconomy(coreIndicators);
  if (salesTaxData) {
    categories.push(salesTaxData.category);
  }

  // 4. Parse government-specific taxes if government data provided
  if (governmentData && useAggressiveParsing) {
    const govTaxData = parseTaxesFromGovernmentBuilder(
      governmentData,
      coreIndicators,
      includeGovernmentPolicies
    );

    // Add government-derived categories
    govTaxData.categories.forEach((cat, idx) => {
      const categoryIndex = categories.length;
      categories.push(cat);
      if (govTaxData.brackets[idx]) {
        brackets[categoryIndex.toString()] = govTaxData.brackets[idx];
      }
      if (govTaxData.deductions[idx]) {
        deductions[categoryIndex.toString()] = govTaxData.deductions[idx];
      }
    });

    // Add exemptions from government policies
    exemptions.push(...govTaxData.exemptions);
  }

  // 5. Add standard exemptions
  exemptions.push(...generateStandardExemptions(coreIndicators));

  return {
    taxSystem,
    categories,
    brackets,
    exemptions,
    deductions,
  };
}

/**
 * Parse basic tax system structure from core indicators
 */
function parseTaxSystemFromCoreIndicators(coreIndicators: CoreEconomicIndicators): TaxSystemInput {
  const gdpPerCapita = coreIndicators.gdpPerCapita;
  const economicTier = getEconomicTier(gdpPerCapita);

  // Estimate tax system parameters based on economic development
  const complianceRate = Math.min(95, Math.max(60, 60 + gdpPerCapita / 1000));
  const collectionEfficiency = Math.min(95, Math.max(70, 70 + gdpPerCapita / 1500));

  return {
    taxSystemName: `National Tax System`,
    fiscalYear: "calendar",
    progressiveTax: gdpPerCapita > 15000, // Advanced economies tend to have progressive taxation
    alternativeMinTax: gdpPerCapita > 30000, // AMT common in developed economies
    alternativeMinRate: gdpPerCapita > 30000 ? 20 : undefined,
    complianceRate,
    collectionEfficiency,
  };
}

/**
 * Parse income tax from GDP per capita with automatic bracket generation
 */
function parseIncomeTaxFromGDP(
  coreIndicators: CoreEconomicIndicators,
  generateBrackets: boolean
): {
  category: TaxCategoryInput;
  brackets?: TaxBracketInput[];
  deductions?: TaxDeductionInput[];
} | null {
  const gdpPerCapita = coreIndicators.gdpPerCapita;
  const economicTier = getEconomicTier(gdpPerCapita);

  // Base rate varies by economic tier
  const baseRates = {
    Advanced: 25,
    Developed: 20,
    Emerging: 15,
    Developing: 10,
  };

  const category: TaxCategoryInput = {
    categoryName: "Personal Income Tax",
    categoryType: "Direct Tax",
    description: "Progressive tax on individual income based on national economic tier",
    isActive: true,
    baseRate: baseRates[economicTier],
    calculationMethod:
      gdpPerCapita > 15000 ? CALCULATION_METHODS.PROGRESSIVE : CALCULATION_METHODS.PERCENTAGE,
    deductionAllowed: true,
    standardDeduction: Math.round(gdpPerCapita * 0.2), // 20% of GDP per capita as standard deduction
    priority: 90,
    color: "#3b82f6",
  };

  // Generate progressive brackets based on GDP per capita
  let brackets: TaxBracketInput[] | undefined;
  if (generateBrackets && gdpPerCapita > 15000) {
    brackets = generateIncomeTaxBrackets(gdpPerCapita, economicTier);
  }

  // Generate standard deductions
  const deductions: TaxDeductionInput[] = [
    {
      deductionName: "Standard Deduction",
      deductionType: "Standard",
      description: "Standard deduction for all taxpayers",
      maximumAmount: Math.round(gdpPerCapita * 0.2),
      isActive: true,
      priority: 100,
    },
    {
      deductionName: "Dependent Care",
      deductionType: "Itemized",
      description: "Deduction for dependent care expenses",
      maximumAmount: Math.round(gdpPerCapita * 0.1),
      percentage: 100,
      isActive: true,
      priority: 80,
    },
  ];

  return { category, brackets, deductions };
}

/**
 * Generate progressive income tax brackets based on GDP per capita
 */
function generateIncomeTaxBrackets(gdpPerCapita: number, tier: string): TaxBracketInput[] {
  const brackets: TaxBracketInput[] = [];

  // Bracket thresholds as multiples of GDP per capita
  const bracketStructures = {
    Advanced: [
      { min: 0, max: 0.3, rate: 0 },
      { min: 0.3, max: 0.8, rate: 10 },
      { min: 0.8, max: 1.5, rate: 22 },
      { min: 1.5, max: 3.0, rate: 32 },
      { min: 3.0, max: 6.0, rate: 37 },
      { min: 6.0, max: undefined, rate: 45 },
    ],
    Developed: [
      { min: 0, max: 0.4, rate: 0 },
      { min: 0.4, max: 1.0, rate: 8 },
      { min: 1.0, max: 2.0, rate: 18 },
      { min: 2.0, max: 4.0, rate: 28 },
      { min: 4.0, max: undefined, rate: 35 },
    ],
    Emerging: [
      { min: 0, max: 0.5, rate: 0 },
      { min: 0.5, max: 1.5, rate: 5 },
      { min: 1.5, max: 3.0, rate: 15 },
      { min: 3.0, max: undefined, rate: 25 },
    ],
    Developing: [
      { min: 0, max: 1.0, rate: 0 },
      { min: 1.0, max: 3.0, rate: 10 },
      { min: 3.0, max: undefined, rate: 20 },
    ],
  };

  const structure =
    bracketStructures[tier as keyof typeof bracketStructures] || bracketStructures["Emerging"];

  structure.forEach((bracket, index) => {
    brackets.push({
      bracketName: `Bracket ${index + 1}`,
      minIncome: Math.round(bracket.min * gdpPerCapita),
      maxIncome: bracket.max !== undefined ? Math.round(bracket.max * gdpPerCapita) : undefined,
      rate: bracket.rate,
      marginalRate: true,
      isActive: true,
      priority: 100 - index * 10,
    });
  });

  return brackets;
}

/**
 * Parse corporate tax from economic tier
 */
function parseCorporateTaxFromEconomy(
  coreIndicators: CoreEconomicIndicators,
  generateBrackets: boolean
): { category: TaxCategoryInput; brackets?: TaxBracketInput[] } | null {
  const gdpPerCapita = coreIndicators.gdpPerCapita;
  const economicTier = getEconomicTier(gdpPerCapita);

  // Corporate rates typically lower than peak individual rates
  const baseRates = {
    Advanced: 22,
    Developed: 20,
    Emerging: 18,
    Developing: 15,
  };

  const category: TaxCategoryInput = {
    categoryName: "Corporate Income Tax",
    categoryType: "Direct Tax",
    description: "Tax on corporate profits with size-based tiers",
    isActive: true,
    baseRate: baseRates[economicTier],
    calculationMethod: generateBrackets
      ? CALCULATION_METHODS.TIERED
      : CALCULATION_METHODS.PERCENTAGE,
    deductionAllowed: true,
    priority: 85,
    color: "#10b981",
  };

  // Generate tiered brackets for corporations
  let brackets: TaxBracketInput[] | undefined;
  if (generateBrackets) {
    const baseRate = baseRates[economicTier];
    brackets = [
      {
        bracketName: "Small Business",
        minIncome: 0,
        maxIncome: 100000,
        rate: Math.max(10, baseRate - 7),
        marginalRate: false,
        isActive: true,
        priority: 100,
      },
      {
        bracketName: "Medium Enterprise",
        minIncome: 100000,
        maxIncome: 1000000,
        rate: baseRate,
        marginalRate: false,
        isActive: true,
        priority: 90,
      },
      {
        bracketName: "Large Corporation",
        minIncome: 1000000,
        rate: Math.min(35, baseRate + 3),
        marginalRate: false,
        isActive: true,
        priority: 80,
      },
    ];
  }

  return { category, brackets };
}

/**
 * Parse sales tax/VAT from economy
 */
function parseSalesTaxFromEconomy(
  coreIndicators: CoreEconomicIndicators
): { category: TaxCategoryInput } | null {
  const gdpPerCapita = coreIndicators.gdpPerCapita;
  const economicTier = getEconomicTier(gdpPerCapita);

  // VAT rates typically higher in developed economies
  const vatRates = {
    Advanced: 20,
    Developed: 15,
    Emerging: 12,
    Developing: 8,
  };

  return {
    category: {
      categoryName: "Value Added Tax (VAT)",
      categoryType: "Indirect Tax",
      description: "Consumption tax on goods and services",
      isActive: true,
      baseRate: vatRates[economicTier],
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      deductionAllowed: false,
      priority: 80,
      color: "#f59e0b",
    },
  };
}

/**
 * Parse taxes from government builder data
 */
function parseTaxesFromGovernmentBuilder(
  governmentData: GovernmentBuilderState,
  coreIndicators: CoreEconomicIndicators,
  includePolicies: boolean
): {
  categories: TaxCategoryInput[];
  brackets: TaxBracketInput[][];
  deductions: TaxDeductionInput[][];
  exemptions: TaxExemptionInput[];
} {
  const categories: TaxCategoryInput[] = [];
  const brackets: TaxBracketInput[][] = [];
  const deductions: TaxDeductionInput[][] = [];
  const exemptions: TaxExemptionInput[] = [];

  const totalBudget = governmentData.structure.totalBudget;
  const nominalGDP = coreIndicators.nominalGDP;

  // Analyze revenue sources to suggest tax categories
  if (Array.isArray(governmentData.revenueSources)) {
    governmentData.revenueSources.forEach((source: RevenueSourceInput) => {
      const suggestedCategory = mapRevenueSourceToTaxCategory(source, totalBudget, nominalGDP);
      if (suggestedCategory) {
        categories.push(suggestedCategory);
        brackets.push([]);
        deductions.push([]);
      }
    });
  }

  // Analyze departments to suggest exemptions/deductions
  if (includePolicies && Array.isArray(governmentData.departments)) {
    governmentData.departments.forEach((dept: DepartmentInput) => {
      const deptExemptions = generateDepartmentExemptions(dept, coreIndicators);
      exemptions.push(...deptExemptions);
    });
  }

  return { categories, brackets, deductions, exemptions };
}

/**
 * Map revenue source to tax category
 */
function mapRevenueSourceToTaxCategory(
  source: RevenueSourceInput,
  totalBudget: number,
  nominalGDP: number
): TaxCategoryInput | null {
  // Defensive check: ensure name exists
  if (!source.name || typeof source.name !== "string") {
    return null;
  }

  const sourceName = source.name.toLowerCase();
  const revenuePercent = totalBudget > 0 ? (source.revenueAmount / totalBudget) * 100 : 0;
  const gdpPercent = nominalGDP > 0 ? (source.revenueAmount / nominalGDP) * 100 : 0;

  // Map common revenue sources to tax categories
  if (sourceName.includes("property") || sourceName.includes("real estate")) {
    return {
      categoryName: "Property Tax",
      categoryType: "Direct Tax",
      description: `Property tax generating ${revenuePercent.toFixed(1)}% of government revenue`,
      isActive: true,
      baseRate: Math.min(3, Math.max(0.5, gdpPercent)),
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      deductionAllowed: false,
      priority: 70,
      color: "#8b5cf6",
    };
  }

  if (sourceName.includes("payroll") || sourceName.includes("social security")) {
    return {
      categoryName: "Payroll Tax",
      categoryType: "Direct Tax",
      description: `Payroll tax for social programs generating ${revenuePercent.toFixed(1)}% of revenue`,
      isActive: true,
      baseRate: Math.min(15, Math.max(5, gdpPercent * 1.5)),
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      deductionAllowed: false,
      priority: 75,
      color: "#06b6d4",
    };
  }

  if (sourceName.includes("excise") || sourceName.includes("sin tax")) {
    return {
      categoryName: "Excise Taxes",
      categoryType: "Indirect Tax",
      description: `Excise taxes on specific goods generating ${revenuePercent.toFixed(1)}% of revenue`,
      isActive: true,
      baseRate: Math.min(50, Math.max(10, gdpPercent * 3)),
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      deductionAllowed: false,
      priority: 65,
      color: "#ef4444",
    };
  }

  return null;
}

/**
 * Generate exemptions based on department focus
 */
function generateDepartmentExemptions(
  dept: DepartmentInput,
  coreIndicators: CoreEconomicIndicators
): TaxExemptionInput[] {
  const exemptions: TaxExemptionInput[] = [];

  // Defensive check: ensure category exists
  if (!dept.category) {
    return exemptions;
  }

  const category = dept.category;

  if (category === "Science and Technology") {
    exemptions.push({
      exemptionName: "R&D Tax Credit",
      exemptionType: "Corporate",
      description: "Tax credit for research and development investments",
      exemptionRate: 20,
      isActive: true,
    });
  }

  if (category === "Education") {
    exemptions.push({
      exemptionName: "Education Expense Deduction",
      exemptionType: "Individual",
      description: "Deduction for qualified education expenses",
      exemptionAmount: Math.round(coreIndicators.gdpPerCapita * 0.1),
      isActive: true,
    });
  }

  if (category === "Environment") {
    exemptions.push({
      exemptionName: "Green Energy Tax Credit",
      exemptionType: "Corporate",
      description: "Credit for renewable energy investments",
      exemptionRate: 30,
      isActive: true,
    });
  }

  if (category === "Housing") {
    exemptions.push({
      exemptionName: "First-Time Homebuyer Credit",
      exemptionType: "Individual",
      description: "Tax credit for first-time home purchases",
      exemptionAmount: Math.round(coreIndicators.gdpPerCapita * 0.15),
      isActive: true,
    });
  }

  return exemptions;
}

/**
 * Generate standard exemptions based on economic tier
 */
function generateStandardExemptions(coreIndicators: CoreEconomicIndicators): TaxExemptionInput[] {
  const gdpPerCapita = coreIndicators.gdpPerCapita;

  return [
    {
      exemptionName: "Personal Exemption",
      exemptionType: "Individual",
      description: "Standard personal exemption for all taxpayers",
      exemptionAmount: Math.round(gdpPerCapita * 0.15),
      isActive: true,
    },
    {
      exemptionName: "Charitable Donations",
      exemptionType: "Individual",
      description: "Deduction for qualified charitable contributions",
      exemptionRate: 100,
      isActive: true,
    },
  ];
}

/**
 * Get economic tier from GDP per capita
 */
function getEconomicTier(
  gdpPerCapita: number
): "Advanced" | "Developed" | "Emerging" | "Developing" {
  if (gdpPerCapita >= 50000) return "Advanced";
  if (gdpPerCapita >= 25000) return "Developed";
  if (gdpPerCapita >= 10000) return "Emerging";
  return "Developing";
}

/**
 * Calculate recommended tax revenue target based on government spending
 */
export function calculateRecommendedTaxRevenue(
  governmentData: GovernmentBuilderState,
  coreIndicators: CoreEconomicIndicators
): {
  targetRevenue: number;
  revenueGDPPercent: number;
  surplusDeficit: number;
  recommendations: string[];
} {
  const totalBudget = governmentData.structure.totalBudget;
  const totalRevenue = governmentData.revenueSources.reduce(
    (sum: number, source: RevenueSourceInput) => sum + source.revenueAmount,
    0
  );
  const nominalGDP = coreIndicators.nominalGDP;

  const surplusDeficit = totalRevenue - totalBudget;
  const revenueGDPPercent = (totalRevenue / nominalGDP) * 100;

  const recommendations: string[] = [];

  if (surplusDeficit < 0) {
    const deficit = Math.abs(surplusDeficit);
    recommendations.push(`Increase tax revenue by ${formatCurrency(deficit)} to balance budget`);
    recommendations.push(
      `Current deficit: ${((deficit / totalBudget) * 100).toFixed(1)}% of budget`
    );
  }

  if (revenueGDPPercent < 15) {
    recommendations.push("Tax revenue is low relative to GDP - consider expanding tax base");
  } else if (revenueGDPPercent > 40) {
    recommendations.push("Tax burden is high - may impact economic growth");
  }

  return {
    targetRevenue: totalBudget,
    revenueGDPPercent,
    surplusDeficit,
    recommendations,
  };
}

/**
 * Helper: Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
