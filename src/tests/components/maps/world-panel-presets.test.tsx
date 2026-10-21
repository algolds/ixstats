/**
 * The World tab's presets come from the database: the published ones are offered by their names, a preset's own
 * values reach the generator, and a saved recipe naming a preset that is gone becomes Earth-like.
 */
import { fireEvent, screen } from "@testing-library/react";

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
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import { loadWorldRecipe, saveWorldRecipe } from "~/lib/worldgen/world-draft-recipe";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import {
  cleanUpPanelTests,
  settle,
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
describe("the presets of the World tab", () => {
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
  it("never writes the built-ins' stand-in choice over a founder's saved recipe", async () => {
    saveWorldRecipe(REALM, {
      seed: 91,
      controls: { ...controlsForPreset("badlands", published), rivers: 1.3 },
    });
    presetsQuery.mockReturnValue({ data: undefined, isError: true });
    renderPanel();
    // The preview is made, as Earth-like, but the stored choice stays the founder's
    expect(requestCount()).toBe(1);
    settle();
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands", rivers: 1.3 });
    fireEvent.click(screen.getByRole("radio", { name: "Eurth" }));
    expect(requestCount()).toBe(2);
    expect(loadWorldRecipe(REALM)?.controls).toMatchObject({ preset: "badlands" });
  });
});
