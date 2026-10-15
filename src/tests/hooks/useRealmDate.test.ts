/** The realm header's date ticks with the realm clock; without a clock it is the server's label. */
import { act, renderHook } from "@testing-library/react";
import { createRealmClock } from "~/lib/realms/realm-clock";
import { useRealmDate } from "~/hooks/useRealmDate";

const HOUR = 60 * 60 * 1000;
const REAL = Date.UTC(2026, 9, 14, 18, 0, 0);

describe("useRealmDate", () => {
  afterEach(() => jest.useRealTimers());

  it("moves the date on as the realm clock runs", () => {
    jest.useFakeTimers({ now: REAL });
    const clock = createRealmClock({
      globalNowMs: Date.UTC(2041, 5, 2, 9, 30),
      realNowMs: REAL,
      startDate: "1203-03-14",
      era: "AE",
      multiplier: 12,
    });
    const { result } = renderHook(() => useRealmDate(clock, "server label"));
    expect(result.current).toBe("14 March 1203 AE");
    // Two real hours at ×12 is one realm day.
    act(() => {
      jest.advanceTimersByTime(2 * HOUR + 60_000);
    });
    expect(result.current).toBe("15 March 1203 AE");
  });

  it("is the server's label without a clock", () => {
    const { result } = renderHook(() => useRealmDate(null, "14 Harvest 1203 AE"));
    expect(result.current).toBe("14 Harvest 1203 AE");
  });
});
