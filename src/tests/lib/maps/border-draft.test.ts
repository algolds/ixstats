import type { Polygon } from "geojson";
import { restorableBorderDraft } from "~/lib/maps/border-draft";
const SQUARE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};
const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
describe("restorableBorderDraft", () => {
  type Input = Parameters<typeof restorableBorderDraft>[0];
  const stored = (over: object = {}) => ({
    featureId: "Caphiria",
    geometry: SQUARE,
    dirtyNeighbors: {},
    savedAt: NOW - HOUR,
    ...over,
  });
  const input = (over: Partial<Input> = {}): Input => ({
    sessionData: stored(),
    sessionUserId: "user_1",
    sessionFeatureId: "Caphiria",
    userId: "user_1",
    featureId: "Caphiria",
    featureUpdatedAt: new Date(NOW - 2 * HOUR),
    now: NOW,
    ...over,
  });

  it("offers a draft saved after the feature last changed, for the same feature and user", () => {
    expect(restorableBorderDraft(input())).toEqual(stored());
  });

  it("does not offer a draft the feature has since been saved past", () => {
    const updatedAfter = input({ featureUpdatedAt: new Date(NOW - HOUR + 1) });
    expect(restorableBorderDraft(updatedAfter)).toBeNull();
    const sameInstant = input({ featureUpdatedAt: new Date(NOW - HOUR) });
    expect(restorableBorderDraft(sameInstant)).toBeNull();
  });
  it("does not offer another user's draft", () => {
    expect(restorableBorderDraft(input({ sessionUserId: "user_2" }))).toBeNull();
  });
  it.each([
    ["a new session", { undoStack: [], mode: "select" }],
    ["a legacy autosave", { geometry: SQUARE, undoStack: { entries: [] }, mode: "vertex_edit" }],
    ["no time", stored({ savedAt: undefined })],
    [
      "a geometry that is not a polygon",
      stored({ geometry: { type: "Point", coordinates: [0, 0] } }),
    ],
    ["an empty object", {}],
    ["null", null],
  ])("does not offer %s", (_label, sessionData) => {
    expect(restorableBorderDraft(input({ sessionData }))).toBeNull();
  });
  describe("moved neighbours that changed after the draft was saved", () => {
    const drafted = stored({
      dirtyNeighbors: { kept: SQUARE, newer: SQUARE, same: SQUARE, gone: SQUARE },
    });
    const updatedAt = {
      kept: new Date(NOW - 2 * HOUR),
      newer: new Date(NOW - HOUR + 1),
      same: new Date(NOW - HOUR),
    };

    it("keeps only the neighbours whose outline is older than the draft", () => {
      const draft = restorableBorderDraft(
        input({ sessionData: drafted, neighborUpdatedAt: updatedAt })
      );
      // "gone" is no longer a neighbour of the feature: nothing vouches that its outline is unchanged
      expect(Object.keys(draft?.dirtyNeighbors ?? {})).toEqual(["kept"]);
      expect(draft?.geometry).toEqual(SQUARE);
    });
  });
});
