/**
 * World Studio's shell: the top bar (preset, seed, status), the two sources (a preset, or fitted to a realm's map,
 * also opened by `?fit=`), the Layers tab (switches, one diagnostic at a time with its legend, the seeds), the inspector
 * slots for the tabs that come next, and the recipe kept between visits.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    atlas: {
      presets: { list: { useQuery: jest.fn() } },
      realms: { overview: { useQuery: jest.fn() } },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true, isSignedIn: true }),
}));
jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));
jest.mock("~/hooks/useStudioMap", () => ({ useStudioMap: jest.fn() }));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { WorldDraft } from "~/lib/maps/world-draft-layers";
import { studioRecipeKey } from "~/lib/worldgen/studio-recipe";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  land,
  lastRequest,
  layersQuery,
  mapLayers,
  presetsQuery,
  renderStudio,
  requests,
  resetStudioTests,
  retryLayers,
  rig,
  step,
  studioElement,
  workers,
} from "~/tests/helpers/studio-fixtures";

beforeAll(stubResizeObserver);
beforeEach(resetStudioTests);
afterEach(() => jest.restoreAllMocks());

const topBar = () => screen.getByRole("banner");

describe("the top bar", () => {
  it("links back to Atlas", () => {
    renderStudio();
    expect(screen.getByRole("link", { name: "Back to Atlas" })).toHaveAttribute(
      "href",
      "/admin/maps"
    );
  });

  it("offers every unarchived preset, marking a draft", () => {
    renderStudio();
    const options = within(screen.getByLabelText("Preset"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Earth-like", "Ixnay", "Badlands (draft)"]);
  });

  it("starts a preset from its draft, else its published version, and makes a world from it", () => {
    renderStudio();
    land();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "badlands" } });
    expect(lastRequest().params).toMatchObject({ terrainRoughness: 0.9, plateCount: 20 });
    land();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "ixnay" } });
    expect(lastRequest().params).toMatchObject({ oceanPercentage: 0.771, temperatureOffset: 1.5 });
  });

  it("takes a typed seed, and rerolls", () => {
    renderStudio();
    land();
    const seed = screen.getByLabelText("Seed");
    fireEvent.change(seed, { target: { value: "4242" } });
    fireEvent.keyDown(seed, { key: "Enter" });
    expect(lastRequest().seed).toBe(4242);
    land();
    fireEvent.click(screen.getByRole("button", { name: "Reroll seed" }));
    expect(lastRequest().seed).not.toBe(4242);
    expect(requests()).toHaveLength(3);
  });

  it("ignores a seed that is not a whole number in range", () => {
    renderStudio();
    land();
    for (const bad of ["0", "1.5", "3000000000", ""]) {
      fireEvent.change(screen.getByLabelText("Seed"), { target: { value: bad } });
      fireEvent.blur(screen.getByLabelText("Seed"));
    }
    expect(requests()).toHaveLength(1);
  });

  describe("status", () => {
    it("says Generating while a run is on", () => {
      renderStudio();
      expect(within(topBar()).getByRole("status")).toHaveTextContent("Generating…");
    });

    it("says how long the draft took and from which stage", () => {
      renderStudio();
      land({ generationMs: 412, restartedAt: "climate" });
      expect(within(topBar()).getByRole("status")).toHaveTextContent("Draft · 0.4 s from climate");
    });

    it("says the draft is out of date while the parameters are ahead of it", () => {
      renderStudio();
      land({ generationMs: 412, restartedAt: "mesh" });
      step("Ocean");
      expect(within(topBar()).getByRole("status")).toHaveTextContent("Generating…");
      land({ generationMs: 80, restartedAt: "land" });
      expect(within(topBar()).getByRole("status")).toHaveTextContent("Draft · 0.1 s from land");
    });

    it("shows the error with Retry, which asks again", () => {
      renderStudio();
      act(() =>
        workers[0]!.say({
          type: "error",
          id: lastRequest().id,
          message: "The mesh ran out of memory",
        })
      );
      expect(within(topBar()).getByRole("alert")).toHaveTextContent("The mesh ran out of memory");
      fireEvent.click(within(topBar()).getByRole("button", { name: "Retry" }));
      expect(requests()).toHaveLength(2);
      expect(lastRequest().params).toEqual(requests()[0]!.params);
    });
  });
});

describe("the preset source", () => {
  it("is the default, and draws the world on the Studio's own map", () => {
    renderStudio();
    expect(screen.getByRole("radio", { name: "Preset" })).toBeChecked();
    expect(lastRequest()).not.toHaveProperty("keepBorders");
    land();
    expect(rig.draftIds()).toContain("worldgen-draft-relief");
    expect(rig.draftIds()).toContain("worldgen-draft-political");
  });

  it("falls back to the three built-ins when the presets cannot be read", () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: true });
    renderStudio();
    expect(screen.getByText(/built-in ones stand in/)).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Preset"))
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Earth-like", "Ixnay", "Eurth"]);
    expect(requests()).toHaveLength(1);
  });

  it("waits for the presets", () => {
    presetsQuery.mockReturnValue({ data: undefined, isError: false });
    renderStudio();
    expect(screen.getByText("Loading the presets.")).toBeInTheDocument();
    expect(requests()).toHaveLength(0);
  });
});

describe("the fit source", () => {
  const fitRadio = () => screen.getByRole("radio", { name: "Fit to a realm's map" });

  it("lists the realms that have a political layer, Ixnay among them", () => {
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    const options = within(screen.getByLabelText("Realm"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Ixnay", "Eurth"]);
  });

  it("starts on Ixnay and fits the world around its borders with a mask key of realm and version", () => {
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    expect(layersQueryRealm()).toBe("ixnay");
    expect(lastRequest()).toMatchObject({
      keepBorders: true,
      maskKey: "ixnay:5",
      landMaskLayers: { political: expect.objectContaining({ type: "FeatureCollection" }) },
    });
    expect(lastRequest().landMaskLayers?.political?.features).toHaveLength(2);
    expect(lastRequest().landMaskLayers).not.toHaveProperty("rivers");
  });

  it("fits to another realm when one is chosen", () => {
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    land();
    fireEvent.change(screen.getByLabelText("Realm"), { target: { value: "eurth" } });
    expect(layersQueryRealm()).toBe("eurth");
    expect(lastRequest()).toMatchObject({ keepBorders: true, maskKey: "eurth:5" });
  });

  it("keeps the parameters through the switch and turns off what the realm's map decides", () => {
    renderStudio();
    land();
    step("Terrain roughness");
    land();
    fireEvent.click(fitRadio());
    expect(lastRequest().params.terrainRoughness).toBeCloseTo(0.55, 6);
    expect(screen.getByRole("slider", { name: "Ocean" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("slider", { name: "Terrain roughness" })).not.toHaveAttribute(
      "data-disabled"
    );
    expect(screen.getAllByText("Set by the realm's map").length).toBeGreaterThan(3);
  });

  it("goes back to the preset source without the mask", () => {
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    land();
    fireEvent.click(screen.getByRole("radio", { name: "Preset" }));
    expect(lastRequest()).not.toHaveProperty("keepBorders");
    expect(screen.getByRole("slider", { name: "Ocean" })).not.toHaveAttribute("data-disabled");
  });

  it("waits for the realm's layers, and makes no world meanwhile", () => {
    layersQuery.mockReturnValue(mapLayers({ isPending: true }));
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    expect(screen.getByText("Loading the realm's map.")).toBeInTheDocument();
    expect(requests()).toHaveLength(1);
    expect(within(topBar()).getByText("Waiting for the realm's map")).toBeInTheDocument();
  });

  it("says when the layers could not be loaded, and tries again", () => {
    layersQuery.mockReturnValue(mapLayers({ error: new Error("500") }));
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryLayers).toHaveBeenCalledTimes(1);
  });

  it("says when the realm has no borders to build on", () => {
    layersQuery.mockReturnValue(
      mapLayers({ layers: { political: { type: "FeatureCollection", features: [] } } })
    );
    renderStudio();
    land();
    fireEvent.click(fitRadio());
    expect(screen.getByText("This realm has no political layer to build on.")).toBeInTheDocument();
    expect(requests()).toHaveLength(1);
  });

  it("makes the world again when the realm's map version moves, and not when the same map is read again", () => {
    const { rerender } = renderStudio();
    land();
    fireEvent.click(fitRadio());
    land();
    expect(requests()).toHaveLength(2);

    layersQuery.mockReturnValue(mapLayers({ version: 5 }));
    rerender(studioElement());
    expect(requests()).toHaveLength(2);

    layersQuery.mockReturnValue(mapLayers({ version: 6 }));
    rerender(studioElement());
    expect(requests()).toHaveLength(3);
    expect(lastRequest()).toMatchObject({ maskKey: "ixnay:6", keepBorders: true });
  });
});

describe("?fit=", () => {
  it("opens the fit source on that realm and makes the first world around its map", () => {
    renderStudio({ fit: "eurth" });
    expect(screen.getByRole("radio", { name: "Fit to a realm's map" })).toBeChecked();
    expect(screen.getByLabelText("Realm")).toHaveValue("eurth");
    expect(requests()).toHaveLength(1);
    expect(lastRequest()).toMatchObject({ keepBorders: true, maskKey: "eurth:5" });
    expect(layersQueryRealm()).toBe("eurth");
  });

  it("fits to Ixnay too", () => {
    renderStudio({ fit: "ixnay" });
    expect(lastRequest()).toMatchObject({ keepBorders: true, maskKey: "ixnay:5" });
  });
});

/** The realm the layer queries were last asked about. */
function layersQueryRealm() {
  return layersQuery.mock.calls.filter(([options]) => options.enabled !== false).at(-1)![0].realm;
}

