// src/types/government.ts

export interface GovernmentStructure {
  id: string;
  countryId: string;
  governmentName: string;
  governmentType: string;
  headOfState?: string;
  headOfGovernment?: string;
  legislatureName?: string;
  executiveName?: string;
  judicialName?: string;
  totalBudget: number;
  fiscalYear: string;
  budgetCurrency: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  departments: GovernmentDepartment[];
  budgetAllocations: BudgetAllocation[];
  revenueSources: RevenueSource[];
}

export interface GovernmentDepartment {
  id: string;
  governmentStructureId: string;
  name: string;
  shortName?: string;
  category: string;
  description?: string;
  minister?: string;
  ministerTitle: string;
  headquarters?: string;
  established?: string;
  employeeCount?: number;
  icon?: string;
  color: string;
  priority: number;
  isActive: boolean;
  parentDepartmentId?: string;
  organizationalLevel: string;
  functions?: string[]; // JSON array parsed as string[]
  kpis?: KeyPerformanceIndicator[]; // JSON array parsed as KPI[]
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  parentDepartment?: GovernmentDepartment;
  subDepartments: GovernmentDepartment[];
  budgetAllocations: BudgetAllocation[];
  subBudgets: SubBudgetCategory[];
}

export interface BudgetAllocation {
  id: string;
  governmentStructureId: string;
  departmentId: string;
  budgetYear: number;
  allocatedAmount: number;
  allocatedPercent: number;
  spentAmount: number;
  encumberedAmount: number;
  availableAmount: number;
  budgetStatus: BudgetStatus;
  lastReviewed: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  department: GovernmentDepartment;
}

