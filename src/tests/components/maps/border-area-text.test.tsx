import { act, render, screen } from "@testing-library/react";

jest.mock("~/components/maps/core/hooks/useRealmMapDisplay", () => ({
  useRealmPlanetRadius: () => 6371,
  formatPlanetArea: (area: number) => `${Math.round(area)} km2`,
}));

import { BorderAreaText } from "~/components/maps/editor/components/BorderAreaText";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";

describe("BorderAreaText", () => {
  afterEach(() => {
    transientMapStore.setBorderAreaKm2(null);
    jest.restoreAllMocks();
  });

  it("shows the committed area, then the live one while a vertex is dragged", () => {
    const queue: FrameRequestCallback[] = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => queue.push(cb));
    render(<BorderAreaText committed={1000} />);
    expect(screen.getByText("1000 km2")).toBeTruthy();

    transientMapStore.setBorderAreaKm2(1234);
    act(() => queue.splice(0).forEach((cb) => cb(0)));
    expect(screen.getByText("1234 km2")).toBeTruthy();

    transientMapStore.setBorderAreaKm2(null);
    act(() => queue.splice(0).forEach((cb) => cb(0)));
    expect(screen.getByText("1000 km2")).toBeTruthy();
  });
});
