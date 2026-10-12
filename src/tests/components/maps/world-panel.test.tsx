/**
 * The World tab: the controls ask the generator for the right world, a slider asks when it is released, the draft
 * recipe is kept per realm and brings the preview back, the realm's own map is a source only when it has one, the
 * lock explains itself without stopping a preview, and the studio's sandbox has a calibration readout and no apply
 * region. The worker is a fake that the test speaks for.
 */
import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

jest.mock("~/trpc/react", () => {
  const { createMockQuery } = jest.requireActual("../../../../jest-mocks/trpc-react");
  return {
    api: {
      realms: {
        map: {
          display: { useQuery: jest.fn(() => createMockQuery()) },
          worldStatus: { useQuery: jest.fn(() => createMockQuery()) },
        },
      },
    },
  };
});
jest.mock("~/hooks/useWorldPreview", () => ({ useWorldPreview: jest.fn() }));

import { api } from "~/trpc/react";
import { useWorldPreview } from "~/hooks/useWorldPreview";
import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  loadWorldRecipe,
  saveWorldRecipe,
  worldRecipeKey,
} from "~/lib/worldgen/world-draft-recipe";
import { fakeWorldWorkers, resultMessage } from "~/tests/helpers/fake-world-worker";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

const displayQuery = jest.mocked(api.realms.map.display.useQuery as unknown as jest.Mock);
const statusQuery = jest.mocked(api.realms.map.worldStatus.useQuery as unknown as jest.Mock);
const preview = jest.mocked(useWorldPreview);

const REALM = "r_eurth";
const display = (over: Record<string, unknown> = {}) => ({
  data: {
    realmId: REALM,
    realmSlug: "eurth",
    isIxnay: false,
    canEdit: true,
    layerTypes: ["background", "political"],
    rasterLayers: [],
    ...over,
  },
});
const OPEN = { data: { lockReason: null, pendingClaims: 0, approvedClaims: 0 } };

const polygons = (n: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  })),
});
const layers = (political = 2): MapLayerData[] => [
  { type: "background", data: polygons(1), visible: true },
  { type: "political", data: polygons(political), visible: true },
];

let workers: ReturnType<typeof fakeWorldWorkers>["workers"];
let factory: ReturnType<typeof fakeWorldWorkers>["factory"];

beforeAll(stubResizeObserver);
beforeEach(() => {
  window.localStorage.clear();
  ({ factory, workers } = fakeWorldWorkers());
  displayQuery.mockReturnValue(display());
  statusQuery.mockReturnValue(OPEN);
  preview.mockReset();
  preview.mockReturnValue({ active: false });
});
afterEach(() => {
  transientMapStore.setWorldDraft(null);
  jest.restoreAllMocks();
});

const renderPanel = (props: Partial<React.ComponentProps<typeof WorldPanel>> = {}) =>
  render(<WorldPanel map={null} mapLayers={layers()} createWorker={factory} {...props} />);

const lastRequest = () => workers.at(-1)!.posted.at(-1)!;
const requestCount = () => workers.reduce((n, w) => n + w.posted.length, 0);

async function generateFirst() {
  fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
  return lastRequest();
}

const step = (name: string, key = "ArrowRight") =>
  fireEvent.keyDown(screen.getByRole("slider", { name }), { key });

