/** @jest-environment node */
/**
 * Minting a copy (`mintCopy`): concurrent mints of one card get distinct serials under the card's serial lock, a
 * removed copy's serial is never issued again, the mint row records source, serial and finish, a Serialised run is
 * held to its size and a voided one-of-one comes back under its own serial; serial locks are taken in UTF-16 code
 * unit order, so every multi-card path locks cards in one order.
 *
 * Folds serial-number.
 */
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { mintCopy } from "~/lib/cards/mint";
import { allocateSerialNumberTx, serialLockOrder } from "~/lib/cards/serial-number";

interface CopyRow {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  finish: string;
  importDiscounted: boolean;
}

type ConfigRow = { key: string; value: string };

beforeEach(() => clearEconomyConfigCache());

/**
 * A database with one advisory lock that a transaction holds from its lock call until it ends (as
 * pg_advisory_xact_lock), and reads that yield, so racing transactions interleave unless the lock serialises them.
 */
function fakeDatabase(runs: Record<string, number | null> = {}, config: ConfigRow[] = []) {
  const copies: CopyRow[] = [];
  const events: Array<Record<string, string | number | null>> = [];
  const create = jest.fn(async ({ data }: { data: Omit<CopyRow, "id"> }) => {
    await tick();
    const row = { id: `cuid_${copies.length + 1}`, ...data };
    copies.push(row);
    return row;
  });
  let queue: Promise<void> = Promise.resolve();
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

  async function transaction<T>(run: (tx: never) => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    let locked = false;
    const tx = {
      $executeRaw: async () => {
        if (locked) return 1;
        locked = true;
        const previous = queue;
        queue = new Promise<void>((resolve) => (release = resolve));
        await previous;
        return 1;
      },
      card: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id in runs ? { totalSupply: runs[where.id] ?? null } : null,
      },
      // The Economy tab's rows, which the finish roll reads
      systemConfig: { findMany: async () => config },
      cardOwnership: {
        findFirst: async ({ where }: { where: { cardId: string } }) => {
          await tick();
          const serials = copies
            .filter((c) => c.cardId === where.cardId)
            .map((c) => c.serialNumber);
          return serials.length > 0 ? { serialNumber: Math.max(...serials) } : null;
        },
        create,
      },
      cardTransferEvent: {
        create: async ({ data }: { data: Record<string, string | number | null> }) => {
          events.push(data);
          return data;
        },
        findFirst: async () => null,
      },
    };
    try {
      return await run(tx as never);
    } finally {
      release();
    }
  }
  return { transaction, copies, events, create };
}

