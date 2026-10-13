/**
 * World Studio's parameter rail: every generator parameter in the group of the stage that reads it, each with its
 * range, the preset's value and a reset; sliders commit on release and once per key burst; and a commit makes the
 * worker generate again with the new parameters.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

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

import { ELEVATION_ZONES } from "~/lib/worldgen/v2/config";
import { PARAM_RANGES, STUDIO_FIELDS, STUDIO_GROUPS } from "~/lib/worldgen/studio-fields";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  land,
  lastRequest,
  openGroup,
  renderStudio,
  requests,
  resetStudioTests,
  step,
  workers,
} from "~/tests/helpers/studio-fixtures";

beforeAll(stubResizeObserver);
beforeEach(resetStudioTests);

/** The Studio with its first world landed, every group open. */
function openStudio() {
  renderStudio();
  land();
  for (const name of ["Climate", "Nations", "Output"]) openGroup(name);
}

const rail = () => screen.getByLabelText("Parameters");

describe("the rail's groups", () => {
  it("lists Mesh, Land, Climate, Nations and Output, with Mesh and Land open", () => {
    renderStudio();
    for (const group of STUDIO_GROUPS) {
      expect(within(rail()).getByRole("button", { name: group.label })).toHaveAttribute(
        "aria-expanded",
        String(group.open)
      );
    }
    expect(screen.getByRole("slider", { name: "Cells" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Ocean" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Temperature" })).not.toBeInTheDocument();
  });

  it("has a control for every parameter, in its own group", () => {
    openStudio();
    const found = (key: keyof typeof STUDIO_FIELDS) => {
      const spec = STUDIO_FIELDS[key];
      switch (spec.kind) {
        case "slider":
          return screen.queryByRole("slider", { name: spec.label });
        case "range":
          return screen.queryAllByRole("slider", { name: new RegExp(`^${spec.label}, `) })[1];
        case "switch":
          return within(rail()).queryByRole("switch", { name: spec.label });
        case "polar":
          return screen.queryByRole("switch", { name: "Polar land in the north" });
        case "choice":
          return screen.queryByRole("radiogroup", { name: spec.label });
        case "hypsometry":
          return screen.queryByRole("spinbutton", { name: "Coastal Lowlands share" });
      }
    };
    for (const group of STUDIO_GROUPS) {
      for (const key of group.fields) expect(found(key)).toBeInTheDocument();
    }
  });
});

describe("ranges and preset values", () => {
  it("sets every slider's ends from the parameter's range", () => {
    renderStudio();
    for (const key of ["cellCount", "oceanPercentage", "plateCount"] as const) {
      const { label } = STUDIO_FIELDS[key];
      const thumb = screen.getByRole("slider", { name: label });
      expect(thumb).toHaveAttribute("aria-valuemin", String(PARAM_RANGES[key].min));
      expect(thumb).toHaveAttribute("aria-valuemax", String(PARAM_RANGES[key].max));
    }
  });

  it("shows the range and the preset's value under a control", () => {
    renderStudio();
    expect(within(rail()).getByText("Range 20% to 95%. Preset 70%")).toBeInTheDocument();
    expect(within(rail()).getByText("Range 1,000 to 150,000. Preset 100,000")).toBeInTheDocument();
  });

  it("starts the controls at the chosen preset's values", () => {
    renderStudio();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "ixnay" } });
    expect(screen.getByRole("slider", { name: "Ocean" })).toHaveAttribute("aria-valuenow", "0.771");
    expect(within(rail()).getByText("Range 20% to 95%. Preset 77%")).toBeInTheDocument();
  });
});

