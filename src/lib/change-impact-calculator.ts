/**
 * Change Impact Calculator
 *
 * Determines the impact level and delay time for country configuration changes
 */

export type ImpactLevel = "none" | "low" | "medium" | "high";
export type ChangeType = "instant" | "next_day" | "short_term" | "long_term";

export interface ChangeImpact {
  impactLevel: ImpactLevel;
  changeType: ChangeType;
  daysDelay: number;
  warnings: string[];
  reasons: string[];
}

export interface FieldImpactConfig {
  impactLevel: ImpactLevel;
  warnings?: string[];
  reasons?: string[];
}

/**
 * Field impact configuration
 * Maps field paths to their economic/social impact levels
 */
const FIELD_IMPACT_MAP: Record<string, FieldImpactConfig> = {
  // INSTANT CHANGES (cosmetic, no economic impact)
  "name": {
    impactLevel: "none",
    reasons: ["Country name is cosmetic only"],
  },
  "officialName": {
    impactLevel: "none",
    reasons: ["Official name is cosmetic only"],
  },
  "motto": {
    impactLevel: "none",
    reasons: ["National motto is cosmetic only"],
  },
  "nationalAnthem": {
    impactLevel: "none",
    reasons: ["National anthem is cosmetic only"],
  },
  "capitalCity": {
    impactLevel: "none",
    reasons: ["Capital city name is informational"],
  },
  "officialLanguages": {
    impactLevel: "none",
    reasons: ["Official languages are informational"],
  },
  "currencyName": {
    impactLevel: "none",
    reasons: ["Currency name is cosmetic only"],
  },
  "currencySymbol": {
    impactLevel: "none",
    reasons: ["Currency symbol is cosmetic only"],
  },
  "demonym": {
    impactLevel: "none",
    reasons: ["Demonym is cosmetic only"],
  },
  "governmentType": {
    impactLevel: "none",
    reasons: ["Government type is part of national identity - cosmetic only"],
  },
  "flag": {
    impactLevel: "none",
    reasons: ["National symbols don't affect calculations"],
  },
  "coatOfArms": {
    impactLevel: "none",
    reasons: ["National symbols don't affect calculations"],
  },
  "religion": {
    impactLevel: "none",
    reasons: ["National religion is informational - cosmetic only"],
  },
  "leader": {
    impactLevel: "none",
    reasons: ["Leadership names are cosmetic"],
  },

  // LOW IMPACT (next day - minor adjustments)
  "localGrowthFactor": {
    impactLevel: "low",
    warnings: ["Minor adjustment to local growth multiplier"],
    reasons: ["Affects long-term growth projections"],
  },
  "currencyExchangeRate": {
    impactLevel: "low",
    warnings: ["Exchange rate changes affect international trade"],
    reasons: ["Impacts trade calculations and foreign investment"],
  },

  // MEDIUM IMPACT (3-5 days - significant policy changes)
  "taxRevenueGDPPercent": {
    impactLevel: "medium",
    warnings: [
      "Tax changes require legislative approval and implementation time",
      "May affect government revenue and public services",
      "Could impact economic growth and investment",
    ],
    reasons: [
      "Tax policy changes require bureaucratic implementation",
      "Economic actors need time to adjust",
    ],
  },
  "unemploymentRate": {
    impactLevel: "medium",
    warnings: [
      "Labor market changes don't happen overnight",
      "Affects household income and consumer spending",
      "May impact social welfare costs",
    ],
    reasons: [
      "Labor markets require time to adjust",
      "Job creation/loss is gradual",
    ],
  },
  "minimumWage": {
    impactLevel: "medium",
    warnings: [
      "Wage changes affect business costs and hiring",
      "May lead to short-term unemployment adjustments",
      "Impacts consumer purchasing power",
    ],
    reasons: [
      "Businesses need time to adjust payrolls",
      "Economic ripple effects take time",
    ],
  },
  "governmentBudgetGDPPercent": {
    impactLevel: "medium",
    warnings: [
      "Budget changes require fiscal year planning",
      "Affects government services and infrastructure",
      "May impact public sector employment",
    ],
    reasons: [
      "Budget reallocations take time to implement",
      "Government spending changes gradually",
    ],
  },

  // HIGH IMPACT (1 week - major structural changes)
  "realGDPGrowthRate": {
    impactLevel: "high",
    warnings: [
      "GDP growth rate changes reflect major economic shifts",
      "Affects all downstream economic calculations",
      "May trigger cascading effects on employment, investment, and trade",
      "Historical economic data will be impacted",
    ],
    reasons: [
      "GDP changes represent fundamental economic restructuring",
      "Markets and institutions need significant adjustment time",
      "Requires policy coordination across multiple sectors",
    ],
  },
  "inflationRate": {
    impactLevel: "high",
    warnings: [
      "Inflation changes affect all prices and wages",
      "Impacts purchasing power and savings",
      "Central bank policy adjustments required",
      "May destabilize financial markets short-term",
    ],
    reasons: [
      "Price-level changes propagate through entire economy",
      "Monetary policy changes require careful implementation",
    ],
  },
  "populationGrowthRate": {
    impactLevel: "high",
    warnings: [
      "Population changes affect labor force and demographics",
      "Impacts housing, education, and healthcare demand",
      "Long-term economic structure affected",
      "May strain or enhance infrastructure",
    ],
    reasons: [
      "Demographic shifts are gradual by nature",
      "Infrastructure and services need time to scale",
    ],
  },
  "economicTier": {
    impactLevel: "high",
    warnings: [
      "Economic tier changes represent fundamental development shifts",
      "Affects growth models, trade relationships, and investment",
      "Major restructuring of economic institutions required",
      "International perception and relations may change",
    ],
    reasons: [
      "Economic development tier changes are transformational",
      "Requires comprehensive policy and institutional reforms",
    ],
  },
  "totalDebtGDPRatio": {
    impactLevel: "high",
    warnings: [
      "Major debt changes affect credit ratings and borrowing costs",
      "Impacts government fiscal capacity",
      "May trigger austerity or stimulus measures",
      "International investor confidence affected",
    ],
    reasons: [
      "Debt restructuring requires international coordination",
      "Market confidence adjustments are gradual",
    ],
  },
};

