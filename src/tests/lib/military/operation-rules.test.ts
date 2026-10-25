/** P1-22: training ends with a net readiness gain; the server rates an operation's outcome. */
import {
  DEPLOY_READINESS_COST,
  operationSuccessRating,
  readinessRecovery,
} from "~/lib/military/operation-rules";

const DAY = 24 * 60 * 60 * 1000;

describe("readinessRecovery", () => {
  it("gives training back more than deploying cost, and other operations less", () => {
    expect(readinessRecovery("training", false)).toBeGreaterThan(DEPLOY_READINESS_COST);
    expect(readinessRecovery("blockade", false)).toBeLessThan(DEPLOY_READINESS_COST);
  });

  it("is 10% larger while the Generals are satisfied", () => {
    expect(readinessRecovery("training", true)).toBe(22);
    expect(readinessRecovery("intervention", true)).toBe(6);
  });
});

describe("operationSuccessRating", () => {
  const rate = (durationIxDays: number | null, ranIxDays: number) =>
    operationSuccessRating({ durationIxDays, startIxTime: 0, endIxTime: ranIxDays * DAY });

  it("rates by the share of the planned duration that ran", () => {
    expect(rate(30, 30)).toBe("success");
    expect(rate(30, 20)).toBe("partial");
    expect(rate(30, 5)).toBe("failure");
  });

  it("rates an operation with no planned duration a success", () => {
    expect(rate(null, 1)).toBe("success");
  });
});
