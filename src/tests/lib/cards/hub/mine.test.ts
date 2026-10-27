/** @jest-environment node */
/** Mine's filters come from the player's own copies; Uncategorised finds their lore copies with no category. */
import { MineQuerySchema, selectMine, type MineEntry } from "~/lib/cards/hub/mine";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
let n = 0;
/** One copy, with exactly the columns MINE_COPY_SELECT reads (COPY_FACE_SELECT, the copy's own, CARD_FACE_SELECT). */
function entry(cardType: "LORE" | "NS", category: "HISTORY" | null): MineEntry {
  n += 1;
  return {
    value: 10,
    row: {
      id: `o${n}`,
      finish: "STANDARD",
      serialNumber: n,
      level: 1,
      cardId: `c${n}`,
      acquiredAt: new Date(2026, 0, n),
      isLocked: false,
      inscription: null,
      importDiscounted: false,
      cards: {
        id: `c${n}`,
        title: `Card ${n}`,
        rarity: "COMMON",
        cardType,
        artwork: null,
        isRetired: false,
        collectorNumber: n,
        season: 1,
        nsSeason: null,
        realm,
        category,
        isBound: false,
      },
    },
  };
}

const query = (input: object = {}) => MineQuerySchema.parse(input);

it("offers the types and categories of the player's own copies, Uncategorised included", () => {
  const page = selectMine(
    [entry("LORE", "HISTORY"), entry("LORE", null), entry("NS", null)],
    query()
  );
  expect(page.facets).toEqual({ types: ["LORE", "NS"], categories: ["HISTORY", "UNCATEGORISED"] });
});

it("keeps the facets of every copy while a filter narrows the page", () => {
  const page = selectMine([entry("LORE", "HISTORY"), entry("NS", null)], query({ types: ["NS"] }));
  expect(page.rows).toHaveLength(1);
  expect(page.facets.types).toEqual(["LORE", "NS"]);
});

it("matches Uncategorised to lore copies with no category only", () => {
  const page = selectMine(
    [entry("LORE", "HISTORY"), entry("LORE", null), entry("NS", null)],
    query({ categories: ["UNCATEGORISED"] })
  );
  expect(page.rows.map((row) => row.face.cardType)).toEqual(["LORE"]);
  expect(page.total).toBe(1);
});
