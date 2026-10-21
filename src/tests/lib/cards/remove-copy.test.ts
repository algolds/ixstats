/** @jest-environment node */
/** Removing a copy keeps its trail, and its serial is never issued again. */
import { readFileSync } from "node:fs";
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
  finish?: string | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  action: string;
}

const highest = (serials: number[]) => (serials.length > 0 ? Math.max(...serials) : null);

/**
 * One card's copies and trail, with `ownershipId` set null when its copy goes (the FK is ON DELETE SET NULL). Cards
 * are unlimited and unbound unless `cards` says otherwise; `market` names the copies with an auction or a listing row
 * (any status).
 */
function fakeTx(
  cards: Record<string, { totalSupply: number; isBound: boolean }> = {},
  market: { auctioned?: readonly string[]; listed?: readonly string[] } = {}
) {
  const copies: CopyRow[] = [];
  const events: EventRow[] = [];
  /** The order the removal's statements ran in */
  const log: string[] = [];
  /** What each market-history check asked for */
  const marketChecks: Array<Record<string, string>> = [];
  const tx = {
    $executeRaw: async (_sql: TemplateStringsArray, ...values: Array<string | number>) => {
      log.push(`lock ${values.join(" ")}`);
      return 1;
    },
    card: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        cards[where.id] ?? { totalSupply: 0, isBound: false },
    },
    cardAuction: {
      count: async ({ where }: { where: { cardInstanceId: string } }) => {
        log.push("check auctions");
        marketChecks.push(where);
        return market.auctioned?.includes(where.cardInstanceId) ? 1 : 0;
      },
    },
    cardListing: {
      count: async ({ where }: { where: { ownershipId: string } }) => {
        marketChecks.push(where);
        return market.listed?.includes(where.ownershipId) ? 1 : 0;
      },
    },
    tradeOffer: { count: async () => 0 },
    cardOwnership: {
      count: async ({ where }: { where: { cardId: string } }) =>
        copies.filter((c) => c.cardId === where.cardId).length,
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
      count: async ({ where }: { where: { cardId: string; serialNumber: number } }) =>
        events.filter((e) => e.cardId === where.cardId && e.serialNumber === where.serialNumber)
          .length,
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
  return { tx: tx as never, copies, events, log, marketChecks };
}

/** The first copy a test mints: card c1, serial 1, held by u1, Standard. */
const COPY = {
  id: "own_1",
  cardId: "c1",
  serialNumber: 1,
  ownerId: "u1",
  finish: "STANDARD",
} as const;

describe("removeCopyTx", () => {
  // The owner's rule outlives the cascade it once guarded against: auctions and listings keep their card and serial
  // now (SET NULL), and a copy with any market history is still never removed
  it.each([
    ["an auction", { auctioned: ["own_1"] }, [{ cardInstanceId: "own_1" }]],
    ["a listing", { listed: ["own_1"] }, [{ cardInstanceId: "own_1" }, { ownershipId: "own_1" }]],
  ])("still refuses a copy with %s in its history, of any status", async (_, market, checks) => {
    const schema = readFileSync("prisma/schema/cards.prisma", "utf8");
    expect(schema).toMatch(
      /CardOwnership\s+CardOwnership\?\s+@relation\(fields: \[cardInstanceId\], references: \[id\], onDelete: SetNull\)/
    );
    expect(schema).toMatch(
      /ownership\s+CardOwnership\?\s+@relation\(fields: \[ownershipId\], references: \[id\], onDelete: SetNull\)/
    );
    const { tx, copies, events, marketChecks } = fakeTx({}, market);
    const copy = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u1",
      finish: "STANDARD",
      source: "PACK_OPEN",
    });

    await expect(removeCopyTx(tx, { ...COPY, id: copy.id }, "REVOKE")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This copy has been on the market, so it can't be removed.",
    });
    // Any row counts, finished or cancelled: each check names the copy and nothing else
    expect(marketChecks).toEqual(checks);
    expect(copies.map((c) => c.id)).toEqual(["own_1"]);
    expect(events.map((e) => e.action)).toEqual(["PACK_OPEN"]);
  });

  it("takes the card's serial lock before anything else, so a mint of the card waits for the removal", async () => {
    const { tx, log } = fakeTx();
    const copy = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u1",
      finish: "STANDARD",
      source: "PACK_OPEN",
    });
    log.length = 0;

    await removeCopyTx(tx, { ...COPY, id: copy.id }, "REVOKE");

    expect(log.slice(0, 2)).toEqual(["lock 7331 c1", "check auctions"]);
  });

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

    await removeCopyTx(
      tx,
      { id: top.id, cardId: "c1", serialNumber: 3, ownerId: "u3", finish: "SERIALISED" },
      "REVOKE"
    );
    const next = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u4",
      finish: "STANDARD",
      source: "ADMIN",
    });

    expect(next.serialNumber).toBe(4);
    expect(copies.map((c) => c.serialNumber)).toEqual([1, 2, 4]);
  });

  it("stamps the copy's older trail with its card and serial, and records the removal, with its finish, before the copy goes", async () => {
    const { tx, copies, events } = fakeTx();
    const copy = await mintCopy(tx, {
      cardId: "c1",
      ownerId: "u1",
      finish: "STANDARD",
      source: "PACK_OPEN",
    });
    // A row written before transfer events carried the card and serial
    events.push({ ownershipId: copy.id, fromUserId: "u0", toUserId: "u1", action: "TRADE" });

    await removeCopyTx(tx, { ...COPY, id: copy.id }, "VOID");

    expect(copies).toEqual([]);
    expect(events).toEqual([
      {
        ownershipId: null,
        cardId: "c1",
        serialNumber: 1,
        finish: "STANDARD",
        toUserId: "u1",
        action: "PACK_OPEN",
      },
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
        finish: "STANDARD",
        fromUserId: "u1",
        toUserId: null,
        action: "VOID",
      },
    ]);
  });

  it("brings a voided one-of-one trophy back under its serial, reissued, never under a second", async () => {
    const { tx, copies, events } = fakeTx({ trophy: { totalSupply: 1, isBound: true } });
    const mint = (ownerId: string, serialNumber?: number) =>
      mintCopy(tx, {
        cardId: "trophy",
        ownerId,
        finish: "SERIALISED",
        source: "TROPHY",
        ...(serialNumber === undefined ? {} : { serialNumber }),
      });
    const first = await mint("u1");
    await removeCopyTx(
      tx,
      { id: first.id, cardId: "trophy", serialNumber: 1, ownerId: "u1", finish: "SERIALISED" },
      "VOID"
    );

    // The trail keeps serial 1, so the next serial would pass the one-of-one's run
    await expect(mint("u2")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(mint("u2", 1)).resolves.toMatchObject({ ownerId: "u2", serialNumber: 1 });

    expect(copies.map((c) => [c.ownerId, c.serialNumber])).toEqual([["u2", 1]]);
    expect(events.map((e) => [e.action, e.serialNumber])).toEqual([
      ["TROPHY", 1],
      ["VOID", 1],
      ["REISSUE", 1],
    ]);
    // A reissue needs the copy gone: a second one is refused while it lives
    await expect(mint("u3", 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
