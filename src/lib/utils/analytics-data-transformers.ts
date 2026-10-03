// ===== TYPES =====

export interface EconomicChartDataPoint {
  date: string;
  gdp: number;
  gdpPerCapita: number;
  population: number;
  index: number;
  growth?: number;
}

export interface SectorPerformance {
  sector: string;
  performance: number;
  growth: number;
  color: string;
  contribution?: number;
  trend?: "up" | "down" | "stable";
}

export interface EconomicHealthIndicator {
  indicator: string;
  value: number;
  trend?: "up" | "down" | "stable";
}

export interface PolicyDistribution {
  name: string;
  value: number;
  color: string;
}

export interface ProjectionDataPoint {
  date: string;
  month: number;
  optimistic?: number;
  realistic?: number;
  pessimistic?: number;
}

export interface BudgetImpact {
  name: string;
  value: number;
  color: string;
  impact: number;
  cost: number;
}

export interface RelationshipDistribution {
  name: string;
  value: number;
  color: string;
}

export interface ComparativeBenchmark {
  metric: string;
  country: string;
  value: number;
  peer: number;
}

// ===== GDP CHART DATA =====
// ===== SECTOR PERFORMANCE =====
// ===== ECONOMIC HEALTH INDICATORS =====
// ===== POLICY DISTRIBUTION =====
// ===== GDP PROJECTIONS =====
// ===== DIPLOMATIC INFLUENCE =====
// ===== EMBASSY NETWORK GROWTH =====
// ===== BUDGET IMPACT =====
// ===== RELATIONSHIP DISTRIBUTION =====
// ===== SUMMARY METRICS =====

export interface SummaryMetric {
  title: string;
  value: number;
  trend: "up" | "down" | "stable";
  icon: any;
  color: string;
  bg: string;
}

// ===== VOLATILITY METRICS =====

export interface VolatilityMetric {
  label: string;
  value: number;
  status: "low" | "medium" | "high";
  metric?: string;
  volatility?: string;
  risk?: string;
  trend?: "up" | "down" | "stable";
}

// ===== COMPARATIVE BENCHMARKING =====
// ===== DIPLOMATIC NETWORK STATS =====
// ===== MISSION SUCCESS DATA =====
