import { roundToIxDay } from "~/lib/ixtime/day";

const IX_DAY_MS = 86_400_000;

describe("roundToIxDay", () => {
  it("rounds before the epoch down too, so the day boundary stays put", () => {
    expect(roundToIxDay(-1)).toBe(-IX_DAY_MS);
    expect(roundToIxDay(0)).toBe(0);
  });
});
