/**
 * The World tab's presets come from the database: the published ones are offered by their names, a preset's own
 * values reach the generator, and a saved recipe naming a preset that is gone becomes Earth-like.
 */
import { fireEvent, screen, within } from "@testing-library/react";

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
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});

import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import { loadWorldRecipe, saveWorldRecipe } from "~/lib/worldgen/world-draft-recipe";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import {
  cleanUpPanelTests,
  factory,
  generateFirst,
  lastRequest,
  presetsQuery,
  REALM,
  renderPanel,
  requestCount,
  resetPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);

const badlands: WorldPresetOption = {
  slug: "badlands",
  name: "Badlands",
  params: { continentCount: 4, temperatureOffset: 6, terrainRoughness: 0.9, hasIcecaps: false },
};
const published = [FACTORY_PRESETS[0]!, badlands];
const offered = () =>
  within(screen.getByRole("radiogroup", { name: "Preset" })).getAllByRole("radio");

describe("the presets of the World tab", () => {
  it("offers the published presets by the names they have in the database", () => {
    presetsQuery.mockReturnValue({ data: published, isError: false });
    renderPanel();
    expect(offered().map((radio) => radio.getAttribute("aria-label") ?? radio.textContent)).toEqual(
      ["Earth-like", "Badlands"]
    );
    expect(screen.queryByRole("radio", { name: "Ixnay" })).toBeNull();
  });

  it("gives the generator a picked preset's values, those no control names among them", async () => {
    presetsQuery.mockReturnValue({ data: published, isError: false });
    renderPanel();
    await generateFirst();
    fireEvent.click(screen.getByRole("radio", { name: "Badlands" }));
    expect(lastRequest().params).toMatchObject({
      continentCount: 4,
      temperatureOffset: 6,
      terrainRoughness: 0.9,
      hasIcecaps: false,
    });
    expect(screen.getByRole("slider", { name: "Temperature" })).toHaveAttribute(
      "aria-valuenow",
      "6"
    );
  });

  it("shows the published Earth-like values on a fresh start, not the factory ones", () => {
    const tuned = { ...FACTORY_PRESETS[0]!, params: { continentCount: 8 } };
    presetsQuery.mockReturnValue({ data: [tuned], isError: false });
    renderPanel();
    expect(screen.getByRole("slider", { name: "Continents" })).toHaveAttribute(
      "aria-valuenow",
      "8"
    );
  });

  it("makes no world while the presets load, and offers the built-ins if they cannot be read", () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: false });
    const loading = renderPanel();
    expect(screen.getByText("Loading the presets.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(requestCount()).toBe(0);
    loading.unmount();

    presetsQuery.mockReturnValue({ data: undefined, isError: true });
    renderPanel();
    expect(offered()).toHaveLength(FACTORY_PRESETS.length);
  });

  it("generates a saved recipe whose preset is gone as Earth-like, and saves it so", () => {
    presetsQuery.mockReturnValue({ data: published, isError: false });
    saveWorldRecipe(REALM, {
      seed: 91,
      controls: { ...controlsForPreset("ixnay"), rivers: 1.3 },
    });
    renderPanel();
    expect(lastRequest()).toMatchObject({ seed: 91 });
    expect(lastRequest().params).toMatchObject({
      hypsometry: DEFAULT_PARAMS.hypsometry,
      riverDensity: 1.3,
    });
    expect(screen.getByRole("radio", { name: "Earth-like" })).toBeChecked();
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({
      preset: "earthlike",
      hypsometry: "earthlike",
      rivers: 1.3,
    });
  });

  it("waits for the presets before bringing a saved preview back", () => {
    saveWorldRecipe(REALM, { seed: 91, controls: controlsForPreset("eurth") });
    presetsQuery.mockReturnValue({ data: undefined, isError: false });
    const view = renderPanel();
    expect(requestCount()).toBe(0);
    presetsQuery.mockReturnValue({ data: FACTORY_PRESETS, isError: false });
    view.rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(lastRequest()).toMatchObject({ seed: 91 });
  });

  it("replays a Generate click made while the presets load, once they arrive", () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: false });
    const view = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(requestCount()).toBe(0);
    presetsQuery.mockReturnValue({ data: published, isError: false });
    view.rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(1);
    view.rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(1);
  });

  it("does not replay anything when no click was made while the presets loaded", () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: false });
    const view = renderPanel();
    presetsQuery.mockReturnValue({ data: published, isError: false });
    view.rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(requestCount()).toBe(0);
  });

  it("generates from the built-ins when the presets cannot be read, so Generate still works", async () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: true });
    renderPanel();
    await generateFirst();
    expect(requestCount()).toBe(1);
  });

  it("never writes the built-ins' stand-in choice over a founder's saved recipe", async () => {
    saveWorldRecipe(REALM, {
      seed: 91,
      controls: { ...controlsForPreset("badlands", published), rivers: 1.3 },
    });
    presetsQuery.mockReturnValue({ data: undefined, isError: true });
    renderPanel();
    // The preview is made, as Earth-like, but the stored choice stays the founder's
    expect(requestCount()).toBe(1);
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands", rivers: 1.3 });
    fireEvent.click(screen.getByRole("radio", { name: "Eurth" }));
    expect(requestCount()).toBe(2);
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands" });
  });

  it("saves the recipe again once the real presets are in use", async () => {
    presetsQuery.mockReturnValue({ data: published, isError: false });
    renderPanel();
    await generateFirst();
    fireEvent.click(screen.getByRole("radio", { name: "Badlands" }));
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands" });
  });
});
