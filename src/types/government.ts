// src/types/government.ts

import type { ComponentType } from "@prisma/client";
import { z } from "zod";

export const GovernmentStructureInputSchema = z.object({
  governmentName: z.string().min(1, "Government name is required"),
  governmentType: z.enum([
    "Constitutional Monarchy",
    "Federal Republic",
    "Parliamentary Democracy",
    "Presidential Republic",
    "Federal Constitutional Republic",
    "Unitary State",
    "Federation",
    "Confederation",
    "Empire",
    "City-State",
    "Other",
  ]),
  headOfState: z.string().optional(),
  headOfGovernment: z.string().optional(),
  legislatureName: z.string().optional(),
  executiveName: z.string().optional(),
  judicialName: z.string().optional(),
  totalBudget: z.number().positive("Total budget must be positive"),
  fiscalYear: z.string().min(1),
  budgetCurrency: z.string().min(1),
});

export const DepartmentInputSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  shortName: z.string().optional(),
  category: z.enum([
    "Defense",
    "Education",
    "Health",
    "Finance",
    "Foreign Affairs",
    "Interior",
    "Justice",
    "Transportation",
    "Agriculture",
    "Environment",
    "Labor",
    "Commerce",
    "Energy",
    "Communications",
    "Culture",
    "Science and Technology",
    "Social Services",
    "Housing",
    "Veterans Affairs",
    "Intelligence",
    "Emergency Management",
    "Other",
  ]),
  description: z.string().optional(),
  minister: z.string().optional(),
  ministerTitle: z.string().default("Minister"),
  headquarters: z.string().optional(),
  established: z.string().optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color must be a valid hex")
    .default("#6366f1"),
  priority: z.number().int().min(1).max(100).default(50),
  parentDepartmentId: z.string().optional(),
  organizationalLevel: z
    .enum(["Ministry", "Department", "Agency", "Bureau", "Office", "Commission"])
    .default("Ministry"),
  functions: z.array(z.string()).optional(),
});

export const BudgetAllocationInputSchema = z.object({
  departmentId: z.string().min(1),
  budgetYear: z.number().int().min(2020).max(2035),
  allocatedAmount: z.number().nonnegative(),
  allocatedPercent: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export const RevenueSourceInputSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["Direct Tax", "Indirect Tax", "Non-Tax Revenue", "Fees and Fines", "Other"]),
  description: z.string().optional(),
  rate: z.number().min(0).max(100).optional(),
  revenueAmount: z.number().nonnegative(),
  collectionMethod: z.string().optional(),
  administeredBy: z.string().optional(),
});

export const GovernmentBuilderStateSchema = z.object({
  structure: GovernmentStructureInputSchema,
  departments: z.array(DepartmentInputSchema),
  budgetAllocations: z.array(BudgetAllocationInputSchema),
  revenueSources: z.array(RevenueSourceInputSchema),
});

export type GovernmentBuilderStateZod = z.infer<typeof GovernmentBuilderStateSchema>;

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
  frequency: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annually";
  trend: "Up" | "Down" | "Stable";
  category: "Performance" | "Efficiency" | "Quality" | "Financial" | "Citizen Satisfaction";
}

// Enums and Union Types
export type BudgetStatus = "Allocated" | "In Use" | "Overspent" | "Underutilized" | "Completed";

export type BudgetType = "Personnel" | "Operations" | "Capital" | "Research" | "Other";

export type BudgetPriority = "Critical" | "High" | "Medium" | "Low";

export type RevenueCategory =
  "Direct Tax" | "Indirect Tax" | "Non-Tax Revenue" | "Fees and Fines" | "Other";

export interface CollectionMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isTaxRelated: boolean;
  taxCategoryType?: string;
  calculationMethod?: string;
  defaultRate?: number;
}

