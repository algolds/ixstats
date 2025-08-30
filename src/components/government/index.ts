// Government Component Exports

// Atomic Components
export { GovernmentStructureForm } from './atoms/GovernmentStructureForm';
export { DepartmentForm } from './atoms/DepartmentForm';
export { BudgetAllocationForm } from './atoms/BudgetAllocationForm';
export { SubBudgetManager } from './atoms/SubBudgetManager';
export { RevenueSourceForm } from './atoms/RevenueSourceForm';

// Composite Components  
export { BudgetManagementDashboard } from './BudgetManagementDashboard';
export { GovernmentBuilder } from './GovernmentBuilder';

// Export types for convenience
export type {
  GovernmentStructure,
  GovernmentDepartment,
  BudgetAllocation,
  SubBudgetCategory,
  RevenueSource,
  GovernmentStructureInput,
  DepartmentInput,
  BudgetAllocationInput,
  SubBudgetInput,
  RevenueSourceInput,
  GovernmentBuilderState,
  DepartmentTemplate,
  GovernmentTemplate,
  BudgetSummary,
  RevenueSummary,
  DepartmentHierarchy
} from '~/types/government';