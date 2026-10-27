/** @jest-environment node */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { retireSeedCards } from "../../../scripts/cards/retire-seed-cards";

const rows = [
  {
    id: "a",
    title: "Treaty of Kiro",
    cardType: "LORE",
    wikiArticleTitle: null,
    createdAt: new Date("2026-02-16T09:00:00Z"),
  },
  {
    id: "b",
    title: "Unrelated",
    cardType: "LORE",
    wikiArticleTitle: null,
    createdAt: new Date("2026-02-16T09:00:00Z"),
  },
];

it("lists the seed cards and writes nothing on a dry run", async () => {
  const db = createMockPrisma();
  db.card.findMany.mockResolvedValue(rows);
  await expect(retireSeedCards(db as never, false)).resolves.toEqual({
    found: [{ id: "a", title: "Treaty of Kiro" }],
    retired: 0,
  });
  expect(db.card.updateMany).not.toHaveBeenCalled();
});

it("retires them with an audit row each, and leaves the copies where they are", async () => {
  const db = createMockPrisma();
  db.card.findMany.mockResolvedValue(rows);
  db.card.updateMany.mockResolvedValue({ count: 1 });
  await retireSeedCards(db as never, true);
  expect(db.card.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ["a"] }, isRetired: false },
    data: { isRetired: true, retiredAt: expect.any(Date) },
  });
  expect(db.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ action: "CARD_HIDE", userId: null, target: "a" }),
  });
  expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
});
