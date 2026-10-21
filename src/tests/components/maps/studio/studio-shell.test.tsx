/**
 * World Studio's shell: the top bar (preset, seed, status), the two sources (a preset, or fitted to a realm's map,
 * also opened by `?fit=`), the Layers tab (switches, one diagnostic at a time with its legend, the seeds), the inspector
 * slots for the tabs that come next, and the recipe kept between visits.
 */
import { fireEvent, screen } from "@testing-library/react";

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
  land,
  renderStudio,
  requests,
  resetStudioTests,
  step
} from "~/tests/helpers/studio-fixtures";

beforeAll(stubResizeObserver);
beforeEach(resetStudioTests);
afterEach(() => jest.restoreAllMocks());
describe("the top bar", () => {
  describe("switching presets", () => {
    const choose = (slug: string) =>
      fireEvent.change(screen.getByLabelText("Preset"), { target: { value: slug } });

    it("asks before replacing edits, and keeps them when cancelled", () => {
      renderStudio();
      land();
      step("Ocean");
      land();
      choose("ixnay");
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        /replace the parameters you changed/i
      );
      fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Preset")).toHaveValue("earthlike");
      expect(requests()).toHaveLength(2);
      expect(screen.getByRole("slider", { name: "Ocean" })).toHaveAttribute(
        "aria-valuenow",
        "0.71"
      );
    });
  });
});
