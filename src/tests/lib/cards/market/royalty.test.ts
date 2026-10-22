/** @jest-environment node */
jest.mock("~/lib/vault/vault-ledger", () => {
  class LedgerError extends Error {}
  return { earnCreditsTx: jest.fn(), LedgerError };
});

import { earnCreditsTx, LedgerError } from "~/lib/vault/vault-ledger";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import {
  payNationRoyaltiesTx,
  royaltyRecipientsTx,
  type RoyaltyCard,
} from "~/lib/cards/market/royalty";

const earn = jest.mocked(earnCreditsTx);
const nation: RoyaltyCard = { cardId: "card_n", cardType: "NATION", countryId: "country_1" };

interface CountryRow {
  id: string;
  ownerUserId: string | null;
}

function makeTx(
  countries: CountryRow[] | string | null,
  config: Array<{ key: string; value: string }> = []
) {
  const rows = Array.isArray(countries) ? countries : [{ id: "country_1", ownerUserId: countries }];
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue(config) },
    country: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        rows.filter((c) => where.id.in.includes(c.id))
      ),
    },
  };
}

const pay = (
  tx: ReturnType<typeof makeTx>,
  args: Partial<Parameters<typeof payNationRoyaltiesTx>[1]> = {}
) =>
  payNationRoyaltiesTx(tx as never, {
    cards: [nation],
    partyIds: ["seller", "buyer"],
    amount: 1000,
    fee: 100,
    context: {},
    ...args,
  });

beforeEach(() => {
  clearEconomyConfigCache();
  earn.mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
});

describe("nation royalty", () => {
  it("pays 2% of the amount to the nation's owner, out of the fee", async () => {
    const tx = makeTx("owner");
    const paid = await pay(tx, { context: { listingId: "l1" } });
    expect(paid).toEqual([{ recipientId: "owner", amount: 20, cardId: "card_n" }]);
    expect(earn).toHaveBeenCalledTimes(1);
    expect(earn).toHaveBeenCalledWith(tx, {
      userId: "owner",
      amount: 20,
      type: "EARN_CARDS",
      source: "nation_card_royalty",
      metadata: { listingId: "l1", cardId: "card_n", amount: 1000, royaltyPct: 2 },
    });
    expect(tx.country.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["country_1"] } },
      select: { id: true, ownerUserId: true },
    });
  });

  it.each([
    ["the owner is the seller", "seller", 1000, 100],
    ["the owner is the buyer", "buyer", 1000, 100],
    ["the nation is unowned", null, 1000, 100],
  ])("pays nothing, and reads no rate, when %s", async (_label, owner, amount, fee) => {
    const tx = makeTx(owner);
    expect(await pay(tx, { amount, fee })).toEqual([]);
    expect(earn).not.toHaveBeenCalled();
    // No eligible owner stops before the economy config is read
    expect(tx.systemConfig.findMany).not.toHaveBeenCalled();
  });
  it.each([
    ["is not a nation card", { cardId: "c", cardType: "LORE", countryId: "country_1" }],
    ["shows no nation", { cardId: "c", cardType: "NATION", countryId: null }],
  ] satisfies Array<[string, RoyaltyCard]>)(
    "pays nothing, and looks up no nation, for a card that %s",
    async (_label, card) => {
      const tx = makeTx("owner");
      expect(await pay(tx, { cards: [card], partyIds: [] })).toEqual([]);
      expect(tx.country.findMany).not.toHaveBeenCalled();
      expect(earn).not.toHaveBeenCalled();
    }
  );
  it("never pays more than the fee", async () => {
    expect(await pay(makeTx("owner"), { fee: 5 })).toEqual([
      { recipientId: "owner", amount: 5, cardId: "card_n" },
    ]);
  });
  describe("with several nation cards (a trade's credit leg)", () => {
    const nations = [
      { id: "country_1", ownerUserId: "owner_1" },
      { id: "country_2", ownerUserId: "owner_2" },
    ];
    const two: RoyaltyCard[] = [
      nation,
      { cardId: "card_m", cardType: "NATION", countryId: "country_2" },
    ];

    it("splits the royalty evenly between the owners, rounded down to the cent", async () => {
      // 0.58 / 2 is 0.29, which a float floor pays as 0.28
      expect(await pay(makeTx(nations), { cards: two, amount: 29, fee: 2 })).toEqual([
        { recipientId: "owner_1", amount: 0.29, cardId: "card_n" },
        { recipientId: "owner_2", amount: 0.29, cardId: "card_m" },
      ]);
      expect(earn.mock.calls.map(([, input]) => [input.userId, input.amount])).toEqual([
        ["owner_1", 0.29],
        ["owner_2", 0.29],
      ]);
      expect(await pay(makeTx(nations), { cards: two })).toEqual([
        { recipientId: "owner_1", amount: 10, cardId: "card_n" },
        { recipientId: "owner_2", amount: 10, cardId: "card_m" },
      ]);
    });

    it("pays one owner once for two cards of their nation, the whole royalty", async () => {
      const tx = makeTx(nations);
      const same: RoyaltyCard[] = [nation, { ...nation, cardId: "card_o" }];
      expect(await pay(tx, { cards: same })).toEqual([
        { recipientId: "owner_1", amount: 20, cardId: "card_n" },
      ]);
      expect(tx.country.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["country_1"] } } })
      );
    });

    it("splits only between the owners who are not parties", async () => {
      expect(await pay(makeTx(nations), { cards: two, partyIds: ["owner_1"] })).toEqual([
        { recipientId: "owner_2", amount: 20, cardId: "card_m" },
      ]);
    });
  });

  it("keeps a payout's share with the house when the ledger refuses that payout", async () => {
    // On a sale this needs the config to flip after the seller was paid: with earning off, the seller's EARN_CARDS
    // payment comes first and fails the whole sale (settle-sale.test.ts pins that)
    earn.mockRejectedValueOnce(new LedgerError("EARNING_DISABLED", "Earning credits is off."));
    expect(await pay(makeTx("owner"), { partyIds: [] })).toEqual([]);
  });

  it("lets any other failure through, so the caller's transaction rolls back", async () => {
    earn.mockRejectedValueOnce(new Error("database gone"));
    await expect(pay(makeTx("owner"))).rejects.toThrow("database gone");
  });

  it("names who a royalty would pay, so a sale can lock their vaults first", async () => {
    const nations = [
      { id: "country_1", ownerUserId: "owner_1" },
      { id: "country_2", ownerUserId: "seller" },
    ];
    const cards: RoyaltyCard[] = [
      nation,
      { cardId: "card_m", cardType: "NATION", countryId: "country_2" },
      { cardId: "card_l", cardType: "LORE", countryId: "country_1" },
    ];
    // A party is never paid, and an owner is named once
    expect(await royaltyRecipientsTx(makeTx(nations) as never, cards, ["seller", "buyer"])).toEqual(
      ["owner_1"]
    );
    const none = makeTx(nations);
    expect(
      await royaltyRecipientsTx(none as never, [{ ...nation, cardType: "LORE" }], ["seller"])
    ).toEqual([]);
    expect(none.country.findMany).not.toHaveBeenCalled();
    expect(earn).not.toHaveBeenCalled();
  });
});
