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
// The real region, called through, so its props can be read
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});
import {
  statusQuery,
  region,
  renderPanel,
  lastRequest,
  generateSettled,
  step,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);
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
  it("still lets a preview be made and tuned", async () => {
    statusQuery.mockReturnValue(LOCKED);
    renderPanel();
    await generateSettled();
    step("Continents");
    expect(lastRequest().params).toMatchObject({ continentCount: 7 });
  });
});

describe("the lock as the apply region sees it", () => {
  const props = () => region.mock.lastCall![0];
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
});