describe("mintCopy", () => {
  it("gives concurrent mints of one card distinct serials", async () => {
    const db = fakeDatabase();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        db.transaction((tx) =>
          mintCopy(tx, { cardId: "c1", ownerId: `u${i}`, finish: "STANDARD", source: "PACK_OPEN" })
        )
      )
    );
    expect(db.copies.map((c) => c.serialNumber).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("writes the mint row of the provenance trail with its source, card, serial and finish", async () => {
    const db = fakeDatabase();
    await db.transaction((tx) =>
      mintCopy(tx, { cardId: "c1", ownerId: "u1", finish: "FOIL", source: "NS_DECK_IMPORT" })
    );
    expect(db.events).toEqual([
      {
        ownershipId: "cuid_1",
        cardId: "c1",
        serialNumber: 1,
        finish: "FOIL",
        toUserId: "u1",
        action: "NS_DECK_IMPORT",
      },
    ]);
  });
  it("keeps a named finish whatever the odds, and marks imported copies for the import share of dust", async () => {
    const db = fakeDatabase({}, [{ key: "card_economy_finish_holo_pct", value: "100" }]);
    await db.transaction((tx) =>
      mintCopy(tx, {
        cardId: "card_1",
        ownerId: "u1",
        source: "NS_DECK_IMPORT",
        finish: "STANDARD",
      })
    );
    expect(db.copies[0]).toMatchObject({ finish: "STANDARD", importDiscounted: true });
    expect(db.events[0]).toMatchObject({ finish: "STANDARD", action: "NS_DECK_IMPORT" });
  });
  it("refuses a Serialised copy past its run, and never limits a Standard one", async () => {
    const db = fakeDatabase({ trophy: 1 });
    const serial = (finish: "SERIALISED" | "STANDARD") =>
      db.transaction((tx) =>
        mintCopy(tx, { cardId: "trophy", ownerId: "u1", finish, source: "TROPHY" })
      );
    await expect(serial("SERIALISED")).resolves.toMatchObject({ serialNumber: 1 });
    await expect(serial("SERIALISED")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(serial("STANDARD")).resolves.toMatchObject({ serialNumber: 2 });
  });
});

describe("mintCopy reissuing a serial", () => {
  type ReissueCard = { isBound: boolean; totalSupply: number | null } | null;

  /** A card, its live copies and how many trail rows hold the asked serial, as the reissue reads them. */
  function reissueTx(card: ReissueCard, live = 0, issued = 1) {
    return {
      $executeRaw: jest.fn().mockResolvedValue(1),
      card: { findUnique: jest.fn().mockResolvedValue(card) },
      cardOwnership: {
        count: jest.fn().mockResolvedValue(live),
        create: jest.fn(async ({ data }: { data: Omit<CopyRow, "id"> }) => ({
          id: "own_new",
          ...data,
        })),
      },
      cardTransferEvent: { count: jest.fn().mockResolvedValue(issued), create: jest.fn() },
    };
  }
  const reissue = (tx: ReturnType<typeof reissueTx>, serialNumber = 1) =>
    mintCopy(tx as never, {
      cardId: "trophy",
      ownerId: "u2",
      finish: "SERIALISED",
      source: "TROPHY",
      serialNumber,
    });

  it("mints a bound one-of-one's voided serial again, under its lock, and records the mint row as REISSUE", async () => {
    const tx = reissueTx({ isBound: true, totalSupply: 1 });

    await expect(reissue(tx)).resolves.toMatchObject({ serialNumber: 1 });

    expect(tx.cardOwnership.create).toHaveBeenCalledWith({
      data: {
        cardId: "trophy",
        ownerId: "u2",
        serialNumber: 1,
        finish: "SERIALISED",
        importDiscounted: false,
      },
    });
    expect(tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_new",
        cardId: "trophy",
        serialNumber: 1,
        finish: "SERIALISED",
        toUserId: "u2",
        action: "REISSUE",
      },
    });
    expect(tx.card.findUnique).toHaveBeenCalledWith({
      where: { id: "trophy" },
      select: { isBound: true, totalSupply: true },
    });
    expect(tx.cardOwnership.count).toHaveBeenCalledWith({ where: { cardId: "trophy" } });
    expect(tx.cardTransferEvent.count).toHaveBeenCalledWith({
      where: { cardId: "trophy", serialNumber: 1 },
    });
    const [strings, namespace, cardId] = tx.$executeRaw.mock.calls[0];
    expect(strings.join("?")).toContain("pg_advisory_xact_lock");
    expect([namespace, cardId]).toEqual([7331, "trophy"]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cardOwnership.count.mock.invocationCallOrder[0]!
    );
  });

  it.each<[string, ReissueCard, number, number]>([
    ["an unbound card", { isBound: false, totalSupply: 1 }, 0, 1],
    ["a card with a longer run", { isBound: true, totalSupply: 5 }, 0, 1],
    ["a card with no run size", { isBound: true, totalSupply: null }, 0, 1],
    ["a missing card", null, 0, 1],
    ["a one-of-one with a live copy", { isBound: true, totalSupply: 1 }, 1, 1],
    ["a one-of-one that never issued the serial", { isBound: true, totalSupply: 1 }, 0, 0],
  ])("refuses to reissue a serial of %s", async (_, card, live, issued) => {
    const tx = reissueTx(card, live, issued);

    await expect(reissue(tx)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Only a bound one-of-one with no live copy can have its serial reissued",
    });
    expect(tx.cardOwnership.create).not.toHaveBeenCalled();
  });

  it("keeps the run check on a reissue: a one-of-one's serial 2 is past its run", async () => {
    const tx = reissueTx({ isBound: true, totalSupply: 1 });

    await expect(reissue(tx, 2)).rejects.toThrow("Every copy of this card's run has been minted");
    expect(tx.cardOwnership.create).not.toHaveBeenCalled();
  });
});

describe("serials and their lock order", () => {
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
  });
  /** NS ids where a locale's order and code-unit order disagree: ICU sorts "_" before digits, code units after. */
  const NS_LONG = "card_ns_1086420_s4";
  const NS_SHORT = "card_ns_108642_s4";

  describe("serialLockOrder", () => {
    it("lists each card once, by UTF-16 code unit, whatever the locale would say", () => {
      expect(serialLockOrder([NS_SHORT, "card_b", NS_LONG, "Card_z", NS_SHORT, "card_b"])).toEqual([
        "Card_z",
        "card_b",
        NS_LONG,
        NS_SHORT,
      ]);
      expect(serialLockOrder(new Set(["b", "a"]))).toEqual(["a", "b"]);
      expect(serialLockOrder([])).toEqual([]);
    });
  });
});
