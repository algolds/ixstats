/**
 * The World tab and the realm's own map: it is a source only when the realm has borders and its layers have settled,
 * a layer that fails is an error with Try again and fits nothing, and a world fitted to the map is made again when the
 * map's version moves, and not when the same map is read again.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";

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
  layersQuery,
  retryLayers,
  region,
  REALM,
  mapLayers,
  workers,
  factory,
  renderPanel,
  lastRequest,
  requestCount,
  step,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);

describe("this realm's map", () => {
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

  it("calls the draft stale from the moment the version moves until it is fitted again", () => {
    const { rerender } = fittedAt(5);
    layersQuery.mockReturnValue(mapLayers({ version: 6, pending: true }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(region.mock.lastCall![0].stale).toBe(true);
  });
});
