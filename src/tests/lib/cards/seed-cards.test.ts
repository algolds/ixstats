/** @jest-environment node */
import { isSeedCard } from "~/lib/cards/seed-cards";

const seed = {
  cardType: "LORE",
  wikiArticleTitle: null,
  createdAt: new Date("2026-02-16T09:00:00Z"),
  title: "Treaty of Kiro",
};

it("knows the six February seed cards, and nothing else", () => {
  expect(isSeedCard(seed)).toBe(true);
  expect(isSeedCard({ ...seed, title: "Some other card" })).toBe(false);
  expect(isSeedCard({ ...seed, wikiArticleTitle: "Treaty of Kiro" })).toBe(false);
  expect(isSeedCard({ ...seed, createdAt: new Date("2026-02-17T00:00:00Z") })).toBe(false);
  expect(isSeedCard({ ...seed, cardType: "NS" })).toBe(false);
});
