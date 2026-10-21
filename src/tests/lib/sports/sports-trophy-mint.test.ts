/** @jest-environment node */
/** Cards refresh §2.1 and §5.4: a championship mints a bound Trophy, its copy Serialised, through mintCopy. */
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn().mockResolvedValue({ id: "copy_1" }) }));

import { mintCopy } from "~/lib/cards/mint";
import { mintTrophyCard } from "~/lib/sports/transition";
import { worldCupChampionsTitle } from "~/lib/sports/trophy-titles";

const card = {
  title: worldCupChampionsTitle("Caphiria", 4),
  description: "d",
  artwork: "a.png",
  rarity: "LEGENDARY" as const,
  season: 4,
  marketValue: 1000,
};

it("creates the Trophy card once, bound, in Ixnay, and mints a Serialised copy each time", async () => {
  const tx = {
    card: {
      findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "t1" }),
      create: jest.fn().mockResolvedValue({ id: "t1" }),
    },
  };
  await mintTrophyCard(tx as never, { ownerUserId: "u1", card });
  await mintTrophyCard(tx as never, { ownerUserId: "u2", card });
  expect(tx.card.create).toHaveBeenCalledTimes(1);
  expect(tx.card.create).toHaveBeenCalledWith({
    data: { ...card, cardType: "TROPHY", isBound: true, realmId: "default", totalSupply: 1 },
  });
  expect(tx.card.findFirst).toHaveBeenCalledWith({
    where: { title: card.title, cardType: "TROPHY" },
  });
  expect(jest.mocked(mintCopy).mock.calls.map(([, input]) => input)).toEqual([
    { cardId: "t1", ownerId: "u1", finish: "SERIALISED", source: "SPORTS" },
    { cardId: "t1", ownerId: "u2", finish: "SERIALISED", source: "SPORTS" },
  ]);
});