describe("commit on release", () => {
  it("makes the first world on mount, from the preset's parameters", () => {
    renderStudio();
    expect(requests()).toHaveLength(1);
    expect(lastRequest().params).toMatchObject({ oceanPercentage: 0.7, cellCount: 100000 });
  });

  it("generates once for a burst of key steps, when the key comes up", () => {
    openStudio();
    const thumb = screen.getByRole("slider", { name: "Ocean" });
    for (let tick = 0; tick < 3; tick++) fireEvent.keyDown(thumb, { key: "ArrowRight" });
    // The readout follows the steps; no world is asked for yet
    expect(thumb).toHaveAttribute("aria-valuenow", "0.73");
    expect(requests()).toHaveLength(1);

    fireEvent.keyUp(thumb, { key: "ArrowRight" });
    expect(requests()).toHaveLength(2);
    expect(lastRequest().params.oceanPercentage).toBeCloseTo(0.73, 6);
  });

  it("generates with the parameters the other controls hold", () => {
    openStudio();
    step("Ocean");
    land();
    step("Tectonic plates");
    expect(lastRequest().params).toMatchObject({ plateCount: 11 });
    expect(lastRequest().params.oceanPercentage).toBeCloseTo(0.71, 6);
  });

  it("keeps the seed through a commit and carries it to the request", () => {
    openStudio();
    const seed = lastRequest().seed;
    step("Ocean");
    expect(lastRequest().seed).toBe(seed);
  });

  it("commits a switch at once", () => {
    openStudio();
    fireEvent.click(within(rail()).getByRole("switch", { name: "Rivers" }));
    expect(lastRequest().params).toMatchObject({ hasRivers: false });
    land();
    fireEvent.click(within(rail()).getByRole("switch", { name: "Ice caps" }));
    expect(lastRequest().params).toMatchObject({ hasRivers: false, hasIcecaps: false });
  });

  it("commits the two polar switches as one pair", () => {
    openStudio();
    fireEvent.click(screen.getByRole("switch", { name: "Polar land in the north" }));
    expect(lastRequest().params.polarLand).toEqual({ north: true, south: true });
    land();
    fireEvent.click(screen.getByRole("switch", { name: "Polar land in the south" }));
    expect(lastRequest().params.polarLand).toEqual({ north: true, south: false });
  });

  it("commits a range pair without letting its ends cross", () => {
    openStudio();
    // Default band is -50 to 60: pushing the southern edge past 60 takes the northern edge along
    const south = screen.getByRole("slider", { name: "Continent latitudes, southern edge" });
    for (let tick = 0; tick < 23; tick++) fireEvent.keyDown(south, { key: "ArrowRight" });
    fireEvent.keyUp(south, { key: "ArrowRight" });
    expect(lastRequest().params.continentLatitudeRange).toEqual([65, 65]);
  });

  it("commits the development level", () => {
    openStudio();
    fireEvent.click(screen.getByRole("radio", { name: "Modern" }));
    expect(lastRequest().params.developmentLevel).toBe("modern");
  });

  it("asks the shared worker, which keeps its idle worker and picks the stage itself", () => {
    openStudio();
    step("Ocean");
    // Same worker is reused once idle; the fake never terminated the first
    expect(workers[0]!.terminated).toBe(false);
    expect(lastRequest()).toMatchObject({ type: "generate" });
  });
});

describe("resets", () => {
  it("resets one control to the preset's value, and only when it has moved", () => {
    openStudio();
    const reset = screen.getByRole("button", { name: "Reset Ocean" });
    expect(reset).toBeDisabled();
    step("Ocean");
    land();
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(lastRequest().params.oceanPercentage).toBeCloseTo(0.7, 6);
    expect(reset).toBeDisabled();
  });

  it("resets a whole group and leaves the others alone", () => {
    openStudio();
    step("Ocean");
    land();
    step("Temperature");
    land();
    expect(lastRequest().params.temperatureOffset).toBeCloseTo(0.5, 6);
    fireEvent.click(screen.getByRole("button", { name: "Reset group Land" }));
    expect(lastRequest().params.oceanPercentage).toBeCloseTo(0.7, 6);
    expect(lastRequest().params.temperatureOffset).toBeCloseTo(0.5, 6);
    expect(screen.getByRole("button", { name: "Reset group Land" })).toBeDisabled();
  });

  it("does not ask for a world when there is nothing to reset", () => {
    openStudio();
    expect(screen.getByRole("button", { name: "Reset group Mesh" })).toBeDisabled();
    expect(requests()).toHaveLength(1);
  });
});

describe("hypsometry", () => {
  const zone = (name: string) => screen.getByRole("spinbutton", { name: `${name} share` });

  it("has nine zones and shows their sum", () => {
    renderStudio();
    expect(screen.getAllByRole("spinbutton", { name: /share$/ })).toHaveLength(9);
    expect(screen.getByText(/^Sum 100\./)).toBeInTheDocument();
  });

  it("follows what is typed in the sum and commits when the input is left", () => {
    renderStudio();
    land();
    fireEvent.change(zone("Coastal Lowlands"), { target: { value: "30" } });
    expect(screen.getByText(/^Sum 112\./)).toBeInTheDocument();
    expect(requests()).toHaveLength(1);

    fireEvent.blur(zone("Coastal Lowlands"));
    expect(requests()).toHaveLength(2);
    expect(lastRequest().params.hypsometry).toEqual([30, 22, 12, 22, 15, 6, 3, 1.5, 0.5]);
  });

  it("commits on Enter", () => {
    renderStudio();
    land();
    fireEvent.change(zone("Uplands"), { target: { value: "5" } });
    fireEvent.keyDown(zone("Uplands"), { key: "Enter" });
    expect(lastRequest().params.hypsometry?.[3]).toBe(5);
  });

  it("refuses an all-zero profile and says so", () => {
    renderStudio();
    land();
    for (const { name } of ELEVATION_ZONES) {
      fireEvent.change(zone(name), { target: { value: "0" } });
    }
    expect(screen.getByRole("alert")).toHaveTextContent("The shares must add up to more than 0.");
    fireEvent.blur(zone("Uplands"));
    expect(requests()).toHaveLength(1);
  });

  it("goes back to the preset's shares on reset", () => {
    renderStudio();
    land();
    fireEvent.change(zone("Alpine"), { target: { value: "9" } });
    fireEvent.blur(zone("Alpine"));
    land();
    fireEvent.click(screen.getByRole("button", { name: "Reset Hypsometry" }));
    expect(lastRequest().params.hypsometry?.[7]).toBe(1.5);
  });
});
