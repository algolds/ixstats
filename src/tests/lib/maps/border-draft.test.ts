import type { MultiPolygon, Polygon, Position } from "geojson";
import { buildBorderDraft, restorableBorderDraft } from "~/lib/maps/border-draft";
import { cascadeMoveVertex, vkey } from "~/lib/maps/topology-engine";

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

/** A closed ring of `count` vertices with full-precision coordinates, like a stored border. */
function ringOf(count: number, radius: number, centre: Position): Position[] {
  const ring = Array.from({ length: count }, (_, i): Position => {
    const angle = (i / count) * 2 * Math.PI;
    return [centre[0]! + radius * Math.cos(angle), centre[1]! + radius * Math.sin(angle)];
  });
  return [...ring, [...ring[0]!]];
}

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);

describe("buildBorderDraft", () => {
  it("carries the feature, its outline, the moved neighbours and the save time, nothing else", () => {
    const draft = buildBorderDraft({
      featureId: "Caphiria",
      geometry: SQUARE,
      dirtyNeighbors: { Xalesia: SQUARE },
      savedAt: NOW,
    });
    expect(Object.keys(draft).sort()).toEqual([
      "dirtyNeighbors",
      "featureId",
      "geometry",
      "savedAt",
    ]);
  });

  it("stays under 1 MB for a 7k-vertex polygon after 50 drags, undo history excluded", () => {
    const outline: Polygon = { type: "Polygon", coordinates: [ringOf(7000, 10, [100, 20])] };
    const neighbour: Polygon = { type: "Polygon", coordinates: [ringOf(3000, 4, [112, 20])] };
    let geometry: Polygon = outline;
    for (let drag = 0; drag < 50; drag++) {
      const key = vkey(geometry.coordinates[0]![drag]!);
      const to: Position = [geometry.coordinates[0]![drag]![0]! + 0.0123456, 20.123456789012];
      const refs = [{ featureId: "f", ringIndex: 0, vertexIndex: drag }];
      geometry = cascadeMoveVertex(new Map([[key, refs]]), new Map([["f", geometry]]), key, to).get(
        "f"
      ) as Polygon;
    }

    const draft = buildBorderDraft({
      featureId: "f",
      geometry,
      dirtyNeighbors: { n: neighbour },
      savedAt: NOW,
    });
    expect(JSON.stringify(draft).length).toBeLessThan(1_000_000);
  });
});

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

  it("does not offer a draft written for another feature", () => {
    expect(
      restorableBorderDraft(input({ sessionData: stored({ featureId: "Daxia" }) }))
    ).toBeNull();
    expect(restorableBorderDraft(input({ sessionFeatureId: "Daxia" }))).toBeNull();
  });

  it("does not offer another user's draft", () => {
    expect(restorableBorderDraft(input({ sessionUserId: "user_2" }))).toBeNull();
  });

  it("does not offer a draft older than the session lifetime", () => {
    const old = input({
      sessionData: stored({ savedAt: NOW - 25 * HOUR }),
      featureUpdatedAt: null,
    });
    expect(restorableBorderDraft(old)).toBeNull();
  });

  it("offers a draft for a feature that has no update time", () => {
    expect(restorableBorderDraft(input({ featureUpdatedAt: undefined }))).not.toBeNull();
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

  it("drops moved neighbours that are not polygons", () => {
    const multi: MultiPolygon = { type: "MultiPolygon", coordinates: [SQUARE.coordinates] };
    const draft = restorableBorderDraft(
      input({
        sessionData: stored({
          dirtyNeighbors: { good: multi, bad: { type: "Point", coordinates: [0, 0] }, worse: 3 },
        }),
      })
    );
    expect(draft?.dirtyNeighbors).toEqual({ good: multi });
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

    it("offers every moved neighbour when the neighbours' update times are not given", () => {
      const draft = restorableBorderDraft(input({ sessionData: drafted }));
      expect(Object.keys(draft?.dirtyNeighbors ?? {})).toHaveLength(4);
    });
  });
});
