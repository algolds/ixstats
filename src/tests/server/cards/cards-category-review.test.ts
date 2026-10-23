/** @jest-environment node */
/** The admin's category review queue: low-confidence guesses and players' suggestions, approve, change or reject. */
jest.mock("~/server/modules/cards/cards.categories", () => ({
  setCardCategoryTx: jest.fn(async () => ({ changed: true })),
}));
import { setCardCategoryTx } from "~/server/modules/cards/cards.categories";
import {
  answerCategorySuggestion,
  listCategoryClassifications,
  listCategorySuggestions,
} from "~/server/modules/cards/cards.category-review";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const pending = {
  id: "s1",
  cardId: "c1",
  status: "PENDING",
  category: "MILITARY",
  subcategory: "unit",
  card: { title: "Kiro" },
};

/** A database holding the suggestion, whose still-pending row each answer claims. */
function dbWith(suggestion: typeof pending | null = pending) {
  const db = createMockPrisma();
  db.cardCategorySuggestion.findUnique.mockResolvedValue(suggestion);
  db.cardCategorySuggestion.updateMany.mockResolvedValue({ count: 1 });
  return db;
}

beforeEach(() => jest.clearAllMocks());

it("lists classifier guesses waiting for review, least confident first, never a retired card", async () => {
  const db = createMockPrisma();
  db.card.count.mockResolvedValue(0);
  await listCategoryClassifications(db as never, { offset: 0, limit: 50 });
  expect(db.card.findMany.mock.calls[0]![0]).toMatchObject({
    where: {
      cardType: "LORE",
      isRetired: false,
      categoryNeedsReview: true,
      categorySource: "CLASSIFIER",
    },
    orderBy: [{ categoryConfidence: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    skip: 0,
    take: 50,
  });
  expect(db.card.count).toHaveBeenCalledWith({
    where: {
      cardType: "LORE",
      isRetired: false,
      categoryNeedsReview: true,
      categorySource: "CLASSIFIER",
    },
  });
});

it("lists pending suggestions oldest first, with the total", async () => {
  const db = createMockPrisma();
  db.cardCategorySuggestion.findMany.mockResolvedValue([{ id: "s1" }]);
  db.cardCategorySuggestion.count.mockResolvedValue(7);
  const result = await listCategorySuggestions(db as never, { offset: 50, limit: 50 });
  expect(result).toEqual({ rows: [{ id: "s1" }], total: 7 });
  expect(db.cardCategorySuggestion.findMany.mock.calls[0]![0]).toMatchObject({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: 50,
    take: 50,
  });
});

it("accepts a suggestion as proposed, through the one category write", async () => {
  const db = dbWith();
  await answerCategorySuggestion(db as never, actor, { suggestionId: "s1", decision: "ACCEPT" });
  expect(jest.mocked(setCardCategoryTx)).toHaveBeenCalledWith(expect.anything(), {
    cardId: "c1",
    choice: { category: "MILITARY", subcategory: "unit" },
    source: "SUGGESTION",
    editor: actor,
    answering: { suggestionId: "s1", status: "ACCEPTED" },
  });
});

it("changes a suggestion to the admin's choice, written as the admin's", async () => {
  const db = dbWith();
  await answerCategorySuggestion(db as never, actor, {
    suggestionId: "s1",
    decision: "CHANGE",
    choice: { category: "HISTORY", subcategory: "event" },
  });
  expect(jest.mocked(setCardCategoryTx)).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      choice: { category: "HISTORY", subcategory: "event" },
      source: "ADMIN",
      answering: { suggestionId: "s1", status: "CHANGED" },
    })
  );
});

it("refuses a change with no choice", async () => {
  const db = dbWith();
  await expect(
    answerCategorySuggestion(db as never, actor, { suggestionId: "s1", decision: "CHANGE" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(jest.mocked(setCardCategoryTx)).not.toHaveBeenCalled();
});

it("rejects a suggestion without touching the card, and refuses one already answered", async () => {
  const db = dbWith();
  await answerCategorySuggestion(db as never, actor, { suggestionId: "s1", decision: "REJECT" });
  expect(jest.mocked(setCardCategoryTx)).not.toHaveBeenCalled();
  expect(db.cardCategorySuggestion.updateMany).toHaveBeenCalledWith({
    where: { id: "s1", status: "PENDING" },
    data: { status: "REJECTED", reviewedBy: "db_admin", reviewedAt: expect.any(Date) },
  });
  expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
    action: "CARD_SUGGESTION",
    target: "c1",
    details: "Turned down a category suggestion for Kiro",
  });
  db.cardCategorySuggestion.findUnique.mockResolvedValue({ ...pending, status: "ACCEPTED" });
  await expect(
    answerCategorySuggestion(db as never, actor, { suggestionId: "s1", decision: "ACCEPT" })
  ).rejects.toMatchObject({ code: "CONFLICT", message: "This suggestion was already answered" });
});

it("refuses an unknown suggestion", async () => {
  const db = dbWith(null);
  await expect(
    answerCategorySuggestion(db as never, actor, { suggestionId: "s9", decision: "REJECT" })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it.each(["ACCEPT", "REJECT"] as const)(
  "refuses to %s a suggestion another admin answered after it was read",
  async (decision) => {
    const db = dbWith();
    db.cardCategorySuggestion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      answerCategorySuggestion(db as never, actor, { suggestionId: "s1", decision })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(jest.mocked(setCardCategoryTx)).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  }
);