describe("the Layers tab", () => {
  it("switches each world layer off and on in the draft, without a new world", () => {
    const setVisible = jest.spyOn(WorldDraft.prototype, "setVisible");
    renderStudio();
    land();
    const before = requests().length;
    for (const [label, key] of [
      ["Political", "political"],
      ["Relief", "relief"],
      ["Land", "background"],
      ["Elevation", "altitudes"],
      ["Rivers", "rivers"],
      ["Lakes", "lakes"],
    ] as const) {
      const toggle = within(screen.getByRole("region", { name: "World layers" })).getByRole(
        "switch",
        {
          name: label,
        }
      );
      expect(toggle).toBeChecked();
      setVisible.mockClear();
      fireEvent.click(toggle);
      expect(setVisible).toHaveBeenCalledWith(key, false);
      expect(rig.visibility(`worldgen-draft-${key}`)).toBe("none");
    }
    expect(requests()).toHaveLength(before);

    setVisible.mockClear();
    fireEvent.click(screen.getByRole("switch", { name: "Relief" }));
    expect(setVisible).toHaveBeenCalledWith("relief", true);
    expect(rig.visibility("worldgen-draft-relief")).toBe("visible");
  });

  describe("diagnostics", () => {
    const diagnostics = () => screen.getByRole("region", { name: "Diagnostics" });
    const choose = (name: string) =>
      fireEvent.click(within(diagnostics()).getByRole("radio", { name }));
    const queries = () => workers.at(-1)!.queries;
    const answer = (kind: string, legend: object = {}) =>
      act(() =>
        workers.at(-1)!.say({
          type: "diagnostic-result",
          requestId: queries().at(-1)!.requestId,
          world: lastRequest().id,
          image: {
            kind,
            width: 1,
            height: 1,
            rgba: new Uint8Array(4).buffer,
            legend: {
              kind,
              title: kind,
              unit: "",
              domain: [0, 1],
              scale: "linear",
              stops: [{ value: 0, color: "#000000" }],
              clipped: { low: false, high: false },
              ...legend,
            },
          } as never,
        })
      );

    it("offers Height, Temperature, Rainfall, River flow and Cells, none shown at first", () => {
      renderStudio();
      land();
      expect(
        within(diagnostics())
          .getAllByRole("radio")
          .map((radio) => radio.textContent)
      ).toEqual(["Height", "Temperature", "Rainfall", "River flow", "Cells"]);
      expect(within(diagnostics()).queryByRole("radio", { checked: true })).toBeNull();
      expect(queries()).toHaveLength(0);
    });

    it("draws one without regenerating, under the relief, one at a time", async () => {
      renderStudio();
      land();
      choose("Temperature");
      expect(queries().at(-1)).toMatchObject({ type: "diagnostic", kind: "temperature" });
      await answer("temperature");
      expect(requests()).toHaveLength(1);
      expect(rig.draftIds()).toContain("worldgen-draft-diagnostic");

      choose("Rainfall");
      await answer("rainfall");
      expect(rig.sources.get("worldgen-draft-diagnostic")!.updateImage).toHaveBeenCalled();
      expect(within(diagnostics()).getByRole("radio", { name: "Rainfall" })).toBeChecked();
      expect(within(diagnostics()).getByRole("radio", { name: "Temperature" })).not.toBeChecked();

      // Pressing the shown one hides it
      choose("Rainfall");
      expect(rig.draftIds()).not.toContain("worldgen-draft-diagnostic");
      expect(requests()).toHaveLength(1);
    });

    it("shows the legend with the clipped ends", async () => {
      renderStudio();
      land();
      choose("Temperature");
      await answer("temperature", {
        title: "Temperature",
        unit: "°C",
        domain: [-30, 38],
        clipped: { low: true, high: true },
        stops: [
          { value: -30, color: "#313695", label: "-30 or colder" },
          { value: 38, color: "#a50026", label: "38 or hotter" },
        ],
      });
      const legend = screen.getByRole("figure", { name: "Temperature legend" });
      expect(within(legend).getByText("-30 or colder")).toBeInTheDocument();
      expect(within(legend).getByText("38 or hotter")).toBeInTheDocument();
      expect(
        within(legend).getByText(/Values past the ends are drawn at the colour/)
      ).toBeInTheDocument();
    });

    it("asks for the shown one again when a new world lands, and not for a world that moved on", async () => {
      renderStudio();
      land();
      choose("Height");
      await answer("height");
      step("Ocean");
      // Nothing is asked of the worker while it makes the new world
      expect(workers.at(-1)!.queries.filter((q) => q.type === "diagnostic")).toHaveLength(1);
      land();
      const asked = workers.at(-1)!.queries.filter((q) => q.type === "diagnostic");
      expect(asked.at(-1)).toMatchObject({ kind: "height", world: lastRequest().id });
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("places the nation seeds on their own switch", async () => {
      renderStudio();
      land();
      fireEvent.click(within(diagnostics()).getByRole("switch", { name: "Nation seeds" }));
      const request = queries().at(-1)!;
      expect(request.type).toBe("seeds");
      await act(async () =>
        workers.at(-1)!.say({
          type: "seeds-result",
          requestId: request.requestId,
          world: lastRequest().id,
          seeds: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 2] } },
            ],
          },
        })
      );
      expect(rig.draftIds()).toContain("worldgen-draft-seeds");
      expect(requests()).toHaveLength(1);
      fireEvent.click(within(diagnostics()).getByRole("switch", { name: "Nation seeds" }));
      expect(rig.draftIds()).not.toContain("worldgen-draft-seeds");
    });
  });
});