export interface SubBudgetCategory {
  id: string;
  departmentId: string;
  name: string;
  description?: string;
  amount: number;
  percent: number;
  budgetType: BudgetType;
  isRecurring: boolean;
  priority: BudgetPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueSource {
  id: string;
  governmentStructureId: string;
  name: string;
  category: RevenueCategory;
  description?: string;
  rate?: number;
  revenueAmount: number;
  revenuePercent: number;
  isActive: boolean;
  collectionMethod?: string;
  administeredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyPerformanceIndicator {
  id: string;
  name: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually';
  trend: 'Up' | 'Down' | 'Stable';
  category: 'Performance' | 'Efficiency' | 'Quality' | 'Financial' | 'Citizen Satisfaction';
}

// Enums and Union Types
export type BudgetStatus = 'Allocated' | 'In Use' | 'Overspent' | 'Underutilized' | 'Completed';

export type BudgetType = 'Personnel' | 'Operations' | 'Capital' | 'Research' | 'Other';

export type BudgetPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type RevenueCategory = 'Direct Tax' | 'Indirect Tax' | 'Non-Tax Revenue' | 'Fees and Fines' | 'Other';

export type OrganizationalLevel = 'Ministry' | 'Department' | 'Agency' | 'Bureau' | 'Office' | 'Commission';

export type GovernmentType = 
  | 'Constitutional Monarchy'
  | 'Federal Republic' 
  | 'Parliamentary Democracy'
  | 'Presidential Republic'
  | 'Federal Constitutional Republic'
  | 'Unitary State'
  | 'Federation'
  | 'Confederation'
  | 'Empire'
  | 'City-State'
  | 'Other';

export type DepartmentCategory = 
  | 'Defense'
  | 'Education' 
  | 'Health'
  | 'Finance'
  | 'Foreign Affairs'
  | 'Interior'
  | 'Justice'
  | 'Transportation'
  | 'Agriculture'
  | 'Environment'
  | 'Labor'
  | 'Commerce'
  | 'Energy'
  | 'Communications'
  | 'Culture'
  | 'Science and Technology'
  | 'Social Services'
  | 'Housing'
  | 'Veterans Affairs'
  | 'Intelligence'
  | 'Emergency Management'
  | 'Other';

// Atomic Component Types
export enum ComponentType {
  // Power Distribution
  CENTRALIZED_POWER = 'CENTRALIZED_POWER',
  FEDERAL_SYSTEM = 'FEDERAL_SYSTEM',
  CONFEDERATE_SYSTEM = 'CONFEDERATE_SYSTEM',
  UNITARY_SYSTEM = 'UNITARY_SYSTEM',
  // Decision Process
  DEMOCRATIC_PROCESS = 'DEMOCRATIC_PROCESS',
  AUTOCRATIC_PROCESS = 'AUTOCRATIC_PROCESS',
  TECHNOCRATIC_PROCESS = 'TECHNOCRATIC_PROCESS',
  CONSENSUS_PROCESS = 'CONSENSUS_PROCESS',
  OLIGARCHIC_PROCESS = 'OLIGARCHIC_PROCESS',
  // Legitimacy Sources
  ELECTORAL_LEGITIMACY = 'ELECTORAL_LEGITIMACY',
  TRADITIONAL_LEGITIMACY = 'TRADITIONAL_LEGITIMACY',
  PERFORMANCE_LEGITIMACY = 'PERFORMANCE_LEGITIMACY',
  CHARISMATIC_LEGITIMACY = 'CHARISMATIC_LEGITIMACY',
  RELIGIOUS_LEGITIMACY = 'RELIGIOUS_LEGITIMACY',
  INSTITUTIONAL_LEGITIMACY = 'INSTITUTIONAL_LEGITIMACY',
  // Institution Types
  PROFESSIONAL_BUREAUCRACY = 'PROFESSIONAL_BUREAUCRACY',
  MILITARY_ADMINISTRATION = 'MILITARY_ADMINISTRATION',
  INDEPENDENT_JUDICIARY = 'INDEPENDENT_JUDICIARY',
  PARTISAN_INSTITUTIONS = 'PARTISAN_INSTITUTIONS',
  TECHNOCRATIC_AGENCIES = 'TECHNOCRATIC_AGENCIES',
  // Control Mechanisms
  RULE_OF_LAW = 'RULE_OF_LAW',
  SURVEILLANCE_SYSTEM = 'SURVEILLANCE_SYSTEM',
  ECONOMIC_INCENTIVES = 'ECONOMIC_INCENTIVES',
  SOCIAL_PRESSURE = 'SOCIAL_PRESSURE',
  MILITARY_ENFORCEMENT = 'MILITARY_ENFORCEMENT'
}

export const COMPONENT_TYPE_VALUES = Object.values(ComponentType);

// Input/Form Types
export interface GovernmentStructureInput {
  governmentName: string;
  governmentType: GovernmentType;
  headOfState?: string;
  headOfGovernment?: string;
  legislatureName?: string;
  executiveName?: string;
  judicialName?: string;
  totalBudget: number;
  fiscalYear: string;
  budgetCurrency: string;
}

export interface DepartmentInput {
  name: string;
  shortName?: string;
  category: DepartmentCategory;
  description?: string;
  minister?: string;
  ministerTitle: string;
  headquarters?: string;
  established?: string;
  employeeCount?: number;
  icon?: string;
  color: string;
  priority: number;
  parentDepartmentId?: string;
  organizationalLevel: OrganizationalLevel;
  functions?: string[];
  kpis?: KeyPerformanceIndicator[];
}

export interface BudgetAllocationInput {
  departmentId: string;
  budgetYear: number;
  allocatedAmount: number;
  allocatedPercent: number;
  notes?: string;
}

export interface SubBudgetInput {
  name: string;
  description?: string;
  amount: number;
  percent: number;
  budgetType: BudgetType;
  isRecurring: boolean;
  priority: BudgetPriority;
}

export interface RevenueSourceInput {
  name: string;
  category: RevenueCategory;
  description?: string;
  rate?: number;
  revenueAmount: number;
  revenuePercent?: number;
  collectionMethod?: string;
  administeredBy?: string;
}

// Computed Types
export interface BudgetSummary {
  totalBudget: number;
  totalAllocated: number;
  totalSpent: number;
  totalAvailable: number;
  utilizationRate: number;
  departmentCount: number;
  topSpendingDepartments: {
    department: GovernmentDepartment;
    allocation: BudgetAllocation;
  }[];
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTaxRevenue: number;
  totalNonTaxRevenue: number;
  revenueBreakdown: {
    category: RevenueCategory;
    amount: number;
    percent: number;
  }[];
  topRevenueSources: RevenueSource[];
}

export interface DepartmentHierarchy {
  department: GovernmentDepartment;
  children: DepartmentHierarchy[];
  totalBudget: number;
  totalEmployees: number;
}

// Utility Types for Builder/Editor
export interface GovernmentBuilderState {
  structure: GovernmentStructureInput;
  departments: DepartmentInput[];
  budgetAllocations: BudgetAllocationInput[];
  revenueSources: RevenueSourceInput[];
  isValid: boolean;
  errors: {
    structure?: string[];
    departments?: { [key: number]: string[] };
    budget?: string[];
    revenue?: string[];
  };
}

export interface DepartmentTemplate {
  name: string;
  shortName?: string;
  category: DepartmentCategory;
  description: string;
  ministerTitle: string;
  organizationalLevel: OrganizationalLevel;
  icon: string;
  color: string;
  priority: number;
  functions: string[];
  typicalBudgetPercent: number;
  subBudgets: Omit<SubBudgetInput, 'amount'>[];
  kpis: Omit<KeyPerformanceIndicator, 'id' | 'currentValue'>[];
}

export interface GovernmentTemplate {
  name: string;
  governmentType: GovernmentType;
  description: string;
  departments: DepartmentTemplate[];
  fiscalYear: string;
  typicalRevenueSources: Omit<RevenueSourceInput, 'revenueAmount'>[];
}