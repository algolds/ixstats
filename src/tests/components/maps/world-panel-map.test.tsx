/**
 * The World tab and the realm's own map: it is a source only when the realm has borders and its layers have settled,
 * a layer that fails is an error with Try again and fits nothing, and a world fitted to the map is made again when the
 * map's version moves, and not when the same map is read again.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const { createMockQuery } = jest.requireActual("../../../../jest-mocks/trpc-react");
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  return {
    api: {
      useUtils: fake.useUtils,
      geoEditor: fake.geoEditor,
      realms: {
        map: {
          display: { useQuery: jest.fn(() => createMockQuery()) },
          worldStatus: { useQuery: jest.fn(() => createMockQuery()) },
          worldPresets: { useQuery: jest.fn(() => createMockQuery()) },
        },
      },
    },
  };
});
jest.mock("~/hooks/useWorldPreview", () => ({ useWorldPreview: jest.fn() }));
jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));
// The real region, called through, so its props can be read
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});

import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import { saveWorldRecipe } from "~/lib/worldgen/world-draft-recipe";
import { resultMessage } from "~/tests/helpers/fake-world-worker";
import {
  displayQuery,
  layersQuery,
  retryLayers,
  region,
  REALM,
  display,
  mapLayers,
  workers,
  factory,
  renderPanel,
  lastRequest,
  requestCount,
  generateFirst,
  step,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);

describe("this realm's map", () => {
  const sourceControl = () => screen.getByRole("radiogroup", { name: "Source" });

  it("is a source once the realm has borders, and fits the world around them", async () => {
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    const request = lastRequest();
    expect(request.keepBorders).toBe(true);
    expect(request.landMaskLayers).toMatchObject({
      background: expect.objectContaining({ type: "FeatureCollection" }),
      political: expect.objectContaining({ type: "FeatureCollection" }),
    });
    expect(request.landMaskLayers?.political?.features).toHaveLength(2);
    expect(request.landMaskLayers).not.toHaveProperty("rivers");
  });

  it("says the land and borders stay as drawn and that only the layers the realm lacks are generated", () => {
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    expect(
      screen.getByText(
        "The land and the borders stay as the realm drew them. Climate, rivers, lakes and elevation are generated around them, except for any the realm already has."
      )
    ).toBeInTheDocument();
  });

  it("turns off what the realm's map decides", () => {
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    expect(screen.getByRole("slider", { name: "Continents" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("slider", { name: "Temperature" })).not.toHaveAttribute(
      "data-disabled"
    );
  });

  it("is disabled, with a link to Map import, while the realm has no political layer", () => {
    displayQuery.mockReturnValue(display({ layerTypes: ["background"] }));
    renderPanel();
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Import one under Map import/ })).toHaveAttribute(
      "href",
      "/r/eurth/manage#map-import"
    );
  });

  it("waits for every layer of the map to settle before it can be chosen", () => {
    layersQuery.mockReturnValue(mapLayers({ pending: true }));
    renderPanel();
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByText("Loading the realm's map.")).toBeInTheDocument();
  });

  it("says so when the map could not be loaded at all", () => {
    layersQuery.mockReturnValue(mapLayers({ political: 0 }));
    renderPanel();
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
  });

  it("fits a map whose altitude layer came back empty or absent, using what arrived", () => {
    layersQuery.mockReturnValue(mapLayers({ political: 4, background: 1 }));
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    expect(lastRequest().landMaskLayers).not.toHaveProperty("altitudes");
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(4);
  });

  it("hands over the altitude layer too when the realm has one", () => {
    layersQuery.mockReturnValue(mapLayers({ altitudes: 5 }));
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    expect(lastRequest().landMaskLayers?.altitudes?.features).toHaveLength(5);
  });

  it("makes no world from a map still arriving, and uses the latest controls once it has settled", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    // The political layer is in, the rest is not: not a map to fit a world around yet
    layersQuery.mockReturnValue(mapLayers({ pending: true }));
    const { rerender } = renderPanel();
    step("Temperature");
    expect(requestCount()).toBe(0);
    layersQuery.mockReturnValue(mapLayers({ background: 3, altitudes: 2 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(1);
    expect(lastRequest().params).toMatchObject({ temperatureOffset: 0.5 });
    expect(lastRequest().landMaskLayers?.background?.features).toHaveLength(3);
    expect(lastRequest().landMaskLayers?.altitudes?.features).toHaveLength(2);
  });

  it("brings back a saved fit once the layers have settled", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    layersQuery.mockReturnValue(mapLayers({ political: 0, pending: true }));
    const { rerender } = renderPanel();
    expect(requestCount()).toBe(0);
    layersQuery.mockReturnValue(mapLayers({ political: 3 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(lastRequest()).toMatchObject({ seed: 9, keepBorders: true });
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(3);
  });
});

describe("a realm map that could not be loaded", () => {
  const sourceControl = () => screen.getByRole("radiogroup", { name: "Source" });
  const FAILED = () =>
    mapLayers({ error: new Error("Map layer altitudes could not be loaded (500)") });

  it("is an error with Try again, not a map to fit: a layer that failed is not settled", () => {
    // The borders are there, the elevation layer is not
    layersQuery.mockReturnValue(FAILED());
    renderPanel();
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByText(/The realm's map could not be loaded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryLayers).toHaveBeenCalledTimes(1);
  });

  it("is an error, not a spinner, when the map's version could not be read (the layers wait for it for good)", () => {
    layersQuery.mockReturnValue(
      mapLayers({ pending: true, error: new Error("Realm not found"), political: 0 })
    );
    renderPanel();
    expect(screen.getByText(/The realm's map could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText("Loading the realm's map.")).toBeNull();
  });

  it("makes no world from a saved fit while a layer is missing, and fits the map once it has arrived", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    layersQuery.mockReturnValue(FAILED());
    const { rerender } = renderPanel();
    expect(requestCount()).toBe(0);
    layersQuery.mockReturnValue(mapLayers({ altitudes: 3 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(1);
    expect(lastRequest().landMaskLayers?.altitudes?.features).toHaveLength(3);
  });

  it("does not fit a world to the map by choosing the source while a layer is missing", () => {
    layersQuery.mockReturnValue(FAILED());
    renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    expect(requestCount()).toBe(0);
  });

  it("holds back Use this world for a draft fitted to the map when a layer then fails", () => {
    const { rerender } = renderPanel();
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    expect(screen.getByRole("button", { name: "Use this world" })).toBeEnabled();
    layersQuery.mockReturnValue(FAILED());
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(screen.getByRole("button", { name: "Use this world" })).toBeDisabled();
  });
});

describe("a realm map read again", () => {
  /** The panel with a world fitted to the map at version 5, delivered. */
  function fittedAt(version: number) {
    layersQuery.mockReturnValue(mapLayers({ version }));
    const view = renderPanel();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Source" })).getByRole("radio", {
        name: "This realm's map",
      })
    );
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    return view;
  }

  it("does not start the worker again when the layers come back as new objects of the same map", () => {
    const { rerender } = fittedAt(5);
    const before = requestCount();
    for (let render = 0; render < 4; render++) {
      layersQuery.mockReturnValue(mapLayers({ version: 5 }));
      rerender(<WorldPanel map={null} createWorker={factory} />);
    }
    expect(requestCount()).toBe(before);
    expect(region.mock.lastCall![0].stale).toBe(false);
  });

  it("fits the world again, once, when the map has moved to a new version", () => {
    const { rerender } = fittedAt(5);
    const before = requestCount();
    // The worker keeps its mask by the realm and the map's version
    expect(lastRequest().maskKey).toMatch(/:5$/);
    layersQuery.mockReturnValue(mapLayers({ version: 6, political: 4 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(before + 1);
    expect(lastRequest().maskKey).toMatch(/:6$/);
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(4);
    layersQuery.mockReturnValue(mapLayers({ version: 6, political: 4 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(before + 1);
  });

  it("calls the draft stale from the moment the version moves until it is fitted again", () => {
    const { rerender } = fittedAt(5);
    layersQuery.mockReturnValue(mapLayers({ version: 6, pending: true }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(region.mock.lastCall![0].stale).toBe(true);
  });
});

describe("a world fitted to the realm's map", () => {
  /** The panel with a world fitted to the map and delivered; `reload` is the map changing under it. */
  function fitted() {
    const view = render(<WorldPanel map={null} createWorker={factory} />);
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Source" })).getByRole("radio", {
        name: "This realm's map",
      })
    );
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    return {
      ...view,
      reload: (layers: ReturnType<typeof mapLayers>) => {
        layersQuery.mockReturnValue(layers);
        view.rerender(<WorldPanel map={null} createWorker={factory} />);
      },
    };
  }

  it("is generated again when the realm's map changes under it", () => {
    const { reload } = fitted();
    const before = requestCount();
    reload(mapLayers({ political: 5 }));
    expect(requestCount()).toBe(before + 1);
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(5);
    expect(lastRequest().keepBorders).toBe(true);
  });

  it("waits while the new map loads, then fits it once", () => {
    const { reload } = fitted();
    const before = requestCount();
    reload(mapLayers({ political: 6, pending: true }));
    expect(requestCount()).toBe(before);
    const settled = mapLayers({ political: 6 });
    reload(settled);
    expect(requestCount()).toBe(before + 1);
    reload(settled);
    expect(requestCount()).toBe(before + 1);
  });

  it("is not generated again for a world made from a preset", async () => {
    const { rerender } = render(<WorldPanel map={null} createWorker={factory} />);
    await generateFirst();
    const before = requestCount();
    layersQuery.mockReturnValue(mapLayers({ political: 5 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(before);
  });

  it("is not brought back after the draft was discarded", () => {
    const { reload } = fitted();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    const before = requestCount();
    reload(mapLayers({ political: 5 }));
    expect(requestCount()).toBe(before);
  });
});
