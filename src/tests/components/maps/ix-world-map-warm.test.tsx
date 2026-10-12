import { render, waitFor } from "@testing-library/react";

type AcquireOpts = { onReady?: (map: object, info: { styleReset: boolean }) => void };

jest.mock("~/lib/maps/map-engine", () => ({
  acquireSurface: jest.fn(),
  setSurfaceWarmKey: jest.fn(),
}));
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
import { acquireSurface, setSurfaceWarmKey } from "~/lib/maps/map-engine";
import { forgetLoadedLayers } from "~/components/maps/core/hooks/useWorldMapLayers";

const fakeMap = { __mlgl: { Popup: jest.fn() } };

/** Mount the world map; the engine hands it the parked map, with or without its style put back. */
async function mountBorrowing(
  styleReset: boolean,
  tileSource?: { realmId: string; version: number }
) {
  jest.mocked(acquireSurface).mockImplementation((_role, opts: AcquireOpts) => {
    const ready = Promise.resolve().then(() => opts.onReady?.(fakeMap, { styleReset }));
    return { ready, getMap: () => fakeMap, release: jest.fn() } as never;
  });
  const onReady = jest.fn();
  // A 0x0 container waits for a size; give jsdom one
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ width: 800, height: 600 } as DOMRect);
  const view = render(<IxWorldMap layers={[]} onReady={onReady} tileSource={tileSource} />);
  await waitFor(() => expect(onReady).toHaveBeenCalled());
  return view;
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

  it("tells the engine which realm it shows, so a map parked for another realm starts clean", async () => {
    await mountBorrowing(false, { realmId: "r_eurth", version: 2 });

    expect(acquireSurface).toHaveBeenCalledWith(
      "world",
      expect.objectContaining({ warmKey: "r_eurth" })
    );
  });

  it("names the realm to the engine once the map is up, and again when it changes", async () => {
    const view = await mountBorrowing(false, { realmId: "r_eurth", version: 2 });
    expect(setSurfaceWarmKey).toHaveBeenCalledWith("world", "r_eurth");

    view.rerender(<IxWorldMap layers={[]} tileSource={{ realmId: "default", version: 7 }} />);
    expect(setSurfaceWarmKey).toHaveBeenLastCalledWith("world", "default");
  });

  it("names no realm while its map version is not known", async () => {
    await mountBorrowing(false);

    expect(acquireSurface).toHaveBeenCalledWith(
      "world",
      expect.objectContaining({ warmKey: undefined })
    );
    expect(setSurfaceWarmKey).not.toHaveBeenCalled();
  });
});
