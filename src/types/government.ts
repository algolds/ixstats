// src/types/government.ts

import type { ComponentType } from '@prisma/client';

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

// Atomic Component Types - Use Prisma generated enum
export { ComponentType } from '@prisma/client';

// ComponentType values for Zod validation
export const COMPONENT_TYPE_VALUES = [
  // Power Distribution
  'CENTRALIZED_POWER',
  'FEDERAL_SYSTEM',
  'CONFEDERATE_SYSTEM',
  'UNITARY_SYSTEM',

  // Decision Process
  'DEMOCRATIC_PROCESS',
  'AUTOCRATIC_PROCESS',
  'TECHNOCRATIC_PROCESS',
  'CONSENSUS_PROCESS',
  'OLIGARCHIC_PROCESS',

  // Legitimacy Sources
  'ELECTORAL_LEGITIMACY',
  'TRADITIONAL_LEGITIMACY',
  'PERFORMANCE_LEGITIMACY',
  'CHARISMATIC_LEGITIMACY',
  'RELIGIOUS_LEGITIMACY',
  'INSTITUTIONAL_LEGITIMACY',

  // Institution Types
  'PROFESSIONAL_BUREAUCRACY',
  'MILITARY_ADMINISTRATION',
  'INDEPENDENT_JUDICIARY',
  'PARTISAN_INSTITUTIONS',
  'TECHNOCRATIC_AGENCIES',
  'DIGITAL_GOVERNMENT',

  // Control Mechanisms
  'RULE_OF_LAW',
  'SURVEILLANCE_SYSTEM',
  'ECONOMIC_INCENTIVES',
  'SOCIAL_PRESSURE',
  'MILITARY_ENFORCEMENT',

  // Government Systems
  'MINIMAL_GOVERNMENT',
  'PRIVATE_SECTOR_LEADERSHIP',
  'SOCIAL_DEMOCRACY',
  'COMPREHENSIVE_WELFARE',
  'PUBLIC_SECTOR_LEADERSHIP',
  'ENVIRONMENTAL_FOCUS',
  'ECONOMIC_PLANNING',
  'DEVELOPMENTAL_STATE',
  'WORKER_PROTECTION',
  'REGIONAL_DEVELOPMENT',
  'MERITOCRATIC_SYSTEM',
] as const;

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
  selectedComponents?: ComponentType[];
  isValid: boolean;
  errors: {
    structure?: string[];
    departments?: { [key: number]: string[] };
    budget?: string[];
    revenue?: string[];
  };
  atomicComponentCosts?: {
    annualMaintenanceCost: number;
    implementationCost: number;
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