/**
 * Calculate the impact of a field change
 */
export function calculateChangeImpact(
  fieldPath: string,
  oldValue: unknown,
  newValue: unknown
): ChangeImpact {
  // Get field impact configuration
  const config = FIELD_IMPACT_MAP[fieldPath] || {
    impactLevel: "low" as ImpactLevel,
    warnings: ["Unknown field - defaulting to low impact"],
    reasons: ["Field not in impact map"],
  };

  const impactLevel = config.impactLevel;
  const warnings = config.warnings || [];
  const reasons = config.reasons || [];

  // Calculate additional warnings based on value change magnitude
  const additionalWarnings = calculateMagnitudeWarnings(
    fieldPath,
    oldValue,
    newValue
  );

  // Determine change type and delay based on impact level
  let changeType: ChangeType;
  let daysDelay: number;

  switch (impactLevel) {
    case "none":
      changeType = "instant";
      daysDelay = 0;
      break;
    case "low":
      changeType = "next_day";
      daysDelay = 1;
      break;
    case "medium":
      changeType = "short_term";
      daysDelay = 3 + Math.floor(Math.random() * 3); // 3-5 days
      break;
    case "high":
      changeType = "long_term";
      daysDelay = 7; // 1 week
      break;
  }

  return {
    impactLevel,
    changeType,
    daysDelay,
    warnings: [...warnings, ...additionalWarnings],
    reasons,
  };
}

/**
 * Calculate warnings based on the magnitude of change
 */
