import { roundToIxDay } from "~/lib/ixtime/day";

const IX_DAY_MS = 86_400_000;

describe("roundToIxDay", () => {
  const day = 20_000 * IX_DAY_MS;

  it("rounds an IxTime down to the start of its IxTime day", () => {
    expect(roundToIxDay(day)).toBe(day);
    expect(roundToIxDay(day + 1)).toBe(day);
    expect(roundToIxDay(day + IX_DAY_MS - 1)).toBe(day);
    expect(roundToIxDay(day + IX_DAY_MS)).toBe(day + IX_DAY_MS);
  });

  it("rounds before the epoch down too, so the day boundary stays put", () => {
    expect(roundToIxDay(-1)).toBe(-IX_DAY_MS);
    expect(roundToIxDay(0)).toBe(0);
  });
});
