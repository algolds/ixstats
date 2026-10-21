import { IxTime } from "~/lib/ixtime";

describe("IxTime Core Chronometry & Temporal Engine", () => {
  beforeEach(() => {
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
  });

  afterEach(() => {
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
  });
  describe("Forward and Inverse Conversions", () => {
    it("should convert historical pre-2025 real time at 4x speed", () => {
      const real2022 = new Date("2022-10-04T00:00:00.000Z").getTime();
      const ixTime = IxTime.convertToIxTime(real2022);
      const ixDate = new Date(ixTime);
      // 2 real years elapsed * 4 = 8 IxTime years -> 2020 + 8 = 2028
      expect(ixDate.getUTCFullYear()).toBe(2028);
    });

    it("should convert post-July 2025 real time at 2x speed from pivot (Jan 1, 2040)", () => {
      const realPivot = new Date("2025-07-27T00:00:00.000Z").getTime();
      const ixTimeAtPivot = IxTime.convertToIxTime(realPivot);
      const ixDateAtPivot = new Date(ixTimeAtPivot);
      expect(ixDateAtPivot.toISOString()).toBe("2040-01-01T00:00:00.000Z");

      // ~6 months (183.5 days) after pivot real-time -> 367 IxDays -> full IxTime year (2041, accounting for 2040 leap year)
      const realPlusHalfYear = realPivot + 183.5 * 24 * 60 * 60 * 1000;
      const ixTimePlusYear = IxTime.convertToIxTime(realPlusHalfYear);
      const ixDatePlusYear = new Date(ixTimePlusYear);
      expect(ixDatePlusYear.getUTCFullYear()).toBe(2041);
    });

    it("should perform exact round-trip inverse conversion", () => {
      const realNow = Date.now();
      const ixTime = IxTime.convertToIxTime(realNow);
      const recoveredReal = IxTime.convertFromIxTime(ixTime);
      expect(Math.abs(recoveredReal - realNow)).toBeLessThanOrEqual(1);
    });
  });
});
