import { realmLabelSeedFileSchema } from "~/lib/maps/realm-labels";
import { seedRealmLabels } from "~/server/modules/maps/realm-labels";

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
