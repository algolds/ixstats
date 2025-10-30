// Intelligence Center Type Definitions

import type { CriticalAlert, ActionableRecommendation } from "../../types/intelligence";

export interface FocusMetric {
  label: string;
  value: string | number;
  trend: "up" | "down" | "stable";
  change: string;
  target?: number;
  format: "number" | "percentage" | "currency" | "text";
}

export interface FocusAction {
  id: string;
  label: string;
  type: "policy" | "budget" | "diplomatic" | "emergency";
  enabled: boolean;
  requiresConfirmation: boolean;
  urgency: "low" | "medium" | "high" | "critical";
  estimatedImpact: {
    economic?: string;
    social?: string;
    diplomatic?: string;
    timeframe: string;
  };
}

export interface FocusCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  healthScore: number;
  status: "excellent" | "good" | "concerning" | "critical";
  priority: "high" | "medium" | "low";
  metrics: FocusMetric[];
  quickActions: FocusAction[];
  alerts: CriticalAlert[];
  trends: {
    shortTerm: "improving" | "declining" | "stable";
    longTerm: "improving" | "declining" | "stable";
  };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
}

export interface IntelligenceBriefing {
  id: string;
  title: string;
  description: string;
  type: "hot_issue" | "opportunity" | "risk_mitigation" | "strategic_initiative";
  priority: "critical" | "high" | "medium" | "low";
  area: "economic" | "population" | "diplomatic" | "governance";
  confidence: number;
  urgency: "immediate" | "this_week" | "this_month" | "this_quarter";
  impact: {
    magnitude: "low" | "medium" | "high" | "critical";
    scope: string[];
    timeframe: string;
  };
  evidence: {
    metrics: string[];
    trends: string[];
    comparisons: string[];
  };
  recommendations: ActionableRecommendation[];
  alerts: CriticalAlert[];
  createdAt: number;
  lastUpdated: number;
  tags: string[];
}

export interface IntelligenceCenterContentProps {
  userId: string;
  countryId: string;
}
