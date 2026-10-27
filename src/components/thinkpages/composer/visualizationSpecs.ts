export type VisualizationType =
  | "economic_chart"
  | "diplomatic_map"
  | "trade_flow"
  | "gdp_growth"
  | "demographics"
  | "budget_debt"
  | "labor_market"
  | "national_vitality";

export interface DataVisualization {
  id: string;
  type: VisualizationType;
  title: string;
  data: any;
  config: any;
}

/** The live country queries a visualization is built from. */
export interface VisualizationSources {
  economicData: any;
  gdpHistoryData: any[] | undefined;
  diplomaticData: any[] | undefined;
  tradeData: any;
  vitalityData: any;
}

export function describeAvailability({
  economicData,
  gdpHistoryData,
  diplomaticData,
  tradeData,
  vitalityData,
}: VisualizationSources) {
  return {
    hasEconomicData: !!economicData,
    hasHistoricalData:
      !!gdpHistoryData && (gdpHistoryData.length > 0 || !!economicData?.historical?.length),
    hasDiplomaticData: !!diplomaticData && diplomaticData.length > 0,
    hasTradeData: !!tradeData,
    hasVitalityData: !!vitalityData,
  };
}

type Availability = ReturnType<typeof describeAvailability>;

const pick = (source: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, source[k]]));

interface VisualizationSpec {
  idPrefix: string;
  title: string;
  /** Shown when the backing data is missing. */
  missing: string;
  available: keyof Availability;
  data: (s: VisualizationSources) => any;
  config: any;
}

export const VISUALIZATION_SPECS: Record<VisualizationType, VisualizationSpec> = {
  economic_chart: {
    idPrefix: "econ",
    title: "GDP Growth Trajectory",
    missing: "No historical GDP data available for this country",
    available: "hasHistoricalData",
    data: ({ gdpHistoryData, economicData }) =>
      gdpHistoryData && gdpHistoryData.length > 0
        ? gdpHistoryData
        : economicData?.historical?.map((h: any) => ({
            ixTimeTimestamp: new Date(h.year, 0, 1),
            totalGdp: h.gdp,
            population: h.population,
          })) || [],
    config: { chartType: "line", colors: ["#3B82F6", "#10B981"], showGrid: true, timeRange: "6M" },
  },
  diplomatic_map: {
    idPrefix: "diplo",
    title: "Diplomatic relations map",
    missing: "No diplomatic relationships data available",
    available: "hasDiplomaticData",
    data: (s) => s.diplomaticData,
    config: { mapType: "world", showRelationStrength: true, colorScheme: "diplomatic" },
  },
  trade_flow: {
    idPrefix: "trade",
    title: "Trade flow analysis",
    missing: "No trade data available for this country",
    available: "hasTradeData",
    data: (s) => s.tradeData,
    config: { flowType: "sankey", showVolumes: true, timeframe: "current_quarter" },
  },
  gdp_growth: {
    idPrefix: "gdp",
    title: "Economic performance overview",
    missing: "No economic data available for this country",
    available: "hasEconomicData",
    data: (s) => s.economicData,
    config: {
      metrics: ["gdp", "inflation", "unemployment"],
      displayType: "dashboard",
      comparison: "regional_average",
    },
  },
  demographics: {
    idPrefix: "demo",
    title: "Demographics profile",
    missing: "No demographics data available for this country",
    available: "hasEconomicData",
    data: ({ economicData }) => ({
      ...pick(economicData, [
        "lifeExpectancy",
        "literacyRate",
        "urbanPopulationPercent",
        "ruralPopulationPercent",
      ]),
      population: economicData.currentPopulation || economicData.population,
    }),
    config: { displayType: "stats_grid", colorScheme: "green" },
  },
  budget_debt: {
    idPrefix: "fiscal",
    title: "Fiscal & debt analysis",
    missing: "No fiscal budget/debt data available for this country",
    available: "hasEconomicData",
    data: ({ economicData }) =>
      pick(economicData, [
        "taxRevenueGDPPercent",
        "governmentBudgetGDPPercent",
        "totalGovernmentSpending",
        "totalDebtGDPRatio",
        "budgetDeficitSurplus",
      ]),
    config: { displayType: "donut", colorScheme: "amber" },
  },
  labor_market: {
    idPrefix: "labor",
    title: "Labor & income profile",
    missing: "No labor market data available for this country",
    available: "hasEconomicData",
    data: ({ economicData }) =>
      pick(economicData, [
        "unemploymentRate",
        "incomeInequalityGini",
        "averageAnnualIncome",
        "minimumWage",
      ]),
    config: {
      metrics: ["unemployment", "gini", "income"],
      displayType: "stats_grid",
      colorScheme: "teal",
    },
  },
  national_vitality: {
    idPrefix: "vitality",
    title: "National vitality assessment",
    missing: "No activity/vitality data available for this country",
    available: "hasVitalityData",
    data: (s) => s.vitalityData,
    config: {
      metrics: ["economic", "population", "diplomatic", "government"],
      displayType: "progress_bars",
      colorScheme: "red",
    },
  },
};

export function buildVisualization(
  type: VisualizationType,
  sources: VisualizationSources
): DataVisualization {
  const { idPrefix, title, data, config } = VISUALIZATION_SPECS[type];
  return { id: `${idPrefix}-${Date.now()}`, type, title, data: data(sources), config };
}
