/**
 * Shapes the defense model reads and writes. Persistence lives in `src/server/modules/defense`; these are the plain
 * values the pure layers pass between them.
 */
import type {
  AlertLevel,
  BranchDomain,
  BudgetShares,
  Doctrine,
  OmPriority,
} from "./constants";

/** A nation's economy as the model reads it each month (from the nation simulation). */
export interface EconomyInputs {
  population: number;
  gdpPerCapita: number;
  /** Total GDP (real, USD-equivalent). */
  gdp: number;
  /** The annual defense budget D (the Defense department line or its fallback). */
  defenseBudget: number;
  /** Median GDP per capita of the nation's realm, for CEV. */
  realmMedianGdpPerCapita: number;
  /** The realm frontier as a fractional year on the shared timeline. */
  frontierYear: number;
  /** Manufacturing share of GDP (defaults when unknown). */
  manufacturingShare?: number;
  /** O&M the nation's active operations draw each month: paid before maintenance and training (research §7.3). */
  operationsMonthly?: number;
}

/** The per-country policy record and the national stocks. */
export interface PolicyState {
  shares: BudgetShares;
  /** Volunteer share v ∈ [0, 1]: 1 all-volunteer, 0 conscription. */
  volunteerShare: number;
  serviceMonths: number;
  /** Years a discharged member stays in the reserve (the reserve obligation; 0 keeps no reserve). */
  reserveYears: number;
  doctrine: Doctrine;
  /** The ordered alert level … */
  alertLevel: AlertLevel;
  /** … the level before it … */
  previousAlertLevel: AlertLevel;
  /** … and when it was ordered (clock ms): a raise bites after the new level's bite days. */
  alertChangedClockMs: number;
  omPriority: OmPriority;
  /** R&D stock H_RD (real). */
  rdStock: number;
  /** Infrastructure stock (real). */
  infrastructureStock: number;
  /** Catalog price index P_cat (1 at the reset). */
  priceIndex: number;
  /** When the industrial surge started (clock ms); null when not surging. */
  surgeStartedClockMs: number | null;
}

/** One branch's state. Headcounts are fractional so slow adjustments never stall on rounding. */
export interface BranchState {
  id: string;
  domain: BranchDomain;
  /** Player's effort weight; normalised across active branches. */
  effortShare: number;
  /** The player's desired active strength N_policy; null follows what the budget affords. */
  targetActive: number | null;
  active: number;
  reserves: number;
  /** Real capital K (catalog price units at the reset). */
  capital: number;
  /** Equipment condition Rc and training T, both in [0, 1]. */
  condition: number;
  training: number;
  /** Reserve training proficiency in [0, T_MAX_RESERVE]. */
  reserveTraining: number;
  /** Reservists ordered to mobilise, and when (clock ms). */
  mobilisationOrder: number;
  mobilisationOrderedClockMs: number | null;
  /** Wear from operations under way (1 when none). */
  operationWear: number;
}

export type OrderSource = "domestic" | "import";
export type OrderStatus = "ordered" | "delivered" | "cancelled";

/** A procurement order as the capital layer reads it. */
export interface OrderState {
  id: string;
  branchId: string;
  catalogKey: string;
  quantity: number;
  /** Nominal unit cost now (grows when the order slips). */
  unitCost: number;
  /** Real replacement value of one unit (enters K on delivery). */
  unitRealValue: number;
  source: OrderSource;
  leadMonths: number;
  orderedClockMs: number;
  expectedClockMs: number;
  paidSoFar: number;
  status: OrderStatus;
  designYear: number;
}

/** A catalog asset in a branch, for quality and enablers. */
export interface AssetState {
  branchId: string;
  catalogKey: string | null;
  subcategory: string | null;
  role: string | null;
  quantity: number;
  /** Real replacement value of one unit. */
  unitRealValue: number;
  designYear: number | null;
  /** Catalog crew per unit, for personnel fill. */
  crewPerUnit?: number | null;
}

/** Everything one monthly step reads and writes for a nation. */
export interface NationState {
  policy: PolicyState;
  branches: BranchState[];
  orders: OrderState[];
  /** Clock ms of the last completed monthly tick. */
  lastTickClockMs: number;
}

/** What a step delivered, for the persistence layer to turn into asset rows. */
export interface Delivery {
  orderId: string;
  branchId: string;
  catalogKey: string;
  quantity: number;
  designYear: number;
  unitRealValue: number;
  deliveredClockMs: number;
}
