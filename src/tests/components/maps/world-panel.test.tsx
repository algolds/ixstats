/**
 * The World tab: the controls ask the generator for the right world, a slider asks when it is released, the draft
 * recipe is kept per realm and brings the preview back, and the lock explains itself without stopping a preview. The
 * worker is a fake that the test speaks for.
 */
import { StrictMode } from "react";
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
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  loadWorldRecipe,
  saveWorldRecipe,
  worldRecipeKey,
} from "~/lib/worldgen/world-draft-recipe";
import { resultMessage } from "~/tests/helpers/fake-world-worker";
import {
  displayQuery,
  statusQuery,
  preview,
  region,
  REALM,
  display,
  OPEN,
  workers,
  factory,
  renderPanel,
  lastRequest,
  requestCount,
  generateFirst,
  generateSettled,
  settle,
  step,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);

describe("generating", () => {
  it("invites a realm's editor to use the world", () => {
    renderPanel();
    expect(screen.getByText(/then use it for this realm/)).toBeInTheDocument();
  });

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
    await generateSettled();
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
    const first = await generateSettled();
    step("Land share");
    expect(lastRequest().seed).toBe(first.seed);
    settle();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    fireEvent.click(screen.getByRole("button", { name: "Reroll seed" }));
    expect(lastRequest().seed).toBe(1 + Math.floor(0.5 * (2 ** 31 - 1)));
    expect(lastRequest().seed).not.toBe(first.seed);
  });

  it("takes a seed typed in on Enter", async () => {
    renderPanel();
    await generateSettled();
    const field = screen.getByLabelText("Seed");
    fireEvent.change(field, { target: { value: "4242" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(lastRequest().seed).toBe(4242);
  });

  it("moves every control to the preset's values when a preset is picked", async () => {
    renderPanel();
    await generateSettled();
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
    await generateSettled();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Development level" })).getByRole("radio", {
        name: "Modern",
      })
    );
    expect(lastRequest().params).toMatchObject({ developmentLevel: "modern" });
    settle();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Preset" })).getByRole("radio", {
        name: "Eurth",
      })
    );
    expect(lastRequest().params).toMatchObject({ developmentLevel: "modern", continentCount: 5 });
  });

  it("reaches the advanced controls through the Advanced section", async () => {
    renderPanel();
    await generateSettled();
    expect(screen.queryByRole("slider", { name: "Islands" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    step("Islands");
    expect(lastRequest().params).toMatchObject({ islandShare: 0.07 });
    settle();
    fireEvent.click(screen.getByRole("switch", { name: "Polar land in the north" }));
    expect(lastRequest().params).toMatchObject({ polarLand: { north: true, south: true } });
    settle();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Elevation profile" })).getByRole("radio", {
        name: "Eurth",
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
        <WorldPanel map={null} createWorker={factory} />
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
    await generateSettled();
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
    renderPanel();
    expect(requestCount()).toBe(0);
    expect(screen.getByRole("radio", { name: "Preset" })).toBeChecked();
  });

  it("starts afresh on another realm", async () => {
    const { rerender } = renderPanel();
    await generateFirst();
    displayQuery.mockReturnValue(display({ realmId: "r_other", realmSlug: "other" }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeInTheDocument();
  });
});

describe("the lock", () => {
  const LOCKED = {
    data: {
      lockReason: "claims",
      pendingClaims: 2,
      approvedClaims: 1,
      locked: true,
      canReviewClaims: true,
    },
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

  it("names who reviews the claims, with no link, to an officer who has no Claims section", () => {
    statusQuery.mockReturnValue({ data: { ...LOCKED.data, canReviewClaims: false } });
    renderPanel();
    expect(screen.queryByRole("link", { name: /claims/i })).toBeNull();
    expect(screen.getByText(/officers with the Claims power review them/)).toBeInTheDocument();
  });

  it("still lets a preview be made and tuned", async () => {
    statusQuery.mockReturnValue(LOCKED);
    renderPanel();
    await generateSettled();
    step("Continents");
    expect(lastRequest().params).toMatchObject({ continentCount: 7 });
  });

  it("says an archived realm's world can't change", () => {
    statusQuery.mockReturnValue({
      data: { lockReason: "archived", pendingClaims: 0, approvedClaims: 0, canReviewClaims: true },
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

describe("the lock as the apply region sees it", () => {
  const props = () => region.mock.lastCall![0];

  it("is loading until the status answers", () => {
    statusQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPanel();
    expect(props().lock).toEqual({ phase: "loading" });
  });

  it("is ready with the status once it answers", () => {
    renderPanel();
    expect(props().lock).toEqual({ phase: "ready", status: OPEN.data });
  });

  it("is failed, not loading and not open, when the status could not be read", () => {
    const refetch = jest.fn();
    statusQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Realm not found" },
      refetch,
    });
    renderPanel();
    const lock = props().lock;
    expect(lock).toMatchObject({ phase: "failed", message: "Realm not found" });
    expect(screen.getByText("Claims could not be checked")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("does not show the failed notice while it is only loading", () => {
    statusQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPanel();
    expect(screen.queryByText("Claims could not be checked")).toBeNull();
  });
});
