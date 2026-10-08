import { realmLabelSeedFileSchema } from "~/lib/maps/realm-labels";
import { sourcePreset } from "~/lib/realms/sources/presets";
import {
  realmLabelData,
  seedRealmLabels,
  storedRealmLabelRank,
} from "~/server/modules/maps/realm-labels";

interface Row {
  id: string;
  text: string;
  labelType: string;
  coordinates: [number, number];
  metadata: { rank?: string; seedKey?: string } | null;
}

function fakeDb(rows: Row[]) {
  return {
    mapLabel: {
      findMany: jest.fn(async () => rows),
      create: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
    },
  };
}

const ENTRIES = realmLabelSeedFileSchema.parse({
  source: "test",
  labels: [
    { key: "Argic Ocean (west)", text: "Argic Ocean", kind: "ocean", coordinates: [-33.3, 82.8] },
    { text: "Auraid Bay", kind: "sea", rank: "minor", coordinates: [6.75, 38.4] },
    { text: "Kosscow Sea", kind: "sea", coordinates: [99.45, 61.43] },
  ],
}).labels;

describe("realm label data", () => {
  it("stores the rank (the kind's unless given) in the label's metadata", () => {
    expect(
      realmLabelData({ text: "Argic Ocean", labelType: "ocean", coordinates: [1, 2] })
    ).toEqual({
      text: "Argic Ocean",
      labelType: "ocean",
      coordinates: [1, 2],
      metadata: { rank: "major" },
    });
    expect(
      realmLabelData({ text: "Auraid Bay", labelType: "sea", coordinates: [1, 2], rank: "minor" })
        .metadata
    ).toEqual({ rank: "minor" });
  });

  it("reads a stored rank back, ignoring anything else", () => {
    expect(storedRealmLabelRank({ rank: "minor" })).toBe("minor");
    expect(storedRealmLabelRank({ rank: 3 })).toBeUndefined();
    expect(storedRealmLabelRank(["minor"])).toBeUndefined();
    expect(storedRealmLabelRank(null)).toBeUndefined();
  });
});

describe("seeding a realm's labels", () => {
  it("a dry run reports what would be created and writes nothing", async () => {
    const db = fakeDb([]);
    const report = await seedRealmLabels(db as never, "realm_1", ENTRIES, {
      apply: false,
      submittedBy: "script",
    });
    expect(report).toEqual({
      created: ["Argic Ocean (west)", "Auraid Bay", "Kosscow Sea"],
      updated: [],
      unchanged: 0,
    });
    expect(db.mapLabel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "realm_1", countryId: null } })
    );
    expect(db.mapLabel.create).not.toHaveBeenCalled();
  });

  it("creates approved realm labels keyed for the next run", async () => {
    const db = fakeDb([]);
    await seedRealmLabels(db as never, "realm_1", ENTRIES, { apply: true, submittedBy: "script" });
    expect(db.mapLabel.create).toHaveBeenCalledTimes(3);
    expect(db.mapLabel.create.mock.calls[0]).toEqual([
      {
        data: {
          text: "Argic Ocean",
          labelType: "ocean",
          coordinates: [-33.3, 82.8],
          metadata: { rank: "major", seedKey: "Argic Ocean (west)" },
          realmId: "realm_1",
          countryId: null,
          status: "approved",
          submittedBy: "script",
        },
      },
    ]);
  });

  it("is idempotent: matches by key (or by name for a hand-made label), updates only what changed", async () => {
    const db = fakeDb([
      {
        id: "a",
        text: "Argic Ocean",
        labelType: "ocean",
        coordinates: [-33.3, 82.8],
        metadata: { rank: "major", seedKey: "Argic Ocean (west)" },
      },
      {
        id: "b",
        text: "Auraid Bay",
        labelType: "sea",
        coordinates: [6, 38],
        metadata: { rank: "minor", seedKey: "Auraid Bay" },
      },
      {
        id: "c",
        text: "Kosscow Sea",
        labelType: "sea",
        coordinates: [99.45, 61.43],
        metadata: null,
      },
    ]);
    const report = await seedRealmLabels(db as never, "realm_1", ENTRIES, {
      apply: true,
      submittedBy: "script",
    });
    expect(report).toEqual({ created: [], updated: ["Auraid Bay", "Kosscow Sea"], unchanged: 1 });
    expect(db.mapLabel.create).not.toHaveBeenCalled();
    expect(db.mapLabel.update.mock.calls).toEqual([
      [
        {
          where: { id: "b" },
          data: {
            text: "Auraid Bay",
            labelType: "sea",
            coordinates: [6.75, 38.4],
            metadata: { rank: "minor", seedKey: "Auraid Bay" },
          },
        },
      ],
      [
        {
          where: { id: "c" },
          data: {
            text: "Kosscow Sea",
            labelType: "sea",
            coordinates: [99.45, 61.43],
            metadata: { rank: "medium", seedKey: "Kosscow Sea" },
          },
        },
      ],
    ]);
  });
});

describe("Eurth's labels (its source preset's map pipeline)", () => {
  const file = realmLabelSeedFileSchema.parse(sourcePreset("eurth-map")!.mapPipeline!.labels);

  it("names each label once per key, inside the map", () => {
    const keys = file.labels.map((l) => l.key ?? l.text);
    expect(new Set(keys).size).toBe(keys.length);
    for (const { coordinates } of file.labels) {
      expect(Math.abs(coordinates[0])).toBeLessThanOrEqual(180);
      expect(Math.abs(coordinates[1])).toBeLessThan(85.06);
    }
  });

  it("carries the art's oceans", () => {
    const oceans = file.labels.filter((l) => l.kind === "ocean").map((l) => l.text);
    expect(new Set(oceans)).toEqual(
      new Set([
        "Argic Ocean",
        "North Oriental Ocean",
        "Adlantic Ocean",
        "Adisi Ocean",
        "South Oriental Ocean",
        "Antargic Ocean",
      ])
    );
  });
});
