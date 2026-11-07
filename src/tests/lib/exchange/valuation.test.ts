/**
 * One copy of the Exchange money math (valuation.ts), shared by the UI and the server, so the numbers on screen are
 * the numbers the server settles on.
 */
import { computeFairValue, creditLimitFor, borrowRateOf } from "~/lib/exchange/valuation";
import * as server from "~/lib/exchange/companies";
import * as credit from "~/lib/exchange/credit";
import * as ui from "~/components/exchange/shared";

describe("valuation", () => {
  it("values a company with the MVP formula at the default weights", () => {
    const v = computeFairValue({ capital: 5000, contractsWonValue: 2000, standing: 3, decisionValue: 1000 }, 1000);
    expect(v.fairValue).toBe(5000 + 0.25 * 2000 + 100 * 3 + 1000);
    expect(v.sectorFactor).toBe(1);
  });

  it("caps a credit line at 250,000", () => {
    expect(creditLimitFor({ decisionValue: 1_000_000, contractsWonValue: 0 })).toBe(250_000);
  });

  it("prices credit at the nation's rate plus the rating spread", () => {
    expect(borrowRateOf(0.05, "BBB")).toBeCloseTo(0.085, 10);
  });

  it("is the very function the server and the UI use", () => {
    expect(server.computeFairValue).toBe(computeFairValue);
    expect(credit.creditLimitFor).toBe(creditLimitFor);
    expect(credit.borrowRateOf).toBe(borrowRateOf);
    expect(ui.creditLimitFor).toBe(creditLimitFor);
    expect(ui.borrowRateOf).toBe(borrowRateOf);
  });

  it("loads without the Prisma client", () => {
    jest.isolateModules(() => {
      jest.doMock("@prisma/client", () => {
        throw new Error("valuation.ts must not load Prisma");
      });
      expect(() => require("~/lib/exchange/valuation")).not.toThrow();
    });
  });
});
