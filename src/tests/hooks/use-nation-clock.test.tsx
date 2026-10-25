/**
 * The clock of the nation in view: a country with a realm id reads its realm's clock, otherwise the nearest
 * provider's; null outside any nation. `useClockNow` re-reads it on its own tick, quantised.
 */
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { NationClockProvider, useClockNow, useNationClock } from "~/hooks/useNationClock";
import { CLOCK_NOW, REAL_NOW, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

const frost = sixTimesReader();
jest.mock("~/hooks/useRealmClock", () => ({
  useCountryClock: (country: { realmId?: string | null } | null) =>
    country?.realmId === "realm-frost" ? frost : null,
}));

const withProvider =
  (value: ReturnType<typeof ixnayReader> | null) =>
  ({ children }: { children: React.ReactNode }) => (
    <NationClockProvider value={value}>{children}</NationClockProvider>
  );

describe("useNationClock", () => {
  it("reads the provider's clock when no country is given", () => {
    const ixnay = ixnayReader();
    const { result } = renderHook(() => useNationClock(), { wrapper: withProvider(ixnay) });
    expect(result.current).toBe(ixnay);
  });

  it("prefers the given country's realm clock over the provider's", () => {
    const { result } = renderHook(() => useNationClock({ realmId: "realm-frost" }), {
      wrapper: withProvider(ixnayReader()),
    });
    expect(result.current).toBe(frost);
  });

  it("falls back to the provider when the country carries no realm id", () => {
    const ixnay = ixnayReader();
    const { result } = renderHook(() => useNationClock({}), { wrapper: withProvider(ixnay) });
    expect(result.current).toBe(ixnay);
  });

  it("is null outside any nation", () => {
    const { result } = renderHook(() => useNationClock());
    expect(result.current).toBeNull();
  });
});

describe("useClockNow", () => {
  afterEach(() => jest.useRealTimers());

  it("re-reads the clock each step at the realm's speed", () => {
    jest.useFakeTimers({ now: REAL_NOW });
    const reader = sixTimesReader(() => Date.now());
    const { result } = renderHook(() => useClockNow(reader, 60_000));
    expect(result.current).toBe(Math.floor(CLOCK_NOW / 60_000) * 60_000);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    // One real minute is six minutes in a 6× realm.
    expect(result.current).toBe(Math.floor((CLOCK_NOW + 6 * 60_000) / 60_000) * 60_000);
  });

  it("is null while the clock loads", () => {
    const { result } = renderHook(() => useClockNow(null));
    expect(result.current).toBeNull();
  });
});
