/** @jest-environment node */
/** "Suggest a category": rate-limited, one open suggestion per card per player, for the admin queue. */
import { suggestCategory } from "~/server/modules/cards/cards.category-suggestions";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-24T12:00:00Z");
const lore = {
  id: "c1",
  cardType: "LORE",
  isRetired: false,
  category: "HISTORY",
  subcategory: null,
};
const input = {
  cardId: "c1",
  choice: { category: "MILITARY" as const, subcategory: "battle-or-war" },
  note: "  It is a battle.  ",
};

function dbWith(card: object | null = lore) {
  const db = createMockPrisma({ $executeRaw: jest.fn() });
  db.card.findUnique.mockResolvedValue(card);
  db.cardCategorySuggestion.count.mockResolvedValue(0);
  db.cardCategorySuggestion.findFirst.mockResolvedValue(null);
  return db;
}

it("sends a suggestion under the player's lock, with the note trimmed", async () => {
  const db = dbWith();
  await expect(suggestCategory(db as never, "u1", input, NOW)).resolves.toEqual({ status: "sent" });
  const [strings, ns, id] = db.$executeRaw.mock.calls[0]! as [TemplateStringsArray, number, string];
  expect(strings.join("?")).toContain("pg_advisory_xact_lock(");
  expect([ns, id]).toEqual([7340, "u1"]);
  expect(db.cardCategorySuggestion.create).toHaveBeenCalledWith({
    data: {
      cardId: "c1",
      userId: "u1",
      category: "MILITARY",
      subcategory: "battle-or-war",
      note: "It is a battle.",
    },
  });
});

it("stores an empty note as none", async () => {
  const db = dbWith();
  await suggestCategory(db as never, "u1", { ...input, note: "   " }, NOW);
  expect(db.cardCategorySuggestion.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ note: null }),
  });
});

it("keeps one open suggestion per card per player", async () => {
  const db = dbWith();
  db.cardCategorySuggestion.findFirst.mockResolvedValue({ id: "s0" });
  await expect(suggestCategory(db as never, "u1", input, NOW)).resolves.toEqual({
    status: "already",
  });
  expect(db.cardCategorySuggestion.findFirst).toHaveBeenCalledWith({
    where: { cardId: "c1", userId: "u1", status: "PENDING" },
    select: { id: true },
  });
  expect(db.cardCategorySuggestion.create).not.toHaveBeenCalled();
});

it("caps a player at 10 a day", async () => {
  const db = dbWith();
  db.cardCategorySuggestion.count.mockResolvedValue(10);
  await expect(suggestCategory(db as never, "u1", input, NOW)).rejects.toMatchObject({
    code: "TOO_MANY_REQUESTS",
    message: "You can suggest 10 categories a day. Try again tomorrow.",
  });
  expect(db.cardCategorySuggestion.count).toHaveBeenCalledWith({
    where: { userId: "u1", createdAt: { gte: new Date(NOW.getTime() - 24 * 60 * 60 * 1000) } },
  });
  expect(db.cardCategorySuggestion.create).not.toHaveBeenCalled();
});

it("lets a ninth suggestion of the day through", async () => {
  const db = dbWith();
  db.cardCategorySuggestion.count.mockResolvedValue(9);
  await expect(suggestCategory(db as never, "u1", input, NOW)).resolves.toEqual({ status: "sent" });
});

it.each([
  ["a missing card", null, "NOT_FOUND", "Card not found"],
  ["an NS card", { ...lore, cardType: "NS" }, "NOT_FOUND", "Card not found"],
  ["a retired card", { ...lore, isRetired: true }, "NOT_FOUND", "Card not found"],
  [
    "the card's own category",
    { ...lore, category: "MILITARY", subcategory: "battle-or-war" },
    "BAD_REQUEST",
    "That is already its category",
  ],
])("refuses %s", async (_, card, code, message) => {
  const db = dbWith(card);
  await expect(suggestCategory(db as never, "u1", input, NOW)).rejects.toMatchObject({
    code,
    message,
  });
  expect(db.$transaction).not.toHaveBeenCalled();
});

it("refuses a suggestion with no category", async () => {
  const db = dbWith();
  const none = { ...input, choice: { category: null, subcategory: null } };
  await expect(suggestCategory(db as never, "u1", none, NOW)).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "Pick a category",
  });
  expect(db.$transaction).not.toHaveBeenCalled();
});

it("refuses a subcategory from another category", async () => {
  const db = dbWith();
  const wrong = { ...input, choice: { category: "MILITARY" as const, subcategory: "event" } };
  await expect(suggestCategory(db as never, "u1", wrong, NOW)).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "That subcategory is not in that category",
  });
});
