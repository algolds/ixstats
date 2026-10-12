import { render, waitFor } from "@testing-library/react";

type AcquireOpts = { onReady?: (map: object, info: { styleReset: boolean }) => void };

jest.mock("~/lib/maps/map-engine", () => ({ acquireSurface: jest.fn() }));
jest.mock("~/components/maps/core/hooks/useWorldMapLayers", () => ({
  useWorldMapLayers: jest.fn(),
  forgetLoadedLayers: jest.fn(),
}));
jest.mock("~/components/maps/core/hooks/useWorldMapInteractions", () => ({
  useWorldMapInteractions: () => ({ updateDistanceFade: () => {} }),
}));
jest.mock("~/components/maps/core/hooks/useWorldMapOverlayFeatures", () => ({
  useWorldMapOverlayFeatures: jest.fn(),
}));
jest.mock("~/components/maps/core/hooks/useWorldMapDataOverlays", () => ({
  useWorldMapDataOverlays: jest.fn(),
}));
jest.mock("~/components/maps/core/hooks/useRealmMapLayers", () => ({
  useRealmMapLayers: jest.fn(),
}));
jest.mock("~/lib/maps/overlay-registry", () => ({ OVERLAY_LIST: [] }));

import IxWorldMap from "~/components/maps/core/IxWorldMap";
import { acquireSurface } from "~/lib/maps/map-engine";
import { forgetLoadedLayers } from "~/components/maps/core/hooks/useWorldMapLayers";

const fakeMap = { __mlgl: { Popup: jest.fn() } };

/** Mount the world map; the engine hands it the parked map, with or without its style put back. */
async function mountBorrowing(styleReset: boolean) {
  jest.mocked(acquireSurface).mockImplementation((_role, opts: AcquireOpts) => {
    const ready = Promise.resolve().then(() => opts.onReady?.(fakeMap, { styleReset }));
    return { ready, getMap: () => fakeMap, release: jest.fn() } as never;
  });
  const onReady = jest.fn();
  // A 0x0 container waits for a size; give jsdom one
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ width: 800, height: 600 } as DOMRect);
  render(<IxWorldMap layers={[]} onReady={onReady} />);
  await waitFor(() => expect(onReady).toHaveBeenCalled());
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("IxWorldMap borrowing the world map", () => {
  it("forgets what the map's sources held when the engine put the base style back", async () => {
    await mountBorrowing(true);
    expect(forgetLoadedLayers).toHaveBeenCalledWith(fakeMap);
  });

  it("keeps what they hold when the map comes back as it was left", async () => {
    await mountBorrowing(false);
    expect(forgetLoadedLayers).not.toHaveBeenCalled();
  });
});
