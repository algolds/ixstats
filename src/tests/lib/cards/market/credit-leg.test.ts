/** @jest-environment node */
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  earnCreditsTx: jest.fn(),
  spendCreditsTx: jest.fn(),
}));
jest.mock("~/lib/cards/market/royalty", () => ({
  payNationRoyaltiesTx: jest.fn(),
  royaltyRecipientsTx: jest.fn(),
}));
jest.mock("~/lib/vault/vault-locks", () => ({ lockVaultsTx: jest.fn() }));

import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { payNationRoyaltiesTx, royaltyRecipientsTx } from "~/lib/cards/market/royalty";
import { lockVaultsTx } from "~/lib/vault/vault-locks";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { clearGeneralCardSettingsCache } from "~/lib/cards/general-settings";
import {
  lockCreditLegVaultsTx,
  settleCreditLegTx,
  type CreditLeg,
} from "~/lib/cards/market/credit-leg";

const tx = { systemConfig: { findMany: jest.fn().mockResolvedValue([]) } };
const nationCard = { cardId: "n1", cardType: "NATION" as const, countryId: "country_1" };
const payout = { recipientId: "owner", amount: 20, cardId: "n1" };
const leg = (over: Partial<CreditLeg> = {}): CreditLeg => ({
  fromUserId: "a",
  toUserId: "b",
  amount: 1000,
  tradeId: "t1",
  paidFor: [nationCard],
  ...over,
});

beforeEach(() => {
  clearEconomyConfigCache();
  clearGeneralCardSettingsCache();
  jest.mocked(spendCreditsTx).mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  jest.mocked(earnCreditsTx).mockReset().mockResolvedValue({ newBalance: 0, amount: 0 });
  jest.mocked(payNationRoyaltiesTx).mockReset().mockResolvedValue([payout]);
  jest.mocked(royaltyRecipientsTx).mockReset().mockResolvedValue([]);
  jest.mocked(lockVaultsTx).mockReset();
});

describe("a trade's credit leg", () => {
  it("charges the payer the full amount, pays the receiver net of the fee, and the royalty from the fee", async () => {
    const result = await settleCreditLegTx(tx as never, leg());
    expect(spendCreditsTx).toHaveBeenCalledWith(tx, {
      userId: "a",
      amount: 1000,
      type: "SPEND_MARKET",
      source: "P2P_TRADE",
      metadata: { tradeId: "t1", marketplaceFee: 100 },
    });
    expect(earnCreditsTx).toHaveBeenCalledWith(tx, {
      userId: "b",
      amount: 900,
      type: "EARN_CARDS",
      source: "P2P_TRADE",
      metadata: { tradeId: "t1", marketplaceFee: 100, gross: 1000 },
    });
    expect(jest.mocked(spendCreditsTx).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(earnCreditsTx).mock.invocationCallOrder[0]!
    );
    expect(payNationRoyaltiesTx).toHaveBeenCalledWith(tx, {
      cards: [nationCard],
      partyIds: ["a", "b"],
      amount: 1000,
      fee: 100,
      context: { tradeId: "t1" },
    });
    expect(result).toEqual({ fee: 100, net: 900, royalties: [payout] });
  });

  it("charges no fee at 100 IxC or less, and rounds the fee down above it", async () => {
    expect(await settleCreditLegTx(tx as never, leg({ amount: 100 }))).toMatchObject({
      fee: 0,
      net: 100,
    });
    expect(earnCreditsTx).toHaveBeenLastCalledWith(
      tx,
      expect.objectContaining({ userId: "b", amount: 100 })
    );
    expect(await settleCreditLegTx(tx as never, leg({ amount: 109 }))).toMatchObject({
      fee: 10,
      net: 99,
    });
  });

  it("moves nothing and pays no royalty for a leg of zero", async () => {
    expect(await settleCreditLegTx(tx as never, leg({ amount: 0 }))).toEqual({
      fee: 0,
      net: 0,
      royalties: [],
    });
    expect(spendCreditsTx).not.toHaveBeenCalled();
    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(payNationRoyaltiesTx).not.toHaveBeenCalled();
  });

  it("turns a payer who can't cover it into a bad request, paying no one", async () => {
    jest
      .mocked(spendCreditsTx)
      .mockRejectedValueOnce(new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits", 10));
    await expect(settleCreditLegTx(tx as never, leg({ amount: 500 }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient credits",
    });
    expect(earnCreditsTx).not.toHaveBeenCalled();
    expect(payNationRoyaltiesTx).not.toHaveBeenCalled();
  });

  it("turns a receiver the ledger refuses (earning off) into a bad request too", async () => {
    jest
      .mocked(earnCreditsTx)
      .mockRejectedValueOnce(new LedgerError("EARNING_DISABLED", "Earning is off", 0));
    await expect(settleCreditLegTx(tx as never, leg())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(payNationRoyaltiesTx).not.toHaveBeenCalled();
  });

  it("rethrows any other failure unchanged", async () => {
    const boom = new Error("connection reset");
    jest.mocked(spendCreditsTx).mockRejectedValueOnce(boom);
    await expect(settleCreditLegTx(tx as never, leg())).rejects.toBe(boom);
  });
});

describe("locking a trade's vaults", () => {
  it("locks every vault the paying legs write, with their royalty recipients, in one ordered lock", async () => {
    jest
      .mocked(royaltyRecipientsTx)
      .mockResolvedValueOnce(["owner_1"])
      .mockResolvedValueOnce(["owner_2"]);
    const back = leg({ fromUserId: "b", toUserId: "a", amount: 5, paidFor: [] });
    await lockCreditLegVaultsTx(tx as never, [leg(), back]);
    expect(royaltyRecipientsTx).toHaveBeenNthCalledWith(1, tx, [nationCard], ["a", "b"]);
    expect(royaltyRecipientsTx).toHaveBeenNthCalledWith(2, tx, [], ["b", "a"]);
    expect(lockVaultsTx).toHaveBeenCalledTimes(1);
    expect(lockVaultsTx).toHaveBeenCalledWith(tx, ["a", "b", "owner_1", "b", "a", "owner_2"]);
  });

  it("leaves out a leg of zero, and locks nothing when no credits move", async () => {
    await lockCreditLegVaultsTx(tx as never, [
      leg({ amount: 0 }),
      leg({ fromUserId: "b", toUserId: "c", amount: 3 }),
    ]);
    expect(royaltyRecipientsTx).toHaveBeenCalledTimes(1);
    expect(lockVaultsTx).toHaveBeenCalledWith(tx, ["b", "c"]);

    jest.mocked(lockVaultsTx).mockClear();
    await lockCreditLegVaultsTx(tx as never, [leg({ amount: 0 })]);
    expect(lockVaultsTx).not.toHaveBeenCalled();
  });
});
