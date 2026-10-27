/** @jest-environment node */
/** The one path an admin, a realm owner or an accepted suggestion writes a lore card's category by. */
import { CARD_AUDIT_ACTIONS } from "~/server/modules/cards/cards.audit";
import { setCardCategory, setCardCategoryTx } from "~/server/modules/cards/cards.categories";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-24T12:00:00Z");
const editor = { dbId: "db_admin", clerkId: "clerk_admin" };
const stored = {
  id: "c1",
  title: "Battle of Kiro",
  cardType: "LORE",
  realmId: "default",
  category: "HISTORY",
  subcategory: null,
};

function dbWith(card: object | null = stored) {
  const tx = createMockPrisma();
  tx.card.findUnique.mockResolvedValue(card);
  return tx;
}

it("writes the choice, clears the review flag and confidence, stamps the reviewer, and audits it", async () => {
  const tx = dbWith();
  const choice = { category: "MILITARY" as const, subcategory: "battle-or-war" };
  await expect(
    setCardCategoryTx(tx as never, { cardId: "c1", choice, source: "ADMIN", editor }, NOW)
  ).resolves.toEqual({ changed: true });
  expect(tx.card.update).toHaveBeenCalledWith({
    where: { id: "c1" },
    data: {
      category: "MILITARY",
      subcategory: "battle-or-war",
      categorySource: "ADMIN",
      categoryConfidence: null,
      categoryNeedsReview: false,
      categoryReviewedAt: NOW,
      categoryReviewedBy: "db_admin",
    },
  });
  expect(tx.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "CARD_CATEGORY",
      userId: "clerk_admin",
      target: "c1",
      details: "Battle of Kiro: History → Military · Battle or war (admin)",
    }),
  });
});

it("still writes and audits an unchanged choice, which confirms the guess, and says it did not change", async () => {
  const tx = dbWith();
  const choice = { category: "HISTORY" as const, subcategory: null };
  await expect(
    setCardCategoryTx(
      tx as never,
      { cardId: "c1", realmId: "default", choice, source: "REALM_OWNER", editor },
      NOW
    )
  ).resolves.toEqual({ changed: false });
  expect(tx.card.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ categorySource: "REALM_OWNER", categoryNeedsReview: false }),
    })
  );
  expect(tx.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      details: "Battle of Kiro: History → History (realm owner)",
    }),
  });
  expect(tx.cardCategorySuggestion.updateMany).not.toHaveBeenCalled();
});

it("names an accepted suggestion on the trail, and an uncategorised card as such", async () => {
  const tx = dbWith({ ...stored, category: null });
  const choice = { category: "RELIGION" as const, subcategory: "faith" };
  await setCardCategoryTx(tx as never, { cardId: "c1", choice, source: "SUGGESTION", editor }, NOW);
  expect(tx.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      details: "Battle of Kiro: Uncategorised → Religion · Faith (a player's suggestion)",
    }),
  });
});

it("refuses a missing card, a card that is not lore, and a subcategory outside its category", async () => {
  const history = { category: "HISTORY" as const, subcategory: null };
  await expect(
    setCardCategoryTx(dbWith(null) as never, {
      cardId: "c1",
      choice: history,
      source: "ADMIN",
      editor,
    })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    setCardCategoryTx(dbWith({ ...stored, cardType: "NS" }) as never, {
      cardId: "c1",
      choice: history,
      source: "ADMIN",
      editor,
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Only lore cards have a category" });
  const tx = dbWith();
  await expect(
    setCardCategoryTx(tx as never, {
      cardId: "c1",
      choice: { category: "ECONOMY", subcategory: "army" },
      source: "ADMIN",
      editor,
    })
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "That subcategory is not in that category",
  });
  expect(tx.card.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});

it("answers a realm owner about another realm's card as not found", async () => {
  const tx = dbWith();
  await expect(
    setCardCategoryTx(tx as never, {
      cardId: "c1",
      realmId: "eurth",
      choice: { category: "HISTORY", subcategory: null },
      source: "REALM_OWNER",
      editor,
    })
  ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Card not found" });
  expect(tx.card.update).not.toHaveBeenCalled();
});

it("closes the card's open suggestions: the answered one as asked, the rest accepted or changed", async () => {
  const tx = dbWith();
  tx.cardCategorySuggestion.findMany.mockResolvedValue([
    { id: "s1", category: "HISTORY", subcategory: null },
    { id: "s2", category: "MILITARY", subcategory: "unit" },
    { id: "s3", category: "MILITARY", subcategory: null },
    { id: "s4", category: "ECONOMY", subcategory: "company" },
  ]);
  const choice = { category: "MILITARY" as const, subcategory: "unit" };
  await setCardCategoryTx(
    tx as never,
    {
      cardId: "c1",
      choice,
      source: "ADMIN",
      editor,
      answering: { suggestionId: "s1", status: "CHANGED" },
    },
    NOW
  );
  expect(tx.cardCategorySuggestion.findMany).toHaveBeenCalledWith({
    where: { cardId: "c1", status: "PENDING" },
    select: { id: true, category: true, subcategory: true },
  });
  const stamp = { reviewedBy: "db_admin", reviewedAt: NOW };
  expect(tx.cardCategorySuggestion.updateMany.mock.calls.map(([args]) => args)).toEqual([
    { where: { id: { in: ["s1"] }, status: "PENDING" }, data: { status: "CHANGED", ...stamp } },
    { where: { id: { in: ["s2"] }, status: "PENDING" }, data: { status: "ACCEPTED", ...stamp } },
    {
      where: { id: { in: ["s3", "s4"] }, status: "PENDING" },
      data: { status: "CHANGED", ...stamp },
    },
  ]);
});

it("skips an empty group: one matching suggestion is accepted alone", async () => {
  const tx = dbWith();
  tx.cardCategorySuggestion.findMany.mockResolvedValue([
    { id: "s2", category: "MILITARY", subcategory: null },
  ]);
  const choice = { category: "MILITARY" as const, subcategory: null };
  await setCardCategoryTx(tx as never, { cardId: "c1", choice, source: "ADMIN", editor }, NOW);
  expect(tx.cardCategorySuggestion.updateMany.mock.calls.map(([args]) => args)).toEqual([
    {
      where: { id: { in: ["s2"] }, status: "PENDING" },
      data: { status: "ACCEPTED", reviewedBy: "db_admin", reviewedAt: NOW },
    },
  ]);
});

it("runs the whole write in one transaction", async () => {
  const db = dbWith();
  const choice = { category: "MILITARY" as const, subcategory: null };
  await expect(
    setCardCategory(db as never, { cardId: "c1", choice, source: "ADMIN", editor })
  ).resolves.toEqual({ changed: true });
  expect(db.$transaction).toHaveBeenCalledTimes(1);
  expect(db.card.update).toHaveBeenCalledTimes(1);
});

it("names the action on the trail and the Overview feed", () => {
  expect(CARD_AUDIT_ACTIONS).toContain("CARD_CATEGORY");
});
