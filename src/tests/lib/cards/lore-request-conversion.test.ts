/** @jest-environment node */
/** Old paid requests become free suggestions, with no refund. */
import { planRequestConversion } from "~/lib/cards/lore-request-conversion";

const row = (id: string, status: string, realmId: string | null = null) => ({
  id,
  status,
  userId: "u",
  articleTitle: "Elm",
  wikiSource: "iiwiki",
  realmId,
});

it("reopens approved requests and homes every open one; finished ones stay as they are", () => {
  const plan = planRequestConversion([
    row("a", "PENDING"),
    row("b", "APPROVED"),
    row("c", "GENERATED"),
    row("d", "REJECTED"),
    row("e", "PENDING", "iiwiki"),
  ]);
  expect(plan.reopen).toEqual(["b"]);
  expect(plan.home.map((r) => r.id)).toEqual(["a", "b"]);
  expect(plan.byStatus).toEqual({ PENDING: 2, APPROVED: 1, GENERATED: 1, REJECTED: 1 });
});

it("is a no-op once applied", () => {
  const plan = planRequestConversion([row("a", "PENDING", "iiwiki")]);
  expect(plan.reopen).toEqual([]);
  expect(plan.home).toEqual([]);
});
