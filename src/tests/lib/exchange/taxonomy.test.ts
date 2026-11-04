/**
 * Exchange phase 3 taxonomy (docs/specs/2026-11-01-exchange-phase-3-design.md). The sub-industry
 * links must resolve, supply-chain synergy stays inside its band, credit ratings change at
 * their boundaries, borrow rates clamp the HQ rate, and a company with no shares yields
 * finite ratios.
 */
import {
  borrowRateFor,
  computeCompanyMetrics,
  creditRatingFor,
  creditSpreadFor,
  CREDIT_RATINGS,
  CREDIT_SPREADS,
  isSubIndustryKey,
  subIndustriesOf,
  SUB_INDUSTRIES,
  supplyChainFactor,
  type CompanyMetricsInput,
  type CreditRating,
} from "~/lib/exchange/taxonomy";

const ALL_KEYS = SUB_INDUSTRIES.map((sub) => sub.key);

const healthy: CompanyMetricsInput = {
  capital: 1000,
  decisionValue: 500,
  creditDrawn: 300,
  standing: 2,
  sharesOutstanding: 100,
  lastTradePrice: null,
  fairValue: 1500,
  lastTickNetIncome: 10,
  trailing30dDividends: 30,
};

describe("sub-industry taxonomy", () => {
  it("defines 12 sub-industries, three per macro sector", () => {
    expect(SUB_INDUSTRIES).toHaveLength(12);
    for (const sector of ["agriculture", "industry", "services", "government"] as const) {
      expect(subIndustriesOf(sector)).toHaveLength(3);
    }
  });

  it("links only to sub-industries that exist", () => {
    for (const sub of SUB_INDUSTRIES) {
      for (const upstreamKey of sub.upstream) {
        expect(ALL_KEYS).toContain(upstreamKey);
        expect(isSubIndustryKey(upstreamKey)).toBe(true);
      }
    }
  });

  it("never links a sub-industry to itself", () => {
    for (const sub of SUB_INDUSTRIES) {
      expect(sub.upstream).not.toContain(sub.key);
    }
  });

  it("keeps margins and upkeep as sane fractions", () => {
    for (const sub of SUB_INDUSTRIES) {
      expect(sub.baseMargin).toBeGreaterThan(0);
      expect(sub.baseMargin).toBeLessThan(0.5);
      expect(sub.upkeepRate).toBeGreaterThan(0);
      expect(sub.upkeepRate).toBeLessThan(0.1);
    }
  });

  it("rejects unknown keys in the type guard", () => {
    expect(isSubIndustryKey("software_media")).toBe(true);
    expect(isSubIndustryKey("semiconductors_rd")).toBe(false);
    expect(isSubIndustryKey("")).toBe(false);
  });
});

describe("supplyChainFactor", () => {
  it("returns 1 when the sub-industry has no upstream links", () => {
    expect(supplyChainFactor("not_a_sub_industry", ALL_KEYS)).toBe(1);
  });

  it("returns the floor when no upstream sub-industry is in the realm", () => {
    expect(supplyChainFactor("agribusiness", ["software_media"])).toBe(0.9);
  });

  it("gives +5% for one satisfied link and +10% for two", () => {
    expect(supplyChainFactor("agribusiness", ["logistics"])).toBeCloseTo(1.05);
    expect(supplyChainFactor("agribusiness", ["logistics", "chemicals"])).toBeCloseTo(1.1);
  });

  it("adds the recent upstream contract bonus and clamps at the ceiling", () => {
    expect(
      supplyChainFactor("agribusiness", ["logistics"], { recentUpstreamContract: true })
    ).toBeCloseTo(1.1);
    expect(
      supplyChainFactor("agribusiness", ["logistics", "chemicals"], {
        recentUpstreamContract: true,
      })
    ).toBeCloseTo(1.15);
  });

  it("does not apply the contract bonus when no upstream is present", () => {
    expect(supplyChainFactor("agribusiness", [], { recentUpstreamContract: true })).toBe(0.9);
  });

  it("stays within [0.90, 1.15] for every sub-industry and realm mix", () => {
    const realms: string[][] = [[], ALL_KEYS, ["logistics"], ["energy_mining", "chemicals"]];
    for (const sub of SUB_INDUSTRIES) {
      for (const realm of realms) {
        for (const recentUpstreamContract of [false, true]) {
          const factor = supplyChainFactor(sub.key, realm, { recentUpstreamContract });
          expect(factor).toBeGreaterThanOrEqual(0.9);
          expect(factor).toBeLessThanOrEqual(1.15);
        }
      }
    }
  });
});

