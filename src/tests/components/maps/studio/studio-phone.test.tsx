/**
 * Below about 900 px World Studio is a notice with the way back, and nothing heavy is mounted: no queries, no map, no
 * worker. It switches to the tool when the window widens, and back when it narrows.
 */
import { act, screen } from "@testing-library/react";

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

import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  presetsQuery,
  realmsQuery,
  renderStudio,
  requests,
  resetStudioTests,
  studioMap,
  workers,
} from "~/tests/helpers/studio-fixtures";

beforeAll(stubResizeObserver);
beforeEach(resetStudioTests);

const resizeTo = (width: number) => {
  window.innerWidth = width;
  act(() => void window.dispatchEvent(new Event("resize")));
};

describe("the phone notice", () => {
  it("replaces the tool below 900 px, with a way back to Atlas", () => {
    window.innerWidth = 600;
    renderStudio();
    expect(screen.getByText("World Studio needs a wider screen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Atlas" })).toHaveAttribute(
      "href",
      "/admin/maps"
    );
    expect(screen.queryByLabelText("Parameters")).not.toBeInTheDocument();
  });

  it("mounts nothing heavy: no queries, no map, no worker", () => {
    window.innerWidth = 600;
    renderStudio();
    expect(presetsQuery).not.toHaveBeenCalled();
    expect(realmsQuery).not.toHaveBeenCalled();
    expect(studioMap).not.toHaveBeenCalled();
    expect(workers).toHaveLength(0);
    expect(requests()).toHaveLength(0);
  });

  it("shows the tool from 900 px, and the notice below it", () => {
    window.innerWidth = 900;
    renderStudio();
    expect(screen.queryByText("World Studio needs a wider screen")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parameters")).toBeInTheDocument();

    resizeTo(899);
    expect(screen.getByText("World Studio needs a wider screen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Parameters")).not.toBeInTheDocument();
  });

  it("brings the tool up when the window widens", () => {
    window.innerWidth = 700;
    renderStudio();
    resizeTo(1200);
    expect(screen.getByLabelText("Parameters")).toBeInTheDocument();
    expect(requests()).toHaveLength(1);
  });
});