export const COLLECTION_METHODS: CollectionMethod[] = [
  {
    id: "automatic_deduction",
    name: "Automatic Deduction",
    description: "Automatically deducted from income/salary",
    icon: "Zap",
    color: "#059669",
    isTaxRelated: true,
    taxCategoryType: "Direct Tax",
    calculationMethod: "progressive",
    defaultRate: 15,
  },
  {
    id: "self_assessment",
    name: "Self Assessment",
    description: "Taxpayers calculate and pay themselves",
    icon: "Calculator",
    color: "#0891b2",
    isTaxRelated: true,
    taxCategoryType: "Direct Tax",
    calculationMethod: "progressive",
    defaultRate: 20,
  },
  {
    id: "point_of_sale",
    name: "Point of Sale",
    description: "Collected at time of purchase/transaction",
    icon: "CreditCard",
    color: "#dc2626",
    isTaxRelated: true,
    taxCategoryType: "Indirect Tax",
    calculationMethod: "percentage",
    defaultRate: 10,
  },
  {
    id: "withholding_tax",
    name: "Withholding Tax",
    description: "Deducted at source by payers",
    icon: "Shield",
    color: "#7c3aed",
    isTaxRelated: true,
    taxCategoryType: "Direct Tax",
    calculationMethod: "percentage",
    defaultRate: 25,
  },
  {
    id: "annual_return",
    name: "Annual Return",
    description: "Filed annually with tax returns",
    icon: "FileText",
    color: "#ea580c",
    isTaxRelated: true,
    taxCategoryType: "Direct Tax",
    calculationMethod: "progressive",
    defaultRate: 18,
  },
  {
    id: "direct_billing",
    name: "Direct Billing",
    description: "Government bills directly for services",
    icon: "Receipt",
    color: "#059669",
    isTaxRelated: false,
    taxCategoryType: "Non-Tax Revenue",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
  {
    id: "licensing_fee",
    name: "Licensing Fee",
    description: "Periodic fees for licenses/permits",
    icon: "FileCheck",
    color: "#0891b2",
    isTaxRelated: false,
    taxCategoryType: "Fees and Fines",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
  {
    id: "fine_penalty",
    name: "Fine/Penalty",
    description: "One-time fines and penalties",
    icon: "AlertTriangle",
    color: "#dc2626",
    isTaxRelated: false,
    taxCategoryType: "Fees and Fines",
    calculationMethod: "fixed",
    defaultRate: 0,
  },
  {
    id: "royalty_payment",
    name: "Royalty Payment",
    description: "Payments for resource extraction",
    icon: "Mountain",
    color: "#7c3aed",
    isTaxRelated: false,
    taxCategoryType: "Non-Tax Revenue",
    calculationMethod: "percentage",
    defaultRate: 12,
  },
  {
    id: "dividend_distribution",
    name: "Dividend Distribution",
    description: "Profits from state-owned enterprises",
    icon: "TrendingUp",
    color: "#059669",
    isTaxRelated: false,
    taxCategoryType: "Non-Tax Revenue",
    calculationMethod: "percentage",
    defaultRate: 8,
  },
];

export type OrganizationalLevel =
  "Ministry" | "Department" | "Agency" | "Bureau" | "Office" | "Commission";

// Government type is lore-first free text: the wiki holds bespoke forms (e.g. "Unitary
// Quaternalist Republic", "Federal demarchy") that must not be forced into a fixed set.
// The string literals below are autocomplete SUGGESTIONS, not a closed enum — the
// `(string & {})` keeps arbitrary values valid while preserving editor hints.
// See plans/mycountry-lore-alignment*.md.
export type GovernmentType =
  | "Constitutional Monarchy"
  | "Federal Republic"
  | "Parliamentary Democracy"
  | "Presidential Republic"
  | "Federal Constitutional Republic"
  | "Unitary State"
  | "Federation"
  | "Confederation"
  | "Empire"
  | "City-State"
  | "Other"
  | (string & {});

export type DepartmentCategory =
  | "Defense"
  | "Education"
  | "Health"
  | "Finance"
  | "Foreign Affairs"
  | "Interior"
  | "Justice"
  | "Transportation"
  | "Agriculture"
  | "Environment"
  | "Labor"
  | "Commerce"
  | "Energy"
  | "Communications"
  | "Culture"
  | "Science and Technology"
  | "Social Services"
  | "Housing"
  | "Veterans Affairs"
  | "Intelligence"
  | "Emergency Management"
  | "Other";

// Atomic Component Types - Use Prisma generated enum
export { ComponentType } from "@prisma/client";

// ComponentType values for Zod validation
export const COMPONENT_TYPE_VALUES = [
  // Power Distribution
  "CENTRALIZED_POWER",
  "FEDERAL_SYSTEM",
  "CONFEDERATE_SYSTEM",
  "UNITARY_SYSTEM",

  // Decision Process
  "DEMOCRATIC_PROCESS",
  "AUTOCRATIC_PROCESS",
  "TECHNOCRATIC_PROCESS",
  "CONSENSUS_PROCESS",
  "OLIGARCHIC_PROCESS",

  // Legitimacy Sources
  "ELECTORAL_LEGITIMACY",
  "TRADITIONAL_LEGITIMACY",
  "PERFORMANCE_LEGITIMACY",
  "CHARISMATIC_LEGITIMACY",
  "RELIGIOUS_LEGITIMACY",
  "INSTITUTIONAL_LEGITIMACY",

  // Institution Types
  "PROFESSIONAL_BUREAUCRACY",
  "MILITARY_ADMINISTRATION",
  "INDEPENDENT_JUDICIARY",
  "PARTISAN_INSTITUTIONS",
  "TECHNOCRATIC_AGENCIES",
  "DIGITAL_GOVERNMENT",

  // Control Mechanisms
  "RULE_OF_LAW",
  "SURVEILLANCE_SYSTEM",
  "ECONOMIC_INCENTIVES",
  "SOCIAL_PRESSURE",
  "MILITARY_ENFORCEMENT",

  // Government Systems
  "MINIMAL_GOVERNMENT",
  "PRIVATE_SECTOR_LEADERSHIP",
  "SOCIAL_DEMOCRACY",
  "COMPREHENSIVE_WELFARE",
  "PUBLIC_SECTOR_LEADERSHIP",
  "ENVIRONMENTAL_FOCUS",
  "ECONOMIC_PLANNING",
  "DEVELOPMENTAL_STATE",
  "WORKER_PROTECTION",
  "REGIONAL_DEVELOPMENT",
  "MERITOCRATIC_SYSTEM",
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
    departments?: Record<number, string[]>;
    budget?: string[];
    revenue?: Record<number, string[]>;
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
  subBudgets: Omit<SubBudgetInput, "amount">[];
  kpis: Omit<KeyPerformanceIndicator, "id" | "currentValue">[];
}

export interface GovernmentTemplate {
  name: string;
  governmentType: GovernmentType;
  description: string;
  departments: DepartmentTemplate[];
  fiscalYear: string;
  typicalRevenueSources: Omit<RevenueSourceInput, "revenueAmount">[];
}
