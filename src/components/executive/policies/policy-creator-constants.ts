export const METRIC_OPTIONS = [
  { value: "gdpGrowth", label: "GDP Growth", unit: "%", lowerIsBetter: false },
  { value: "unemploymentRate", label: "Unemployment Rate", unit: "%", lowerIsBetter: true },
  { value: "stability", label: "Stability", unit: "%", lowerIsBetter: false },
  { value: "taxRevenue", label: "Tax Revenue", unit: "%", lowerIsBetter: false },
  { value: "population", label: "Population", unit: "", lowerIsBetter: false },
  { value: "inflation", label: "Inflation", unit: "%", lowerIsBetter: true },
] as const;

export const CATEGORY_BASE_COSTS: Record<string, { impl: number; maint: number }> = {
  infrastructure: { impl: 5000000, maint: 1000000 },
  fiscal: { impl: 2500000, maint: 500000 },
  technology: { impl: 1500000, maint: 300000 },
  healthcare: { impl: 1000000, maint: 200000 },
  education: { impl: 1000000, maint: 200000 },
  default: { impl: 500000, maint: 100000 },
};

export const PRIORITY_MULTIPLIERS = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  critical: 2.0,
};

export const POLICY_TYPES = [
  { value: "economic", label: "Economic" },
  { value: "social", label: "Social" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "governance", label: "Governance" },
] as const;

export const POLICY_CATEGORIES = [
  "fiscal",
  "trade",
  "labor",
  "education",
  "healthcare",
  "environment",
  "defense",
  "housing",
  "technology",
  "agriculture",
] as const;

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export function formatPolicyCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

export function getMatchingDepartmentCategory(policyCategory: string): string {
  const mapping: Record<string, string> = {
    fiscal: "finance",
    monetary: "finance",
    trade: "commerce",
    defense: "defense",
    education: "education",
    healthcare: "health",
    infrastructure: "interior",
    environment: "interior",
    governance: "interior",
    security: "interior",
    social: "interior",
    foreign: "foreign",
    diplomatic: "foreign",
  };
  return mapping[policyCategory.toLowerCase()] || "interior";
}
