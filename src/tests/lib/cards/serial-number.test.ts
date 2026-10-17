/** Plan 331: per-card advisory lock taken before max(serial) is read; a removed copy's serial is never reissued. */

import { allocateSerialNumberTx, highestIssuedSerialTx } from "~/lib/cards/serial-number";

function makeTx() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    cardOwnership: { findFirst: jest.fn() },
    cardTransferEvent: { findFirst: jest.fn() },
  };
}
const asTx = (tx: ReturnType<typeof makeTx>) => tx as never;

describe("allocateSerialNumberTx", () => {
  it("takes the per-card advisory lock before reading the current max serial", async () => {
    const tx = makeTx();
    tx.cardOwnership.findFirst.mockResolvedValue({ serialNumber: 4 });

    await allocateSerialNumberTx(asTx(tx), "card_1");

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cardOwnership.findFirst.mock.invocationCallOrder[0]
    );

    // Tagged template: [strings, ...values]; the SQL names the xact lock and binds the cardId.
    const [strings, namespace, cardId] = tx.$executeRaw.mock.calls[0];
    expect(strings.join("?")).toContain("pg_advisory_xact_lock(?::int, hashtext(?))");
    expect(namespace).toBe(7331);
    expect(cardId).toBe("card_1");
  });

  it("returns max + 1", async () => {
    const tx = makeTx();
    tx.cardOwnership.findFirst.mockResolvedValue({ serialNumber: 4 });

    await expect(allocateSerialNumberTx(asTx(tx), "card_1")).resolves.toBe(5);
    expect(tx.cardOwnership.findFirst).toHaveBeenCalledWith({
      where: { cardId: "card_1" },
      orderBy: { serialNumber: "desc" },
      select: { serialNumber: true },
    });
  });

  it("counts the serials in the card's trail, so a removed copy's serial is never issued again", async () => {
    const tx = makeTx();
    tx.cardOwnership.findFirst.mockResolvedValue({ serialNumber: 4 });
    tx.cardTransferEvent.findFirst.mockResolvedValue({ serialNumber: 7 });

    await expect(allocateSerialNumberTx(asTx(tx), "card_1")).resolves.toBe(8);
    expect(tx.cardTransferEvent.findFirst).toHaveBeenCalledWith({
      where: { cardId: "card_1", serialNumber: { not: null } },
      orderBy: { serialNumber: "desc" },
      select: { serialNumber: true },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cardTransferEvent.findFirst.mock.invocationCallOrder[0]
    );
  });

  it("returns 1 when the card has no ownership rows yet", async () => {
    const tx = makeTx();
    tx.cardOwnership.findFirst.mockResolvedValue(null);

    await expect(allocateSerialNumberTx(asTx(tx), "card_new")).resolves.toBe(1);
  });
});

describe("highestIssuedSerialTx", () => {
  it("is the card's high-water mark over its copies and its trail, 0 for none, and takes no lock of its own", async () => {
    const tx = makeTx();
    tx.cardOwnership.findFirst.mockResolvedValue(null);
    tx.cardTransferEvent.findFirst.mockResolvedValue({ serialNumber: 1 });
    await expect(highestIssuedSerialTx(asTx(tx), "trophy")).resolves.toBe(1);

    tx.cardTransferEvent.findFirst.mockResolvedValue(null);
    await expect(highestIssuedSerialTx(asTx(tx), "fresh")).resolves.toBe(0);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
