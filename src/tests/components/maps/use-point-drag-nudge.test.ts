import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { usePointDrag } from "~/components/maps/editor/hooks/usePointDrag";
import { NUDGE_SMALL } from "~/components/maps/editor/hooks/drag-utils";

/** A map with no sources; every other call is a no-op. */
function fakeMap() {
  const canvas = document.createElement("canvas");
  return new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "getCanvas") return () => canvas;
        if (name === "getSource" || name === "getLayer") return () => undefined;
        return () => {};
      },
    }
  ) as unknown as MapLibreMap;
}

afterEach(() => jest.useRealTimers());

describe("usePointDrag arrow-key nudge", () => {
  it("accumulates nudges without moving the feature itself, so the undo step records where it was", () => {
    jest.useFakeTimers();
    const city: EditorFeature = {
      id: "c1",
      type: "city",
      name: "Port",
      coordinates: [10, 20],
      properties: {},
    };
    const updatePointCoordinates = jest.fn().mockResolvedValue(undefined);
    const map = fakeMap();
    renderHook(() =>
      usePointDrag({
        map,
        isLoaded: true,
        mode: "view",
        features: [city],
        selectedFeature: city,
        updatePointCoordinates,
      })
    );
    const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const saved = () => updatePointCoordinates.mock.lastCall![2] as [number, number];

    press();
    press();
    expect(city.coordinates).toEqual([10, 20]);
    jest.advanceTimersByTime(400);
    expect(updatePointCoordinates).toHaveBeenCalledTimes(1);
    expect(saved()[0]).toBeCloseTo(10 + 2 * NUDGE_SMALL, 9);

    // A later burst carries on from where the last one left the point
    press();
    jest.advanceTimersByTime(400);
    expect(saved()[0]).toBeCloseTo(10 + 3 * NUDGE_SMALL, 9);
    expect(city.coordinates).toEqual([10, 20]);
  });
});