describe("generating", () => {
  it("makes no world until asked, then generates from the Earth-like controls", async () => {
    renderPanel();
    expect(requestCount()).toBe(0);
    const request = await generateFirst();
    expect(request).toMatchObject({ type: "generate" });
    expect(request.params).toMatchObject({ continentCount: 6, oceanPercentage: 0.7 });
    expect(request.landMaskLayers).toBeUndefined();
    expect(request.keepBorders).toBeUndefined();
  });

  it("asks for a new world when a slider is released, with that parameter changed", async () => {
    renderPanel();
    await generateFirst();
    const before = requestCount();
    step("Continents");
    expect(requestCount()).toBe(before + 1);
    expect(lastRequest().params).toMatchObject({ continentCount: 7 });
    expect(screen.getByRole("slider", { name: "Continents" })).toHaveAttribute(
      "aria-valuenow",
      "7"
    );
  });

  it("keeps the seed through a slider change and gives a reroll a new one", async () => {
    renderPanel();
    const first = await generateFirst();
    step("Land share");
    expect(lastRequest().seed).toBe(first.seed);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    fireEvent.click(screen.getByRole("button", { name: "Reroll seed" }));
    expect(lastRequest().seed).toBe(1 + Math.floor(0.5 * (2 ** 31 - 1)));
    expect(lastRequest().seed).not.toBe(first.seed);
  });

  it("takes a seed typed in on Enter", async () => {
    renderPanel();
    await generateFirst();
    const field = screen.getByLabelText("Seed");
    fireEvent.change(field, { target: { value: "4242" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(lastRequest().seed).toBe(4242);
  });

  it("moves every control to the preset's values when a preset is picked", async () => {
    renderPanel();
    await generateFirst();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Preset" })).getByRole("radio", {
        name: "Ixnay",
      })
    );
    expect(lastRequest().params).toMatchObject({
      continentCount: WORLD_PRESETS.ixnay.continentCount,
      oceanPercentage: WORLD_PRESETS.ixnay.oceanPercentage,
      temperatureOffset: WORLD_PRESETS.ixnay.temperatureOffset,
      precipitationScale: WORLD_PRESETS.ixnay.precipitationScale,
      hypsometry: WORLD_PRESETS.ixnay.hypsometry,
    });
    expect(screen.getByRole("slider", { name: "Temperature" })).toHaveAttribute(
      "aria-valuenow",
      "1.5"
    );
  });

  it("keeps the development level when a preset is picked, and asks for a world when it changes", async () => {
    renderPanel();
    await generateFirst();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Development level" })).getByRole("radio", {
        name: "Modern",
      })
    );
    expect(lastRequest().params).toMatchObject({ developmentLevel: "modern" });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Preset" })).getByRole("radio", {
        name: "Eurth",
      })
    );
    expect(lastRequest().params).toMatchObject({ developmentLevel: "modern", continentCount: 5 });
  });

  it("reaches the advanced controls through the Advanced section", async () => {
    renderPanel();
    await generateFirst();
    expect(screen.queryByRole("slider", { name: "Islands" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    step("Islands");
    expect(lastRequest().params).toMatchObject({ islandShare: 0.07 });
    fireEvent.click(screen.getByRole("switch", { name: "Polar land in the north" }));
    expect(lastRequest().params).toMatchObject({ polarLand: { north: true, south: true } });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Elevation profile" })).getByRole("radio", {
        name: "Rugged",
      })
    );
    expect(lastRequest().params).toMatchObject({ hypsometry: WORLD_PRESETS.eurth.hypsometry });
  });

  it("shows the draft's statistics once the worker answers", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() =>
      workers[0]!.say(
        resultMessage(request.id, {
          seed: request.seed,
          stats: {
            landShare: 0.231,
            continents: 6,
            climateMix: { A: 0.4, D: 0.6 },
            slotCount: 12,
            baseline: {
              population: { min: 120_000, max: 4_200_000 },
              gdpPerCapita: { min: 6100, max: 7400 },
            },
          },
        })
      )
    );
    const stats = screen.getByLabelText("Draft world statistics");
    expect(within(stats).getByText("23.1%")).toBeInTheDocument();
    expect(within(stats).getByText("12")).toBeInTheDocument();
    expect(within(stats).getByText("$6,100 to $7,400")).toBeInTheDocument();
    expect(within(stats).getByText("Tropical")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate preview" })).toBeNull();
  });

  it("says why a world could not be made and tries again", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say({ type: "error", id: request.id, message: "The mesh failed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The mesh failed");
    const before = requestCount();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(requestCount()).toBe(before + 1);
  });
});

