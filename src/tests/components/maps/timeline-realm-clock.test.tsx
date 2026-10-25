/**
 * The map's historical timeline runs on BorderHistory's real-time stamps and reads its dates and years on the
 * viewed realm's clock, in its calendar.
 */
import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { DAY, REAL_NOW, sixTimesReader } from "~/tests/fixtures/realm-readers";

const frost = sixTimesReader();
jest.mock("~/hooks/useRealmClock", () => ({
  useRealmClock: (realmId: string | undefined) => (realmId === "realm-frost" ? frost : null),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    geoCore: {
      getHistoryRange: {
        useQuery: () => ({
          data: { minTime: REAL_NOW, maxTime: REAL_NOW + DAY, realmId: "realm-frost" },
          isLoading: false,
        }),
      },
      getWorldMapAsOf: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

// The slider measures itself (Radix use-size); jsdom has no ResizeObserver.
jest.mock("~/components/ui/slider", () => ({ Slider: () => null }));

import { TimelineScrubber, timelineDate } from "~/components/maps/core/TimelineScrubber";
import { useHistoricalMapLayers } from "~/components/maps/core/hooks/useHistoricalMapLayers";

describe("map timeline on the realm clock", () => {
  it("dates a real moment on the realm's clock, '–' while it loads", () => {
    expect(timelineDate(REAL_NOW, frost)).toBe("14 Thaw 812 AE");
    expect(timelineDate(REAL_NOW, null)).toBe("–");
  });

  it("shows the range ends in the viewed realm's calendar", () => {
    render(<TimelineScrubber value={null} onChange={jest.fn()} realm="frost" />);
    fireEvent.click(screen.getByRole("button", { name: /Timeline/ }));
    // A real day is six days on the 6× clock.
    expect(screen.getByText("14 Thaw 812 AE")).toBeInTheDocument();
    expect(screen.getByText("20 Thaw 812 AE")).toBeInTheDocument();
  });

  it("reads the scrubbed year in the realm's calendar", () => {
    const { result } = renderHook(() => useHistoricalMapLayers([], undefined, "frost"));
    expect(result.current.historicalYear).toBeNull();
    act(() => result.current.setHistoricalIxTime(REAL_NOW));
    expect(result.current.historicalYear).toBe(812);
  });
});
