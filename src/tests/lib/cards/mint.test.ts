/** @jest-environment node */
/** Cards refresh §5.4: mintCopy is the one way a copy comes into being. */
import { MINT_SOURCES, mintCopy } from "~/lib/cards/mint";

interface CopyRow {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  finish: string;
}

/**
 * A database with one advisory lock that a transaction holds from its lock call until it ends (as
 * pg_advisory_xact_lock), and reads that yield, so racing transactions interleave unless the lock serialises them.
 */
function fakeDatabase(runs: Record<string, number | null> = {}) {
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

  it("lets the database assign the copy's id", async () => {
    const db = fakeDatabase();
    const copy = await db.transaction((tx) =>
      mintCopy(tx, { cardId: "c1", ownerId: "u1", finish: "STANDARD", source: "DAILY_CLAIM" })
    );
    expect(db.create.mock.calls[0]![0].data).not.toHaveProperty("id");
    expect(db.create.mock.calls[0]![0].data).toEqual({
      cardId: "c1",
      ownerId: "u1",
      serialNumber: 1,
      finish: "STANDARD",
    });
    expect(copy.id).toBe("cuid_1");
  });

  it("writes the mint row of the provenance trail with its source, card and serial", async () => {
    const db = fakeDatabase();
    await db.transaction((tx) =>
      mintCopy(tx, { cardId: "c1", ownerId: "u1", finish: "STANDARD", source: "NS_DECK_IMPORT" })
    );
    expect(db.events).toEqual([
      {
        ownershipId: "cuid_1",
        cardId: "c1",
        serialNumber: 1,
        toUserId: "u1",
        action: "NS_DECK_IMPORT",
      },
    ]);
  });

  it("mints an admin grant as the ADMIN source", async () => {
    expect(MINT_SOURCES).toContain("ADMIN");
    const db = fakeDatabase();
    await db.transaction((tx) =>
      mintCopy(tx, { cardId: "c1", ownerId: "u1", finish: "STANDARD", source: "ADMIN" })
    );
    expect(db.events[0]).toMatchObject({ action: "ADMIN" });
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

  it.each([
    ["0", 0],
    ["null", null],
  ])(
    "treats a totalSupply of %s as no run size, so a Serialised copy always mints",
    async (_, run) => {
      const db = fakeDatabase({ lore: run });
      const serial = () =>
        db.transaction((tx) =>
          mintCopy(tx, { cardId: "lore", ownerId: "u1", finish: "SERIALISED", source: "ADMIN" })
        );
      await expect(serial()).resolves.toMatchObject({ serialNumber: 1 });
      await expect(serial()).resolves.toMatchObject({ serialNumber: 2 });
    }
  );
});