function calculateMagnitudeWarnings(
  fieldPath: string,
  oldValue: unknown,
  newValue: unknown
): string[] {
  const warnings: string[] = [];

  // For numeric fields, check percentage change
  if (typeof oldValue === "number" && typeof newValue === "number") {
    const percentChange = Math.abs(((newValue - oldValue) / oldValue) * 100);

    if (percentChange > 50) {
      warnings.push(
        `⚠️ LARGE CHANGE: ${percentChange.toFixed(1)}% change from current value`
      );
    } else if (percentChange > 25) {
      warnings.push(
        `⚠️ MODERATE CHANGE: ${percentChange.toFixed(1)}% change from current value`
      );
    }

    // Specific warnings for certain fields
    if (fieldPath === "realGDPGrowthRate") {
      if (newValue < 0 && oldValue >= 0) {
        warnings.push("⚠️ RECESSION: Economy will enter recession (negative growth)");
      } else if (newValue >= 0 && oldValue < 0) {
        warnings.push("✅ RECOVERY: Economy will exit recession");
      }

      if (newValue > 10) {
        warnings.push("⚠️ UNSUSTAINABLE: Growth rate above 10% may be unstable");
      }
    }

    if (fieldPath === "inflationRate") {
      if (newValue > 10) {
        warnings.push("⚠️ HIGH INFLATION: Inflation above 10% may destabilize economy");
      } else if (newValue < 0) {
        warnings.push("⚠️ DEFLATION: Negative inflation can reduce spending");
      }
    }

    if (fieldPath === "unemploymentRate") {
      if (newValue > 15) {
        warnings.push("⚠️ CRISIS: Unemployment above 15% indicates severe economic distress");
      } else if (newValue < 3) {
        warnings.push("⚠️ OVERHEATING: Very low unemployment may cause wage inflation");
      }
    }

    if (fieldPath === "totalDebtGDPRatio") {
      if (newValue > 100) {
        warnings.push("⚠️ HIGH DEBT: Debt-to-GDP above 100% may affect credit rating");
      } else if (newValue > 60) {
        warnings.push("⚠️ ELEVATED DEBT: Approaching concerning debt levels");
      }
    }
  }

  return warnings;
}

/**
 * Get a human-readable description of the change delay
 */
export function getDelayDescription(changeType: ChangeType): string {
  switch (changeType) {
    case "instant":
      return "Takes effect immediately";
    case "next_day":
      return "Takes effect next IxDay";
    case "short_term":
      return "Takes effect in 3-5 IxDays";
    case "long_term":
      return "Takes effect in 1 IxWeek (7 IxDays)";
  }
}

/**
 * Get color coding for impact levels
 */
export function getImpactColor(impactLevel: ImpactLevel): string {
  switch (impactLevel) {
    case "none":
      return "text-gray-600 dark:text-gray-400";
    case "low":
      return "text-blue-600 dark:text-blue-400";
    case "medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "high":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get background color for impact levels
 */
export function getImpactBgColor(impactLevel: ImpactLevel): string {
  switch (impactLevel) {
    case "none":
      return "bg-gray-100 dark:bg-gray-800";
    case "low":
      return "bg-blue-100 dark:bg-blue-900/30";
    case "medium":
      return "bg-yellow-100 dark:bg-yellow-900/30";
    case "high":
      return "bg-red-100 dark:bg-red-900/30";
  }
}

/**
 * Calculate scheduled date based on change type and current IxTime
 */
export function calculateScheduledDate(
  changeType: ChangeType,
  currentDate: Date = new Date()
): Date {
  const scheduledDate = new Date(currentDate);

  switch (changeType) {
    case "instant":
      return scheduledDate; // Immediate
    case "next_day":
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      break;
    case "short_term":
      scheduledDate.setDate(scheduledDate.getDate() + 3 + Math.floor(Math.random() * 3));
      break;
    case "long_term":
      scheduledDate.setDate(scheduledDate.getDate() + 7);
      break;
  }

  return scheduledDate;
}
