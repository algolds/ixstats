/**
 * Capital (PIM), procurement orders, industrial capacity and the defense price index (research §7.2):
 *   K_b ← K_b × (1 − δ_b,month) + Deliveries_b + generic investment_b,  δ_b,month = 1 − (1 − δ_b × w)^(1/12)
 * Orders pay 15% down then evenly over their lead time; an unfunded payment slips the order a month at +0.5% unit
 * cost. Procurement money left after order payments buys uncatalogued capital, domestic within capacity and
 * imported (+15%) beyond it.
 */
import {
  DEFAULT_LEAD_MONTHS,
  DEFAULT_MANUFACTURING_SHARE,
  DEFENSE_INFLATION,
  DOMAIN_PARAMS,
  GDP_INFLATION,
  IMPORT_COST_PREMIUM,
  IMPORT_LEAD_MULTIPLIER,
  INDUSTRY_THETA_MONTHLY,
  LEAD_MONTHS_BY_SUBCATEGORY,
  MAX_WEAR,
  MONTH_MS,
  ORDER_DOWN_PAYMENT,
  SLIP_COST_GROWTH,
  SURGE_CAPACITY_MULTIPLIER,
  SURGE_COST_PREMIUM,
  SURGE_RAMP_MONTHS,
  type BranchDomain,
} from "./constants";
import type { Delivery, OrderSource, OrderState } from "./types";

/** Monthly depreciation of a branch at a wear multiplier (capped at 5). */
export function monthlyDepreciation(domain: BranchDomain, wear: number): number {
  const annual = Math.min(0.999, DOMAIN_PARAMS[domain].delta * Math.min(MAX_WEAR, Math.max(1, wear)));
  return 1 - Math.pow(1 - annual, 1 / 12);
}

/** One month of a geometric stock: X ← X (1 − d) + inflow. */
export const stepStock = (stock: number, depreciation: number, inflow: number) =>
  stock * (1 - depreciation) + inflow;

/** n months at a constant inflow: X_n = X_0 (1−d)^n + I (1 − (1−d)^n) / d. */
export function stockAfter(stock: number, depreciation: number, inflow: number, months: number) {
  const keep = Math.pow(1 - depreciation, months);
  const accumulated = depreciation > 0 ? (inflow * (1 - keep)) / depreciation : inflow * months;
  return stock * keep + accumulated;
}

/** The price index after n months: P × (1 + π_GDP + π_def)^(n/12). */
export function priceIndexAfter(priceIndex: number, months: number): number {
  return priceIndex * Math.pow(1 + GDP_INFLATION + DEFENSE_INFLATION, months / 12);
}

/** Months a catalog item takes from order to delivery; imports take 1.5× as long. */
export function leadMonths(subcategory: string | null | undefined, source: OrderSource): number {
  const base = LEAD_MONTHS_BY_SUBCATEGORY[subcategory ?? ""] ?? DEFAULT_LEAD_MONTHS;
  return source === "import" ? Math.ceil(base * IMPORT_LEAD_MULTIPLIER) : base;
}

/** Surge capacity multiplier: 1 → 2 linearly over 24 months of surge. */
export function surgeMultiplier(surgeMonths: number | null): number {
  if (surgeMonths === null) return 1;
  const ramp = Math.min(1, Math.max(0, surgeMonths) / SURGE_RAMP_MONTHS);
  return 1 + (SURGE_CAPACITY_MULTIPLIER - 1) * ramp;
}

/** Monthly domestic production capacity (nominal): θ_ind × GDP × manufacturing share × surge (× price index). */
export function domesticCapacity(input: {
  gdp: number;
  manufacturingShare?: number;
  surgeMonths: number | null;
  priceIndex: number;
}): number {
  const share = input.manufacturingShare ?? DEFAULT_MANUFACTURING_SHARE;
  return (
    INDUSTRY_THETA_MONTHLY *
    Math.max(0, input.gdp) *
    share *
    surgeMultiplier(input.surgeMonths) *
    input.priceIndex
  );
}

/** The unit cost of an order now: catalog cost × P_cat, +15% for imports, +30% for domestic work while surging. */
export function orderUnitCost(input: {
  catalogCost: number;
  priceIndex: number;
  source: OrderSource;
  surging: boolean;
}): number {
  const premium =
    input.source === "import" ? IMPORT_COST_PREMIUM : input.surging ? SURGE_COST_PREMIUM : 0;
  return input.catalogCost * input.priceIndex * (1 + premium);
}

export const orderTotal = (order: Pick<OrderState, "quantity" | "unitCost">) =>
  order.quantity * order.unitCost;

