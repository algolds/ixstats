import { IxTime } from "~/lib/ixtime";



describe("IxTime Core Chronometry & Temporal Engine", () => {
  beforeEach(() => {
    IxTime.clearTimeOverride();
    IxTime.clearMultiplierOverride();
  });

  afterEach(() => {
    IxTime.clearTimeOverride();
    IxTime.clearMultiplierOverride();
  });

  describe("Epochs and Constants", () => {
    it("should return expected real world epoch (Oct 4, 2020)", () => {
      const epoch = IxTime.getRealWorldEpoch();
      const date = new Date(epoch);
      expect(date.getUTCFullYear()).toBe(2020);
      expect(date.getUTCMonth()).toBe(9); // October = 9
      expect(date.getUTCDate()).toBe(4);
    });

    it("should return expected in-game epoch (Jan 1, 2028)", () => {
      const epoch = IxTime.getInGameEpoch();
      const date = new Date(epoch);
      expect(date.getUTCFullYear()).toBe(2028);
      expect(date.getUTCMonth()).toBe(0); // January = 0
      expect(date.getUTCDate()).toBe(1);
    });

    it("should return default speed multiplier for current era (2.0x)", () => {
      const mult = IxTime.getDefaultMultiplier();
      expect(mult).toBe(2.0);
    });
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

  describe("Calendar Arithmetic & Helpers", () => {
    it("should calculate years elapsed and game year accurately", () => {
      const ix2035 = new Date("2035-01-01T00:00:00.000Z").getTime();
      const gameYear = IxTime.getCurrentGameYear(ix2035);
      expect(gameYear).toBe(2035);

      const yearsSince = IxTime.getYearsSinceGameEpoch(ix2035);
      // 2035 - 2028 = 7 years
      expect(Math.round(yearsSince)).toBe(7);
    });

    it("should add years and months accurately", () => {
      const base = new Date("2040-06-15T00:00:00.000Z").getTime();
      const plus2Years = IxTime.addYears(base, 2);
      expect(new Date(plus2Years).getUTCFullYear()).toBe(2042);

      const plus3Months = IxTime.addMonths(base, 3);
      expect(new Date(plus3Months).getUTCMonth()).toBe(8); // September = 8
    });

    it("should format IxTime with ILT suffix", () => {
      const ixTime = new Date(Date.UTC(2042, 2, 14, 15, 30, 0)).getTime();
      const formattedWithTime = IxTime.formatIxTime(ixTime, true);
      expect(formattedWithTime).toContain("March 14, 2042");
      expect(formattedWithTime).toContain("15:30:00 (ILT)");

      const formattedDateOnly = IxTime.formatIxTime(ixTime, false);
      expect(formattedDateOnly).toContain("March 14, 2042 (ILT)");
      expect(formattedDateOnly).not.toContain("15:30:00");
    });
  });

  describe("Overrides and Pause Mechanics", () => {
    it("should honor time and multiplier overrides", () => {
      const overrideTime = new Date("2050-01-01T00:00:00.000Z").getTime();
      IxTime.setTimeOverride(overrideTime);
      IxTime.setMultiplierOverride(0); // Paused

      expect(IxTime.isPaused()).toBe(true);
      expect(IxTime.getCurrentIxTime()).toBe(overrideTime);
      expect(IxTime.getTimeMultiplier()).toBe(0);
      expect(IxTime.isMultiplierNatural()).toBe(false);

      IxTime.clearMultiplierOverride();
      expect(IxTime.isPaused()).toBe(false);
    });

    it("should reset natural multiplier correctly", () => {
      const result = IxTime.setNaturalMultiplier(2.0);
      expect(result.isNatural).toBe(true);
      expect(IxTime.isMultiplierNatural()).toBe(true);

      const overrideResult = IxTime.setNaturalMultiplier(5.0);
      expect(overrideResult.isNatural).toBe(false);
      expect(IxTime.isMultiplierNatural()).toBe(false);
    });
  });

  describe("Timestamp Coercion Helpers", () => {
    it("should safely coerce number, Date, and string to Unix timestamp", () => {
      const ts = 1753574400000;
      const date = new Date(ts);
      const iso = date.toISOString();

      expect(IxTime.toTimestamp(ts)).toBe(ts);
      expect(IxTime.toTimestamp(date)).toBe(ts);
      expect(IxTime.toTimestamp(iso)).toBe(ts);
      expect(IxTime.toTimestamp(null)).toBeNull();
      expect(IxTime.toTimestamp(undefined)).toBeNull();
      expect(IxTime.toTimestamp("invalid-date-string")).toBeNull();
    });

    it("should safely coerce to Date and ISO string", () => {
      const ts = 1753574400000;
      const date = IxTime.toDate(ts);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(ts);

      const iso = IxTime.toIsoString(ts);
      expect(iso).toBe(new Date(ts).toISOString());

      expect(IxTime.toDate(null)).toBeNull();
      expect(IxTime.toIsoString(null)).toBeNull();
    });
  });
});