describe("the preview", () => {
  it("is drawn on the map the editor gives it, from the generator's world", async () => {
    const map = { fake: "map" } as never;
    renderPanel({ map });
    const request = await generateFirst();
    expect(preview).toHaveBeenLastCalledWith(map, null);
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(preview).toHaveBeenLastCalledWith(map, expect.objectContaining({ seed: 7 }));
  });

  it("tells the status bar about the draft while it is made and while it is on the map", async () => {
    renderPanel();
    expect(transientMapStore.getSnapshot().worldDraft).toBeNull();
    const request = await generateFirst();
    act(() =>
      workers[0]!.say({
        type: "progress",
        id: request.id,
        stage: "terrain",
        pct: 30,
        message: "Computing terrain",
      })
    );
    expect(transientMapStore.getSnapshot().worldDraft).toEqual({ message: "Computing terrain" });
    preview.mockReturnValue({ active: true });
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(transientMapStore.getSnapshot().worldDraft).toEqual({ message: "" });
  });

  it("takes the draft off the status bar when the tab closes", async () => {
    const { unmount } = renderPanel();
    await generateFirst();
    expect(transientMapStore.getSnapshot().worldDraft).not.toBeNull();
    unmount();
    expect(transientMapStore.getSnapshot().worldDraft).toBeNull();
  });

  it("discards the draft and forgets the recipe", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(loadWorldRecipe(REALM)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(loadWorldRecipe(REALM)).toBeNull();
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeInTheDocument();
  });
});

describe("the draft recipe", () => {
  it("is saved with every world asked for", async () => {
    renderPanel();
    const request = await generateFirst();
    step("Nations");
    expect(loadWorldRecipe(REALM)).toMatchObject({
      seed: request.seed,
      controls: { source: "preset", preset: "earthlike", nations: 135 },
    });
  });

  it("brings the preview back when the tab is reopened", () => {
    saveWorldRecipe(REALM, {
      seed: 777,
      controls: { ...controlsForPreset("eurth"), continents: 3 },
    });
    renderPanel();
    expect(lastRequest()).toMatchObject({ seed: 777 });
    expect(lastRequest().params).toMatchObject({
      continentCount: 3,
      polarLand: { north: false, south: true },
    });
    expect(screen.getByRole("slider", { name: "Continents" })).toHaveAttribute(
      "aria-valuenow",
      "3"
    );
    expect(screen.getByRole("radio", { name: "Eurth" })).toBeChecked();
  });

  it("is generated again after a remount, as Strict Mode does on the first mount", () => {
    saveWorldRecipe(REALM, { seed: 31, controls: controlsForPreset("ixnay") });
    render(
      <StrictMode>
        <WorldPanel map={null} mapLayers={layers()} createWorker={factory} />
      </StrictMode>
    );
    // The worker of the trial mount was disposed with it; the one that stays has the request
    expect(workers.at(-1)!.terminated).toBe(false);
    expect(workers.at(-1)!.posted).toHaveLength(1);
    expect(workers.at(-1)!.posted[0]).toMatchObject({ seed: 31 });
  });

  it("is kept per realm", () => {
    saveWorldRecipe("r_other", { seed: 5, controls: controlsForPreset("ixnay") });
    renderPanel();
    expect(requestCount()).toBe(0);
  });

  it("starts empty, without failing, when storage throws", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    renderPanel();
    expect(requestCount()).toBe(0);
    await generateFirst();
    step("Continents");
    expect(lastRequest().params).toMatchObject({ continentCount: 7 });
  });

  it("ignores a stored recipe that is not valid", () => {
    window.localStorage.setItem(worldRecipeKey(REALM), JSON.stringify({ seed: "soon" }));
    renderPanel();
    expect(requestCount()).toBe(0);
  });

  it("falls back to a preset when the saved source was the realm's map and it has none now", () => {
    saveWorldRecipe(REALM, {
      seed: 12,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    displayQuery.mockReturnValue(display({ layerTypes: [] }));
    renderPanel({ mapLayers: [] });
    expect(requestCount()).toBe(0);
    expect(screen.getByRole("radio", { name: "Preset" })).toBeChecked();
  });

  it("starts afresh on another realm", async () => {
    const { rerender } = renderPanel();
    await generateFirst();
    displayQuery.mockReturnValue(display({ realmId: "r_other", realmSlug: "other" }));
    rerender(<WorldPanel map={null} mapLayers={layers()} createWorker={factory} />);
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeInTheDocument();
  });
});

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
    renderPanel({ mapLayers: [] });
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Import one under Map import/ })).toHaveAttribute(
      "href",
      "/r/eurth/manage#map-import"
    );
  });

  it("waits for the layers to load before it can be chosen", () => {
    renderPanel({ mapLayers: layers(0) });
    expect(within(sourceControl()).getByRole("radio", { name: "This realm's map" })).toBeDisabled();
    expect(screen.getByText("Loading the realm's map.")).toBeInTheDocument();
  });

  it("makes no world from a half-loaded map, and uses the latest controls once it has loaded", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    const { rerender } = renderPanel({ mapLayers: layers(0) });
    step("Temperature");
    expect(requestCount()).toBe(0);
    rerender(<WorldPanel map={null} mapLayers={layers(2)} createWorker={factory} />);
    expect(requestCount()).toBe(1);
    expect(lastRequest().params).toMatchObject({ temperatureOffset: 0.5 });
  });

  it("brings back a saved fit once the layers have loaded", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    const { rerender } = renderPanel({ mapLayers: layers(0) });
    expect(requestCount()).toBe(0);
    rerender(<WorldPanel map={null} mapLayers={layers(3)} createWorker={factory} />);
    expect(lastRequest()).toMatchObject({ seed: 9, keepBorders: true });
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(3);
  });
});

