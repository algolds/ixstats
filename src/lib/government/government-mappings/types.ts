import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";

export interface AtomicGovernmentMapping {
  component: ComponentType;
  departments: Array<{
    name: string;
    category: string;
    functions: string[];
    priority: number;
    budgetPercent: number;
    effectiveness: number;
    description: string;
  }>;
  budgetAllocations: Array<{
    departmentId: string;
    allocatedAmount: number;
    allocatedPercent: number;
    rationale: string;
  }>;
  policies: Array<{
    name: string;
    description: string;
    impact: Record<string, number>;
    enabled: boolean;
  }>;
}

export interface AtomicIntegrationFeedback {
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  actionable: boolean;
  actionLabel?: string;
  actionUrl?: string;
  suggestedComponents?: ComponentType[];
  impact: "low" | "medium" | "high" | "critical";
}
