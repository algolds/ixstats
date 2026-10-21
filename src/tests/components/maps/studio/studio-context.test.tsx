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
// A probe in the Layers slot, to see the context a tab gets
jest.mock("~/components/maps/studio/StudioLayersTab", () => {
  const { useStudio } = jest.requireActual("~/components/maps/studio/StudioContext");
  const seen: unknown[] = [];
  return {
    seen,
    StudioLayersTab: () => {
      seen.push(useStudio());
      return <p>probe</p>;
    },
  };
});

import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  land,
  renderStudio,
  resetStudioTests,
  rig,
  step,
  studioElement,
  workers,
} from "~/tests/helpers/studio-fixtures";

const { seen } = jest.requireMock("~/components/maps/studio/StudioLayersTab") as {
  seen: Array<{ params: unknown }>;
};

beforeAll(stubResizeObserver);
beforeEach(() => {
  resetStudioTests();
  seen.length = 0;
});

describe("the context value", () => {
  it("is the same object when the Studio renders again with nothing changed", () => {
    const view = renderStudio();
    land();
    const before = seen.at(-1);
    view.rerender(studioElement());
    expect(seen.at(-1)).toBe(before);
  });

  it("changes when the parameters do", () => {
    renderStudio();
    land();
    const before = seen.at(-1);
    step("Ocean");
    expect(seen.at(-1)).not.toBe(before);
    expect(seen.at(-1)!.params).not.toBe(before!.params);
  });
});

describe("leaving the Studio", () => {
  it("stops the worker and takes the draft off the map", () => {
    const view = renderStudio();
    land();
    expect(rig.draftIds().length).toBeGreaterThan(0);
    view.unmount();
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    expect(rig.draftIds()).toEqual([]);
    expect(rig.listeners("styledata")).toBe(0);
  });
});