describe("the inspector", () => {
  it("has Layers, Calibration, Presets and Ship, with the three last in slots of their own", () => {
    renderStudio();
    const tabs = within(screen.getByRole("tablist", { name: "Inspector" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Layers",
      "Calibration",
      "Presets",
      "Ship",
    ]);
    for (const name of ["Calibration", "Presets", "Ship"]) {
      fireEvent.mouseDown(screen.getByRole("tab", { name }));
      fireEvent.click(screen.getByRole("tab", { name }));
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});

describe("the saved recipe", () => {
  it("keeps the parameters and the seed for the next visit, and generates them again", () => {
    const first = renderStudio();
    land();
    step("Ocean");
    const { seed, params } = lastRequest();
    first.unmount();

    renderStudio();
    expect(lastRequest()).toMatchObject({ seed, params });
    expect(screen.getByRole("slider", { name: "Ocean" })).toHaveAttribute("aria-valuenow", "0.71");
  });

  it("is kept under the admin's own key", () => {
    renderStudio();
    expect(window.localStorage.getItem(studioRecipeKey("user_1"))).not.toBeNull();
    expect(Object.keys(window.localStorage)).toEqual(["studio:user_1"]);
  });

  it("starts fresh from an old version of the recipe", () => {
    window.localStorage.setItem(
      studioRecipeKey("user_1"),
      JSON.stringify({ version: 0, seed: 5, params: {} })
    );
    renderStudio();
    expect(lastRequest().seed).not.toBe(5);
    expect(lastRequest().params.oceanPercentage).toBe(0.7);
  });

  it("works when storage throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    renderStudio();
    land();
    step("Ocean");
    expect(requests()).toHaveLength(2);
  });
});