/** The order's monthly production draw on domestic capacity (imports draw none). */
export const capacityDraw = (order: OrderState) =>
  order.source === "domestic" && order.status === "ordered"
    ? orderTotal(order) / Math.max(1, order.leadMonths)
    : 0;

/**
 * Share of the order scheduled to be paid by `clockMs`: 15% at order (paid when the order is placed), the rest evenly
 * over the lead time.
 */
export function scheduledShare(order: OrderState, clockMs: number): number {
  const remaining = Math.max(0, (order.expectedClockMs - clockMs) / MONTH_MS);
  const progress = 1 - Math.min(1, remaining / Math.max(1, order.leadMonths));
  return ORDER_DOWN_PAYMENT + (1 - ORDER_DOWN_PAYMENT) * Math.max(0, progress);
}

const PAID_EPSILON = 1e-6;

export interface ProcurementMonth {
  orders: OrderState[];
  deliveries: Delivery[];
  /** Procurement money left for uncatalogued capital (nominal). */
  leftover: number;
  /** Order payments that slipped this month. */
  slipped: number;
}

function payOrder(order: OrderState, clockMs: number, money: number) {
  const due = Math.max(0, scheduledShare(order, clockMs) * orderTotal(order) - order.paidSoFar);
  if (due <= money + PAID_EPSILON) {
    return { order: { ...order, paidSoFar: order.paidSoFar + due }, spent: due, slipped: false };
  }
  // Delay is cost growth: the order moves a month and its unit cost rises 0.5%.
  const slippedOrder = {
    ...order,
    expectedClockMs: order.expectedClockMs + MONTH_MS,
    unitCost: order.unitCost * (1 + SLIP_COST_GROWTH),
  };
  return { order: slippedOrder, spent: 0, slipped: true };
}

function delivered(order: OrderState, clockMs: number): boolean {
  return (
    order.expectedClockMs <= clockMs && order.paidSoFar >= orderTotal(order) * (1 - PAID_EPSILON)
  );
}

/**
 * Down payments made at order this month (orders placed since the previous month end, cancelled ones included: what
 * was paid is sunk). They come out of this month's procurement line like the monthly payments; an overdraft beyond
 * the line is not carried into later months.
 */
export function paidAtOrder(orders: readonly OrderState[], clockMs: number): number {
  return orders
    .filter((o) => o.orderedClockMs >= clockMs - MONTH_MS && o.orderedClockMs < clockMs)
    .reduce((sum, o) => sum + o.paidSoFar, 0);
}

/**
 * One month of order payments and deliveries at month end `clockMs`, oldest order first. Orders that cannot be
 * paid slip; later, cheaper orders may still be paid.
 */
export function procurementMonth(
  orders: readonly OrderState[],
  money: number,
  clockMs: number
): ProcurementMonth {
  let left = Math.max(0, money - paidAtOrder(orders, clockMs));
  let slipped = 0;
  const deliveries: Delivery[] = [];
  const queue = [...orders].sort(
    (a, b) => a.orderedClockMs - b.orderedClockMs || a.id.localeCompare(b.id)
  );
  const next = queue.map((order) => {
    if (order.status !== "ordered") return order;
    const paid = payOrder(order, clockMs, left);
    left -= paid.spent;
    if (paid.slipped) slipped += 1;
    if (!delivered(paid.order, clockMs)) return paid.order;
    deliveries.push({
      orderId: order.id,
      branchId: order.branchId,
      catalogKey: order.catalogKey,
      quantity: order.quantity,
      designYear: order.designYear,
      unitRealValue: order.unitRealValue,
      deliveredClockMs: clockMs,
    });
    return { ...paid.order, status: "delivered" as const };
  });
  return { orders: next, deliveries, leftover: left, slipped };
}

/**
 * Real capital the leftover procurement money buys: domestic within the capacity orders leave free (at the surge
 * premium while surging), imported beyond it at +15%.
 */
export function genericInvestment(input: {
  leftover: number;
  capacity: number;
  capacityUsed: number;
  priceIndex: number;
  surging: boolean;
}): number {
  const free = Math.max(0, input.capacity - input.capacityUsed);
  const domestic = Math.min(Math.max(0, input.leftover), free);
  const imported = Math.max(0, input.leftover) - domestic;
  const domesticPrice = input.priceIndex * (1 + (input.surging ? SURGE_COST_PREMIUM : 0));
  const importPrice = input.priceIndex * (1 + IMPORT_COST_PREMIUM);
  return domestic / domesticPrice + imported / importPrice;
}
