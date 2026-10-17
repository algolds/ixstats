/** @jest-environment node */
/** Removing a copy keeps its trail, and its serial is never issued again. */
import { mintCopy } from "~/lib/cards/mint";
import { removeCopyTx } from "~/lib/cards/remove-copy";

interface CopyRow {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  isLocked: boolean;
}

interface EventRow {
  ownershipId: string | null;
  cardId?: string | null;
  serialNumber?: number | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  action: string;
}

const highest = (serials: number[]) => (serials.length > 0 ? Math.max(...serials) : null);

/** One card's copies and trail, with `ownershipId` set null when its copy goes (the FK is ON DELETE SET NULL). */
function fakeTx() {
  const copies: CopyRow[] = [];
  const events: EventRow[] = [];
  const tx = {
    $executeRaw: async () => 1,
    card: { findUnique: async () => ({ totalSupply: 0 }) },
    cardAuction: { count: async () => 0 },
    tradeOffer: { count: async () => 0 },
    cardOwnership: {
      findFirst: async ({ where }: { where: { cardId: string } }) => {
        const top = highest(
          copies.filter((c) => c.cardId === where.cardId).map((c) => c.serialNumber)
        );
        return top === null ? null : { serialNumber: top };
      },
      create: async ({ data }: { data: Omit<CopyRow, "id" | "isLocked"> }) => {
        const row = { id: `own_${copies.length + events.length + 1}`, isLocked: false, ...data };
        copies.push(row);
        return row;
      },
      deleteMany: async ({ where }: { where: Pick<CopyRow, "id" | "ownerId" | "isLocked"> }) => {
        const at = copies.findIndex(
          (c) => c.id === where.id && c.ownerId === where.ownerId && c.isLocked === where.isLocked
        );
        if (at < 0) return { count: 0 };
        copies.splice(at, 1);
        for (const event of events) if (event.ownershipId === where.id) event.ownershipId = null;
        return { count: 1 };
      },
    },
    cardTransferEvent: {
      create: async ({ data }: { data: EventRow }) => {
        events.push({ ...data });
        return data;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { ownershipId: string; cardId: null };
        data: { cardId: string; serialNumber: number };
      }) => {
        const unstamped = events.filter(
          (e) => e.ownershipId === where.ownershipId && e.cardId == null
        );
        for (const event of unstamped) Object.assign(event, data);
        return { count: unstamped.length };
      },
      findFirst: async ({ where }: { where: { cardId: string } }) => {
        const top = highest(
          events
            .filter((e) => e.cardId === where.cardId && e.serialNumber != null)
            .map((e) => e.serialNumber ?? 0)
        );
        return top === null ? null : { serialNumber: top };
      },
    },
  };
  return { tx: tx as never, copies, events };
}

describe("removeCopyTx", () => {
  it("never reissues a revoked serial: revoking the top copy, then minting, gives top + 1", async () => {
    const { tx, copies } = fakeTx();
    for (const owner of ["u1", "u2", "u3"]) {
      await mintCopy(tx, {
        cardId: "c1",
        ownerId: owner,
        finish: "SERIALISED",
        source: "PACK_OPEN",
      });
    }
    const top = copies[2]!;
    expect(top.serialNumber).toBe(3);

    await removeCopyTx(tx, { id: top.id, cardId: "c1", serialNumber: 3, ownerId: "u3" }, "REVOKE");
    const next = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u4",
      finish: "STANDARD",
      source: "ADMIN",
    });

    expect(next.serialNumber).toBe(4);
    expect(copies.map((c) => c.serialNumber)).toEqual([1, 2, 4]);
  });

  it("stamps the copy's older trail with its card and serial, and records the removal before the copy goes", async () => {
    const { tx, copies, events } = fakeTx();
    const copy = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u1",
      finish: "STANDARD",
      source: "PACK_OPEN",
    });
    // A row written before transfer events carried the card and serial
    events.push({ ownershipId: copy.id, fromUserId: "u0", toUserId: "u1", action: "TRADE" });

    await removeCopyTx(tx, { id: copy.id, cardId: "c1", serialNumber: 1, ownerId: "u1" }, "VOID");

    expect(copies).toEqual([]);
    expect(events).toEqual([
      { ownershipId: null, cardId: "c1", serialNumber: 1, toUserId: "u1", action: "PACK_OPEN" },
      {
        ownershipId: null,
        cardId: "c1",
        serialNumber: 1,
        fromUserId: "u0",
        toUserId: "u1",
        action: "TRADE",
      },
      {
        ownershipId: null,
        cardId: "c1",
        serialNumber: 1,
        fromUserId: "u1",
        toUserId: null,
        action: "VOID",
      },
    ]);
  });
});
