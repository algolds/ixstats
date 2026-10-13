/**
 * The inspector wired to the real Studio: each tab is opened through `StudioInspector` and reads the live context
 * (the Calibration tab asks the world's worker to measure, Presets and Ship show their sections).
 */
import { fireEvent, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-studio-trpc");
  return {
    api: {
      ...fake.api,
      useQueries: () => [],
      atlas: {
        ...fake.api.atlas,
        presets: { ...fake.api.atlas.presets, list: { useQuery: jest.fn() } },
        realms: { overview: { useQuery: jest.fn() } },
      },
    },
  };
});
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

import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import { applyStatusQuery, resetStudioTrpc } from "~/tests/helpers/fake-studio-trpc";
import { land, renderStudio, resetStudioTests, workers } from "~/tests/helpers/studio-fixtures";

beforeAll(stubResizeObserver);
beforeEach(() => {
  resetStudioTests();
  resetStudioTrpc();
  applyStatusQuery.mockReturnValue({ data: undefined, isError: false });
});

const openTab = (name: string) => {
  fireEvent.mouseDown(screen.getByRole("tab", { name }));
  fireEvent.click(screen.getByRole("tab", { name }));
};

describe("the inspector tabs, through the Studio", () => {
  it("opens Calibration on the live generator: the world is sent to the worker to measure", () => {
    renderStudio();
    land();
    openTab("Calibration");
    expect(screen.getByRole("heading", { name: "Calibration" })).toBeInTheDocument();
    expect(workers.at(-1)!.queries.map((query) => query.type)).toContain("measure");
  });

  it("opens Presets with the presets of the Studio", () => {
    renderStudio();
    openTab("Presets");
    expect(screen.getByRole("heading", { name: "Presets" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Presets" })).toHaveTextContent("Earth-like");
  });

  it("opens Ship with its three sections, the export waiting for a world", () => {
    renderStudio();
    openTab("Ship");
    for (const name of ["Export", "Apply to a realm", "New realm from this world"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Download GeoJSON/ })).toBeDisabled();
    land();
    expect(screen.getByRole("button", { name: /Download GeoJSON/ })).toBeEnabled();
  });
});
