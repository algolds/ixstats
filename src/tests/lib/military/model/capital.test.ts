/** @jest-environment node */
/**
 * Capital (PIM), procurement orders, industry and prices (research §7.2).
 */
import {
  MONTH_MS,
  capacityDraw,
  domesticCapacity,
  genericInvestment,
  leadMonths,
  monthlyDepreciation,
  orderUnitCost,
  priceIndexAfter,
  procurementMonth,
  scheduledShare,
  stepStock,
  stockAfter,
  surgeMultiplier,
  type OrderState,
} from "~/lib/military/model";

const order = (overrides: Partial<OrderState> = {}): OrderState => ({
  id: "o1",
  branchId: "b1",
  catalogKey: "F35",
  quantity: 10,
  unitCost: 100,
  unitRealValue: 100,
  source: "domestic",
  leadMonths: 10,
  orderedClockMs: 0,
  expectedClockMs: 10 * MONTH_MS,
  paidSoFar: 0,
  status: "ordered",
  designYear: 2024,
  ...overrides,
});

describe("PIM", () => {
  it("depreciates monthly from the annual rate, faster under wear (capped at 5×)", () => {
    expect(1 - Math.pow(1 - monthlyDepreciation("land", 1), 12)).toBeCloseTo(0.1);
    expect(monthlyDepreciation("land", 3)).toBeGreaterThan(monthlyDepreciation("land", 1));
    expect(monthlyDepreciation("land", 50)).toBeCloseTo(monthlyDepreciation("land", 5));
  });

  it("matches stepwise accumulation in closed form: K_n = K_0(1−δ)^n + I(1 − (1−δ)^n)/δ", () => {
    const d = monthlyDepreciation("sea", 1);
    let k = 1e9;
    for (let i = 0; i < 60; i++) k = stepStock(k, d, 5e7);
    expect(stockAfter(1e9, d, 5e7, 60)).toBeCloseTo(k, 0);
  });

  it("raises catalog prices 1.5% a year in real terms (π_def), never deflates power", () => {
    expect(priceIndexAfter(1, 12)).toBeCloseTo(1.015);
  });
});

describe("orders", () => {
  it("costs +15% to import, +30% domestic while surging, and imports take 1.5× as long", () => {
    expect(orderUnitCost({ catalogCost: 100, priceIndex: 1, source: "import", surging: false })).toBeCloseTo(115);
    expect(orderUnitCost({ catalogCost: 100, priceIndex: 1, source: "domestic", surging: true })).toBeCloseTo(130);
    expect(leadMonths("fighter", "domestic")).toBe(36);
    expect(leadMonths("fighter", "import")).toBe(54);
    expect(leadMonths("unknown", "domestic")).toBe(18);
  });

  it("schedules 15% at order and the rest evenly over the lead time", () => {
    const o = order();
    expect(scheduledShare(o, 0)).toBeCloseTo(0.15);
    expect(scheduledShare(o, 5 * MONTH_MS)).toBeCloseTo(0.15 + 0.85 * 0.5);
    expect(scheduledShare(o, 10 * MONTH_MS)).toBeCloseTo(1);
  });

  it("pays and delivers on schedule when funded", () => {
    let orders = [order()];
    let delivered = 0;
    for (let m = 1; m <= 10; m++) {
      const month = procurementMonth(orders, 1e6, m * MONTH_MS);
      orders = month.orders;
      delivered += month.deliveries.length;
      if (m < 10) expect(month.deliveries).toHaveLength(0);
    }
    expect(delivered).toBe(1);
    expect(orders[0]!.status).toBe("delivered");
    expect(orders[0]!.paidSoFar).toBeCloseTo(1000);
  });

  it("slips a month at +0.5% unit cost when the line cannot pay, and pays later orders that fit", () => {
    const big = order({ id: "big", quantity: 100 });
    const small = order({ id: "small", quantity: 1, orderedClockMs: 1 });
    const month = procurementMonth([big, small], 200, MONTH_MS);
    const [b, s] = month.orders;
    expect(b!.expectedClockMs).toBeCloseTo(11 * MONTH_MS);
    expect(b!.unitCost).toBeCloseTo(100.5);
    expect(b!.paidSoFar).toBe(0);
    expect(s!.paidSoFar).toBeGreaterThan(0);
    expect(month.slipped).toBe(1);
  });

  it("skips cancelled and delivered orders", () => {
    const month = procurementMonth([order({ status: "cancelled" })], 1e6, MONTH_MS);
    expect(month.leftover).toBe(1e6);
  });
});

describe("industry", () => {
  it("caps domestic production at θ × GDP × manufacturing share, doubled over 24 months of surge", () => {
    const base = domesticCapacity({ gdp: 1.2e12, surgeMonths: null, priceIndex: 1 });
    expect(base).toBeCloseTo((0.02 / 12) * 1.2e12 * 0.15);
    expect(surgeMultiplier(12)).toBeCloseTo(1.5);
    expect(surgeMultiplier(48)).toBe(2);
  });

  it("draws capacity only for domestic orders", () => {
    expect(capacityDraw(order())).toBeCloseTo(100);
    expect(capacityDraw(order({ source: "import" }))).toBe(0);
  });

  it("buys leftover capital domestically within free capacity and imports the rest at +15%", () => {
    expect(genericInvestment({ leftover: 100, capacity: 1000, capacityUsed: 0, priceIndex: 1, surging: false })).toBeCloseTo(
      100
    );
    expect(genericInvestment({ leftover: 215, capacity: 100, capacityUsed: 0, priceIndex: 1, surging: false })).toBeCloseTo(
      200
    );
  });
});
