import { IxTime } from "~/lib/ixtime";

const HOUR_MS = 3_600_000;

describe("multiplier changes are continuous", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
  });

  afterEach(() => {
    IxTime.clearMultiplierOverride();
    IxTime.clearTimeOverride();
    jest.useRealTimers();
  });

  it("1. pausing freezes the clock at the current game time", () => {
    const before = IxTime.getCurrentIxTime();
    IxTime.setMultiplierOverride(0);
    expect(IxTime.getCurrentIxTime()).toBe(before);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(before);
  });

  it("2. speeding up keeps the current game time and only changes the rate going forward", () => {
    const before = IxTime.getCurrentIxTime();
    IxTime.setNaturalMultiplier(4);
    expect(IxTime.getCurrentIxTime()).toBe(before);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(before + 4 * HOUR_MS);
  });

  it("3. returning to natural speed after a pause resumes from the paused time (no snap back)", () => {
    IxTime.setMultiplierOverride(0);
    const paused = IxTime.getCurrentIxTime();
    jest.advanceTimersByTime(HOUR_MS);

    const result = IxTime.setNaturalMultiplier(2);
    expect(result.isNatural).toBe(true);
    expect(IxTime.isMultiplierNatural()).toBe(true);
    expect(IxTime.getCurrentIxTime()).toBe(paused);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(paused + 2 * HOUR_MS);
  });

  it("4. convertToIxTime agrees with getCurrentIxTime under an override and does not rewrite history", () => {
    const beforeAnchor = Date.now() - HOUR_MS;
    const canonicalBeforeAnchor = IxTime.convertToIxTime(beforeAnchor);

    IxTime.setNaturalMultiplier(3);
    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.convertToIxTime(Date.now())).toBe(IxTime.getCurrentIxTime());
    expect(IxTime.convertToIxTime(beforeAnchor)).toBe(canonicalBeforeAnchor);

    IxTime.setMultiplierOverride(0);
    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.convertToIxTime(Date.now())).toBe(IxTime.getCurrentIxTime());
    expect(IxTime.convertToIxTime(beforeAnchor)).toBe(canonicalBeforeAnchor);
  });

  it("5. addMonths uses UTC month arithmetic and clamps to the last day of the month", () => {
    expect(IxTime.addMonths(Date.UTC(2041, 0, 31), 1)).toBe(Date.UTC(2041, 1, 28));
    expect(IxTime.addMonths(Date.UTC(2041, 2, 31, 15, 30), -1)).toBe(Date.UTC(2041, 1, 28, 15, 30));
    expect(IxTime.addMonths(Date.UTC(2041, 11, 15), 1)).toBe(Date.UTC(2042, 0, 15));
    expect(IxTime.addMonths(Date.UTC(2043, 1, 28), -12)).toBe(Date.UTC(2042, 1, 28));
  });

  it("6. an explicit time override followed by a pause reads back exactly", () => {
    const overrideTime = Date.UTC(2050, 0, 1);
    IxTime.setTimeOverride(overrideTime);
    IxTime.setMultiplierOverride(0);
    expect(IxTime.getCurrentIxTime()).toBe(overrideTime);

    jest.advanceTimersByTime(HOUR_MS);
    expect(IxTime.getCurrentIxTime()).toBe(overrideTime);
  });
});