describe("the lock", () => {
  const LOCKED = {
    data: { lockReason: "claims", pendingClaims: 2, approvedClaims: 1, locked: true },
  };

  it("explains that claims lock the world and links to the realm's claims", () => {
    statusQuery.mockReturnValue(LOCKED);
    renderPanel();
    const notice = screen.getByText("The world is locked").closest("div")!.parentElement!;
    expect(notice).toHaveTextContent("2 pending, 1 approved");
    expect(screen.getByRole("link", { name: "Review the realm's claims" })).toHaveAttribute(
      "href",
      "/r/eurth/manage#claims"
    );
  });

  it("still lets a preview be made and tuned", async () => {
    statusQuery.mockReturnValue(LOCKED);
    renderPanel();
    await generateFirst();
    step("Continents");
    expect(lastRequest().params).toMatchObject({ continentCount: 7 });
  });

  it("says an archived realm's world can't change", () => {
    statusQuery.mockReturnValue({
      data: { lockReason: "archived", pendingClaims: 0, approvedClaims: 0 },
    });
    renderPanel();
    expect(screen.getByText("This realm is archived")).toBeInTheDocument();
  });

  it("shows no notice while the realm is open", () => {
    renderPanel();
    expect(screen.queryByText("The world is locked")).toBeNull();
  });

  it("asks about the realm by its slug", () => {
    renderPanel();
    expect(statusQuery).toHaveBeenCalledWith(
      { realm: "eurth" },
      expect.objectContaining({ enabled: true })
    );
  });
});

describe("the apply region and the sandbox", () => {
  it("leaves a place for applying the world: a button that is disabled for now", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Use this world" })).toBeDisabled();
  });

  it("has no apply region in the sandbox, and does not ask about claims", async () => {
    renderPanel({ sandbox: true });
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    expect(statusQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(
      screen.getByText("Generate a preview to compare it with Ixnay and Eurth.")
    ).toBeInTheDocument();
  });

  it("shows the calibration against Ixnay and Eurth once the sandbox has a world", async () => {
    renderPanel({ sandbox: true });
    const request = await generateFirst();
    act(() =>
      workers[0]!.say(
        resultMessage(request.id, {
          stats: {
            landShare: 0.25,
            continents: 5,
            climateMix: { A: 0.4 },
            slotCount: 0,
            baseline: null,
          },
          cells: new Float32Array([0, 0, 10, 1, 0, 200]).buffer,
        })
      )
    );
    const table = screen.getByLabelText("Calibration against Ixnay and Eurth");
    expect(within(table).getByRole("columnheader", { name: "Ixnay" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Eurth" })).toBeInTheDocument();
    expect(within(table).getByText("Land share")).toBeInTheDocument();
    expect(within(table).getByText("Coastal Lowlands")).toBeInTheDocument();
    expect(within(table).getByText("Tropical")).toBeInTheDocument();
    expect(within(table).getAllByText("22.9%").length).toBe(2);
  });

  it("keeps the sandbox's recipe apart from the realm's", async () => {
    renderPanel({ sandbox: true });
    await generateFirst();
    expect(loadWorldRecipe(`sandbox:${REALM}`)).not.toBeNull();
    expect(loadWorldRecipe(REALM)).toBeNull();
  });
});
