/**
 * The admin layer choice through the founder's apply flow: the ticked layers go into `start` as `options.layers`, a
 * change of the choice makes a check out of date, and a flow without a choice (every founder) sends no `options`.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  return { api: { useUtils: fake.useUtils, geoEditor: fake.geoEditor } };
});
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));

import { draftKey, layersKeyOf } from "~/lib/worldgen/world-apply";
import { start } from "~/tests/helpers/fake-map-import";
import {
  DRAFT,
  dryRun,
  reachReview,
  renderRegion,
  resetWorldApplyTests,
} from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);

describe("apply with a layer choice", () => {
  it("sends the ticked layers as options.layers", async () => {
    renderRegion({ source: "realm-map", mapVersion: 5, layers: ["altitudes", "rivers"] });
    await reachReview(dryRun({ source: "realm-map" }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "world",
        fittedMapVersion: 5,
        options: { layers: ["altitudes", "rivers"] },
      })
    );
  });

  it("sends no options for the founder's flow", async () => {
    renderRegion();
    await reachReview();
    expect(start.mock.calls[0]![0]).not.toHaveProperty("options");
  });

  it("makes the check out of date when the choice changes after it, and not when it stays", async () => {
    const view = renderRegion({ source: "realm-map", mapVersion: 5, layers: ["altitudes"] });
    await reachReview(dryRun({ source: "realm-map" }));
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeInTheDocument();

    view.update({ layers: ["altitudes"] });
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeInTheDocument();

    view.update({ layers: ["altitudes", "lakes"] });
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("changed after this check");
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({ options: { layers: ["altitudes", "lakes"] } })
    );
  });
});

describe("draft keys", () => {
  it("are the founder's key without a choice, and differ with one, whatever its order", () => {
    expect(draftKey(DRAFT, "preset")).toBe(JSON.stringify(["preset", DRAFT.seed, DRAFT.params]));
    expect(draftKey(DRAFT, "preset", [])).toBe(draftKey(DRAFT, "preset"));
    expect(draftKey(DRAFT, "realm-map", ["lakes", "altitudes"])).toBe(
      draftKey(DRAFT, "realm-map", ["altitudes", "lakes"])
    );
    expect(draftKey(DRAFT, "realm-map", ["lakes"])).not.toBe(draftKey(DRAFT, "realm-map"));
    expect(layersKeyOf(undefined)).toBe("");
    expect(layersKeyOf(["rivers", "altitudes"])).toBe("altitudes,rivers");
  });
});
