export interface ValidationErrors {
  structure?: string[];
  departments?: Record<number, string[]>;
  budget?: string[];
  revenue?: Record<number, string[]>;
}

export interface BudgetSummary {
  totalAllocated: number;
  totalAllocatedPercent: number;
  remaining: number;
  remainingPercent: number;
  isOverBudget: boolean;
  isUnderBudget: boolean;
}