describe("credit ratings", () => {
  const rate = (standing: number, debtToEquity: number, lastTickNetIncome = 1): CreditRating =>
    creditRatingFor({ standing, debtToEquity, lastTickNetIncome });

  it("lists ratings from best to worst", () => {
    expect([...CREDIT_RATINGS]).toEqual(["AAA", "AA", "A", "BBB", "B", "CCC", "D"]);
  });

  it("grants AAA only at standing 10, D/E 0.1 and positive net income", () => {
    expect(rate(10, 0.1, 1)).toBe("AAA");
    expect(rate(10, 0.1, 0)).toBe("AA");
    expect(rate(10, 0.11, 1)).toBe("AA");
    expect(rate(9.99, 0.1, 1)).toBe("AA");
  });

  it("grants AA at standing 6 and D/E 0.3", () => {
    expect(rate(6, 0.3)).toBe("AA");
    expect(rate(6, 0.31)).toBe("A");
    expect(rate(5.99, 0.3)).toBe("A");
  });

  it("grants A at standing 3 and D/E 0.6", () => {
    expect(rate(3, 0.6)).toBe("A");
    expect(rate(3, 0.61)).toBe("BBB");
    expect(rate(2.99, 0.6)).toBe("BBB");
  });

  it("grants BBB at standing 1 and D/E 1.0", () => {
    expect(rate(1, 1.0)).toBe("BBB");
    expect(rate(1, 1.01)).toBe("B");
    expect(rate(0.99, 0)).toBe("B");
  });

  it("grants B from standing -1 with no leverage test", () => {
    expect(rate(-1, 50)).toBe("B");
    expect(rate(-1.01, 0)).toBe("CCC");
  });

  it("grants CCC from standing -3 and D below that", () => {
    expect(rate(-3, 0)).toBe("CCC");
    expect(rate(-3.01, 0)).toBe("D");
  });

  it("maps spreads to the spec ladder with no spread for D", () => {
    expect(creditSpreadFor("AAA")).toBe(0.005);
    expect(creditSpreadFor("AA")).toBe(0.01);
    expect(creditSpreadFor("A")).toBe(0.02);
    expect(creditSpreadFor("BBB")).toBe(0.035);
    expect(creditSpreadFor("B")).toBe(0.06);
    expect(creditSpreadFor("CCC")).toBe(0.1);
    expect(CREDIT_SPREADS.D).toBeNull();
  });
});

describe("borrowRateFor", () => {
  it("adds the spread to the HQ rate", () => {
    expect(borrowRateFor(0.08, "BBB")).toBeCloseTo(0.115);
  });

  it("defaults an unset HQ rate to 5%", () => {
    expect(borrowRateFor(null, "A")).toBeCloseTo(0.07);
  });

  it("clamps the HQ rate to [2%, 20%]", () => {
    expect(borrowRateFor(0.001, "AAA")).toBeCloseTo(0.025);
    expect(borrowRateFor(0.5, "AAA")).toBeCloseTo(0.205);
  });

  it("returns null for a D-rated company", () => {
    expect(borrowRateFor(0.05, "D")).toBeNull();
  });
});

describe("computeCompanyMetrics", () => {
  it("derives market, book and credit figures for a traded company", () => {
    const metrics = computeCompanyMetrics({ ...healthy, lastTradePrice: 16 });
    expect(metrics.sharePrice).toBe(16);
    expect(metrics.marketCap).toBe(1600);
    expect(metrics.bookValue).toBe(1200);
    expect(metrics.debtToEquity).toBeCloseTo(0.2);
    expect(metrics.creditRating).toBe("BBB");
  });

  it("falls back to fair value per share when untraded", () => {
    const metrics = computeCompanyMetrics(healthy);
    expect(metrics.sharePrice).toBe(15);
    expect(metrics.marketCap).toBe(1500);
  });

  it("annualises the last tick for EPS and returns P/E and yield", () => {
    const metrics = computeCompanyMetrics(healthy);
    expect(metrics.eps).toBe(146);
    expect(metrics.peRatio).toBe(0.1027);
    expect(metrics.dividendYield).toBe(0.02);
  });

  it("returns a null P/E when earnings are negative", () => {
    const metrics = computeCompanyMetrics({ ...healthy, lastTickNetIncome: -5 });
    expect(metrics.eps).toBeLessThan(0);
    expect(metrics.peRatio).toBeNull();
  });

  it("floors book value at zero", () => {
    const metrics = computeCompanyMetrics({
      ...healthy,
      capital: 0,
      decisionValue: 0,
      creditDrawn: 900,
    });
    expect(metrics.bookValue).toBe(0);
  });

  it("rounds money to cents and ratios to four places", () => {
    const metrics = computeCompanyMetrics({ ...healthy, fairValue: 1, sharesOutstanding: 3 });
    expect(metrics.sharePrice).toBe(0.33);
    expect(metrics.debtToEquity).toBe(0.2);
    expect(metrics.marketCap).toBe(1);
  });

  it("keeps a zero-share company finite with no NaN or Infinity", () => {
    const metrics = computeCompanyMetrics({
      ...healthy,
      sharesOutstanding: 0,
      lastTradePrice: null,
      fairValue: 800,
    });
    expect(metrics).toEqual({
      marketCap: 0,
      bookValue: 1200,
      eps: 0,
      peRatio: null,
      dividendYield: null,
      debtToEquity: 0.2,
      creditRating: "BBB",
      sharePrice: 0,
    });
  });

  it("keeps a zero-share company with a stale last trade finite", () => {
    const metrics = computeCompanyMetrics({ ...healthy, sharesOutstanding: 0, lastTradePrice: 12 });
    expect(metrics.sharePrice).toBe(12);
    expect(metrics.marketCap).toBe(0);
    expect(metrics.eps).toBe(0);
    expect(metrics.peRatio).toBeNull();
    expect(metrics.dividendYield).toBeNull();
    for (const value of [metrics.marketCap, metrics.bookValue, metrics.eps, metrics.debtToEquity]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
