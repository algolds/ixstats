/** @jest-environment node */
jest.mock("~/lib/vault/vault-ledger", () => {
  class LedgerError extends Error {}
  return { earnCreditsTx: jest.fn(), LedgerError };
});
jest.mock("~/lib/cards/market/royalty", () => ({ payNationRoyaltiesTx: jest.fn() }));
jest.mock("~/lib/cards/transfer-events", () => ({ recordSaleTx: jest.fn() }));

import { earnCreditsTx, LedgerError } from "~/lib/vault/vault-ledger";
import { payNationRoyaltiesTx } from "~/lib/cards/market/royalty";
import { recordSaleTx } from "~/lib/cards/transfer-events";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { clearGeneralCardSettingsCache } from "~/lib/cards/general-settings";
import { settleCardSaleTx, type CardSale } from "~/lib/cards/market/settle-sale";

const NOW = new Date("2026-11-02T12:00:00Z");
const sale: CardSale = {
  ownershipId: "own_1",
  cardId: "card_1",
  serialNumber: 12,
  finish: "FOIL",
  cardType: "NATION",
  countryId: "country_1",
  sellerId: "seller",
  buyerId: "buyer",
  price: 500,
  action: "LISTING_SALE",
  sellerSource: "card_sale_listing",
  context: { listingId: "l1" },
  now: NOW,
};

function makeTx(moved: number) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    cardOwnership: { updateMany: jest.fn().mockResolvedValue({ count: moved }) },
  };
}

beforeEach(() => {
  clearEconomyConfigCache();
  clearGeneralCardSettingsCache();
  jest.mocked(earnCreditsTx).mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  jest
    .mocked(payNationRoyaltiesTx)
    .mockReset()
    .mockResolvedValue([{ recipientId: "owner", amount: 10, cardId: "card_1" }]);
  jest.mocked(recordSaleTx).mockReset().mockResolvedValue(undefined);
});

describe("settleCardSaleTx", () => {
  it("moves the seller's locked copy, pays the seller net of the fee, pays the royalty from the fee and records the sale", async () => {
    const tx = makeTx(1);
    const result = await settleCardSaleTx(tx as never, sale);

    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "seller", isLocked: true },
      data: { ownerId: "buyer", isLocked: false, acquiredAt: NOW },
    });
    expect(earnCreditsTx).toHaveBeenCalledTimes(1);
    expect(earnCreditsTx).toHaveBeenCalledWith(tx, {
      userId: "seller",
      amount: 450,
      type: "EARN_CARDS",
      source: "card_sale_listing",
      metadata: { listingId: "l1", ownershipId: "own_1", marketplaceFee: 50, grossSale: 500 },
    });
    expect(payNationRoyaltiesTx).toHaveBeenCalledWith(tx, {
      cards: [{ cardId: "card_1", cardType: "NATION", countryId: "country_1" }],
      partyIds: ["seller", "buyer"],
      amount: 500,
      fee: 50,
      context: { listingId: "l1" },
    });
    expect(recordSaleTx).toHaveBeenCalledWith(tx, {
      ownershipId: "own_1",
      cardId: "card_1",
      serialNumber: 12,
      finish: "FOIL",
      sellerId: "seller",
      buyerId: "buyer",
      price: 500,
      action: "LISTING_SALE",
      now: NOW,
    });
    expect(result).toEqual({
      fee: 50,
      sellerNet: 450,
      royalties: [{ recipientId: "owner", amount: 10, cardId: "card_1" }],
    });
    // Credits out (seller 450 + royalty 10) never exceed the 500 the buyer paid.
    expect(
      result.sellerNet + result.royalties.reduce((s, r) => s + r.amount, 0)
    ).toBeLessThanOrEqual(sale.price);
  });

  it("charges no fee on a sale at the threshold, so there is nothing to carve a royalty from", async () => {
    const result = await settleCardSaleTx(makeTx(1) as never, { ...sale, price: 100 });

    expect(earnCreditsTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "seller", amount: 100 })
    );
    expect(payNationRoyaltiesTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 100, fee: 0 })
    );
    expect(result).toMatchObject({ fee: 0, sellerNet: 100 });
  });

  it("refuses with CONFLICT and pays nobody when the copy is no longer the seller's locked copy", async () => {
    await expect(settleCardSaleTx(makeTx(0) as never, sale)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(payNationRoyaltiesTx).not.toHaveBeenCalled();
    expect(recordSaleTx).not.toHaveBeenCalled();
  });

  it("fails the whole sale when earning is switched off, so the caller rolls the move back", async () => {
    // EARN_CARDS is kill-switched, so the seller's payment is refused before any royalty is reached
    jest
      .mocked(earnCreditsTx)
      .mockRejectedValueOnce(new LedgerError("EARNING_DISABLED", "Earning credits is off."));

    await expect(settleCardSaleTx(makeTx(1) as never, sale)).rejects.toBeInstanceOf(LedgerError);
    expect(payNationRoyaltiesTx).not.toHaveBeenCalled();
    expect(recordSaleTx).not.toHaveBeenCalled();
  });

  it("fails the whole sale when the royalty fails, so the caller rolls the move and the payment back", async () => {
    jest.mocked(payNationRoyaltiesTx).mockRejectedValueOnce(new Error("database gone"));

    await expect(settleCardSaleTx(makeTx(1) as never, sale)).rejects.toThrow("database gone");
    expect(recordSaleTx).not.toHaveBeenCalled();
  });
});
