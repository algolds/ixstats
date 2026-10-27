/** @jest-environment node */
/**
 * Trophy fixes (cards refresh spec §2.4): overriding a Loreward place takes its trophy with it, with an audit row, a
 * transfer event and a provenance note. The only way a bound card moves, and a one-of-one is never re-minted under a
 * second serial: the copy moves in place, or is given up for its serial to be reissued. The transaction runs on a
 * client distinct from `db`, so every read and write the override makes is shown to go through it.
 */
jest.mock("~/lib/lorewards/resolve-user", () => ({
  ...jest.requireActual("~/lib/lorewards/resolve-user"),
  resolveLorewardPlace: jest.fn(),
}));
jest.mock("~/lib/cards/remove-copy", () => ({ removeCopyTx: jest.fn() }));
jest.mock("~/lib/cards/home-realm", () => ({
  articleHomeRealm: jest.fn().mockResolvedValue("default"),
}));
jest.mock("~/lib/lorewards/trophy-cards", () => ({
  ...jest.requireActual("~/lib/lorewards/trophy-cards"),
  mintTrophyCards: jest.fn(),
  mintTrophyCopyTx: jest.fn(),
}));

import { articleHomeRealm } from "~/lib/cards/home-realm";
import { removeCopyTx } from "~/lib/cards/remove-copy";
import { resolveLorewardPlace } from "~/lib/lorewards/resolve-user";
import { mintTrophyCards, mintTrophyCopyTx } from "~/lib/lorewards/trophy-cards";
import {
  overrideLorewardEntry,
  type LorewardOverride,
} from "~/server/modules/cards/cards.trophies";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };

interface Entry {
  id: string;
  type: string;
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage: string | null;
  winnerScore: number | null;
  winnerBytes: number | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
  runnerUpScore: number | null;
  runnerUpBytes: number | null;
}
interface Copy {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
  finish: "SERIALISED";
}
/** A trophy card's metadata: names, ids and dates, and its provenance notes. */
type Meta = Record<string, string | null | Array<Record<string, string | null>>>;

interface Trophy {
  id: string;
  edition: "winner" | "runner-up";
  title: string;
  isRetired?: boolean;
  metadata: Meta;
  copies: Copy[];
}

const daily = (winnerUser: string | null, winnerPage: string | null): Entry => ({
  id: "entry_1",
  type: "daily",
  date: "2026-10-20",
  dateStart: null,
  dateEnd: null,
  winnerUser,
  winnerPage,
  winnerScore: 90,
  winnerBytes: 900,
  runnerUpUser: "Bee",
  runnerUpPage: "Hive",
  runnerUpScore: 80,
  runnerUpBytes: 800,
});

/** A weekly stored twice: by its first day (the OOL page) and as `2026-W43` with its range (the state file). */
const weeklyTwins = (oolWinner: string, stateWinner: string): Entry[] => [
  { ...daily(oolWinner, "Page"), id: "w_ool", type: "weekly", date: "2026-10-19" },
  {
    ...daily(stateWinner, "Page"),
    id: "w_state",
    type: "weekly",
    date: "2026-W43",
    dateStart: "2026-10-19",
    dateEnd: "2026-10-25",
  },
];
const WEEKLY = { date: "2026-10-19", type: "weekly" as const };

const AMY_COPY: Copy = {
  id: "own_1",
  cardId: "trophy_1",
  ownerId: "user_amy",
  serialNumber: 1,
  finish: "SERIALISED",
};
const BEE_COPY: Copy = {
  id: "own_2",
  cardId: "trophy_2",
  ownerId: "user_bee",
  serialNumber: 1,
  finish: "SERIALISED",
};
const AMY_GRANTED_AT = "2026-10-01T00:00:00.000Z";

/** The winner's trophy as the mint left it: Amy's, titled after her page, its copy hers. */
const amyTrophy = (copies: Copy[] = [AMY_COPY], over: Partial<Trophy> = {}): Trophy => ({
  id: "trophy_1",
  edition: "winner",
  title: "Old page",
  metadata: {
    contest: "daily",
    place: "winner",
    wikiUser: "Amy",
    grantedTo: "user_amy",
    grantedAt: AMY_GRANTED_AT,
  },
  copies,
  ...over,
});

/** The runner-up's trophy: Bee's, titled Hive. */
const beeTrophy = (copies: Copy[] = [], over: Partial<Trophy> = {}): Trophy => ({
  id: "trophy_2",
  edition: "runner-up",
  title: "Hive",
  metadata: { contest: "daily", place: "runner-up", wikiUser: "Bee", grantedTo: null },
  copies,
  ...over,
});

const winner = (winnerUser: string | null, winnerPage: string | null): LorewardOverride => ({
  winnerUser,
  winnerPage,
});

interface Harness {
  db: MockPrismaProxy;
  tx: MockPrismaProxy;
}

function setup({
  contest,
  trophies = [],
  keyed = contest[0] ?? null,
}: {
  contest: Entry[];
  trophies?: Trophy[];
  keyed?: Entry | null;
}): Harness {
  const tx = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(0) });
  const db = createMockPrisma({
    $transaction: jest.fn(async <T>(run: (client: MockPrismaProxy) => Promise<T>) => run(tx)),
  });
  tx.lorewardEntry.findUnique.mockResolvedValue(keyed);
  tx.lorewardEntry.findMany.mockResolvedValue(contest);
  tx.lorewardEntry.upsert.mockResolvedValue({ id: "entry_new" });
  tx.card.findMany.mockImplementation(async ({ where }: { where: { lorewardEdition: string } }) =>
    trophies
      .filter((trophy) => trophy.edition === where.lorewardEdition)
      .map(({ id, title, isRetired = false, metadata }) => ({ id, title, isRetired, metadata }))
  );
  tx.cardOwnership.findMany.mockImplementation(
    async ({ where }: { where: { cardId: string } }) =>
      trophies.find((trophy) => trophy.id === where.cardId)?.copies ?? []
  );
  tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
  return { db, tx };
}

const override = (
  { db }: Harness,
  fields: LorewardOverride,
  key: { date: string; type: "daily" | "weekly" | "monthly" } = {
    date: "2026-10-20",
    type: "daily",
  }
) => overrideLorewardEntry(db as never, actor, { ...key, fields });

/** The advisory locks taken, in order, as `<namespace> <key>`. */
const locks = ({ tx }: Harness): string[] =>
  tx.$executeRaw.mock.calls.map(
    ([, namespace, key]: [string[], number, string]) => `${namespace} ${key}`
  );
const callOrder = (fn: jest.Mock, i = 0) => fn.mock.invocationCallOrder[i]!;
interface CardUpdate {
  where: { id: string };
  data: { title?: string; description?: string; metadata: Meta };
}
interface AuditRow {
  userId: string;
  action: string;
  entityType: string;
  target: string;
  details: string;
}
const cardUpdates = ({ tx }: Harness): CardUpdate[] =>
  tx.card.update.mock.calls.map(([args]: [CardUpdate]) => args);
const auditRows = ({ tx }: Harness): AuditRow[] =>
  tx.auditLog.create.mock.calls.map(([{ data }]: [{ data: AuditRow }]) => data);
/** The account each place resolves to, by the name the place records. */
const accounts = (byName: Record<string, string>) =>
  jest
    .mocked(resolveLorewardPlace)
    .mockImplementation(async (_db, place) => byName[place.wikiUser] ?? null);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveLorewardPlace).mockReset().mockResolvedValue(null);
  jest.mocked(mintTrophyCards).mockReset().mockResolvedValue({ minted: 0 });
});

describe("reassigning a trophy", () => {
  it("moves the copy to the new winner's account in place, with a REASSIGN event, a provenance note and an audit row", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy(), beeTrophy()] });

    await expect(override(h, winner("Cy", "New page"))).resolves.toMatchObject({
      reassigned: 1,
      voided: 0,
      minted: 0,
      mintDeferred: false,
    });

    expect(h.tx.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { cardId: "trophy_1" },
      select: { id: true, cardId: true, ownerId: true, serialNumber: true, finish: true },
    });
    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "user_amy", isLocked: false },
      data: { ownerId: "user_cy", acquiredAt: expect.any(Date) },
    });
    expect(h.tx.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "trophy_1",
        serialNumber: 1,
        finish: "SERIALISED",
        fromUserId: "user_amy",
        toUserId: "user_cy",
        action: "REASSIGN",
      },
    });
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(resolveLorewardPlace).toHaveBeenCalledWith(h.tx, {
      wikiUser: "Cy",
      page: "New page",
      type: "daily",
      date: "2026-10-20",
      dateStart: null,
      dateEnd: null,
    });
    expect(articleHomeRealm).toHaveBeenCalledWith(h.tx, "ixwiki", "New page");

    expect(cardUpdates(h)).toEqual([
      {
        where: { id: "trophy_1" },
        data: {
          title: "New page",
          description: "Daily Loreward winner, 2026-10-20. Won by Cy with New page.",
          wikiArticleTitle: "New page",
          realmId: "default",
          metadata: {
            contest: "daily",
            place: "winner",
            wikiUser: "Cy",
            grantedTo: "user_cy",
            grantedAt: expect.any(String),
            voidedAt: null,
            provenance: [
              {
                action: "REASSIGN",
                from: "Amy",
                to: "Cy",
                by: "clerk_admin",
                at: expect.any(String),
              },
            ],
          },
        },
      },
    ]);
    expect(cardUpdates(h)[0]!.data.metadata.grantedAt).not.toBe(AMY_GRANTED_AT);
    expect(auditRows(h)).toEqual([
      expect.objectContaining({
        userId: "clerk_admin",
        action: "TROPHY_REASSIGN",
        entityType: "CARD",
        target: "trophy_1",
        details:
          "Reassigned the daily winner of 2026-10-20 trophy from Amy to Cy, granted to user_cy",
      }),
    ]);
    expect(mintTrophyCards).toHaveBeenCalledWith(h.db, ["entry_1"]);
    // Nothing ran on the root client but the transaction and the mint after it
    expect(h.db.lorewardEntry.findMany).not.toHaveBeenCalled();
    expect(h.db.card.update).not.toHaveBeenCalled();
  });

  it("writes every entry of the contest, marked, keeping each field the override leaves out", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    const result = await override(h, { winnerPage: "New page", winnerScore: 0, runnerUpBytes: 12 });

    const written = {
      winnerUser: "Amy",
      winnerPage: "New page",
      winnerScore: 0,
      winnerBytes: 900,
      runnerUpUser: "Bee",
      runnerUpPage: "Hive",
      runnerUpScore: 80,
      runnerUpBytes: 12,
    };
    expect(h.tx.lorewardEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry_1"] } },
      data: { ...written, overriddenAt: expect.any(Date) },
    });
    // The fields it wrote come back, for the bot
    expect(result.written).toEqual(written);
  });
  it("takes both places' contest locks, winner first, before it reads the contest, then the card's serial lock", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await override(h, winner("Cy", "New page"));

    expect(h.db.$transaction).toHaveBeenCalledTimes(1);
    expect(locks(h)).toEqual([
      "7332 daily:2026-10-20:winner",
      "7332 daily:2026-10-20:runner-up",
      "7331 trophy_1",
    ]);
    expect(callOrder(h.tx.$executeRaw, 1)).toBeLessThan(callOrder(h.tx.lorewardEntry.findMany));
    expect(callOrder(h.tx.$executeRaw, 2)).toBeLessThan(callOrder(h.tx.cardOwnership.findMany));
    expect(callOrder(h.tx.cardOwnership.findMany)).toBeLessThan(
      callOrder(h.tx.cardOwnership.updateMany)
    );
  });

  it("gives the copy up when the new winner has no account yet, so the card waits for its grant", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(h, winner("Cy", "Old page"))).resolves.toMatchObject({
      reassigned: 1,
      voided: 0,
    });

    expect(removeCopyTx).toHaveBeenCalledWith(h.tx, AMY_COPY, "VOID");
    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(cardUpdates(h)[0]!.data.metadata).toMatchObject({
      wikiUser: "Cy",
      grantedTo: null,
      grantedAt: null,
    });
    expect(auditRows(h)[0]!.details).toBe(
      "Reassigned the daily winner of 2026-10-20 trophy from Amy to Cy, waiting for their account"
    );
  });

  it("mints the copy (or reissues its serial) when the place had none and the new winner resolves", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy([])] });

    await override(h, winner("Cy", "Old page"));

    expect(mintTrophyCopyTx).toHaveBeenCalledWith(h.tx, "trophy_1", "user_cy");
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(cardUpdates(h)[0]!.data.metadata).toMatchObject({
      grantedTo: "user_cy",
      grantedAt: expect.any(String),
    });
  });
  it("refuses, rolling the override back, when the copy changed hands meanwhile", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });
    h.tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    await expect(override(h, winner("Cy", "New page"))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This trophy's copy changed hands or was locked. Reload and try again.",
    });

    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(mintTrophyCards).not.toHaveBeenCalled();
  });

  it("appends to the card's provenance, keeping the notes before it", async () => {
    accounts({ Cy: "user_cy" });
    const earlier = { action: "REASSIGN", from: "Zed", to: "Amy", by: "clerk_x", at: "2026-10-01" };
    const trophy = amyTrophy();
    const h = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [{ ...trophy, metadata: { ...trophy.metadata, provenance: [earlier] } }],
    });

    await override(h, winner("Cy", "Old page"));

    expect(cardUpdates(h)[0]!.data.metadata.provenance).toEqual([
      earlier,
      expect.objectContaining({ action: "REASSIGN", from: "Amy", to: "Cy" }),
    ]);
  });

  it("brings back only a card an override voided, never one retired for another reason", async () => {
    accounts({ Cy: "user_cy" });
    const voided = amyTrophy([], {
      metadata: { wikiUser: "Amy", grantedTo: null, voidedAt: "2026-10-18T00:00:00.000Z" },
    });
    const voidedRun = setup({ contest: [daily(null, null)], trophies: [voided] });
    await override(voidedRun, winner("Cy", "Page"));
    expect(cardUpdates(voidedRun)[0]!.data).toMatchObject({
      isRetired: false,
      retiredAt: null,
      metadata: { voidedAt: null },
    });

    const otherRun = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });
    await override(otherRun, winner("Cy", "Page"));
    expect(cardUpdates(otherRun)[0]!.data).not.toHaveProperty("isRetired");
    expect(cardUpdates(otherRun)[0]!.data).not.toHaveProperty("retiredAt");
  });
});

describe("voiding a trophy", () => {
  it("voids the trophy of a place the override empties: the copy is removed and the card retired, unowned", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(h, winner(null, null))).resolves.toMatchObject({
      reassigned: 0,
      voided: 1,
      minted: 0,
      mintDeferred: false,
    });

    expect(removeCopyTx).toHaveBeenCalledWith(h.tx, AMY_COPY, "VOID");
    expect(resolveLorewardPlace).not.toHaveBeenCalled();
    expect(cardUpdates(h)).toEqual([
      {
        where: { id: "trophy_1" },
        data: {
          isRetired: true,
          retiredAt: expect.any(Date),
          metadata: {
            contest: "daily",
            place: "winner",
            wikiUser: "Amy",
            grantedTo: null,
            grantedAt: null,
            voidedAt: expect.any(String),
            provenance: [
              { action: "VOID", from: "Amy", to: null, by: "clerk_admin", at: expect.any(String) },
            ],
          },
        },
      },
    ]);
    expect(auditRows(h)).toEqual([
      expect.objectContaining({
        action: "TROPHY_VOID",
        target: "trophy_1",
        details: "Voided the daily winner of 2026-10-20 trophy (was Amy)",
      }),
    ]);
    // The copy is read under the card's serial lock, after the contest's
    expect(locks(h)[2]).toBe("7331 trophy_1");
    expect(callOrder(h.tx.$executeRaw, 2)).toBeLessThan(callOrder(h.tx.cardOwnership.findMany));
  });
});

describe("the places an override changes", () => {
  it("leaves the runner-up and its trophy untouched when a correction names only the winner", async () => {
    accounts({ Cy: "user_cy", Bee: "user_bee" });
    const h = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [amyTrophy(), beeTrophy([BEE_COPY])],
    });

    await expect(override(h, winner("Cy", "New page"))).resolves.toMatchObject({
      reassigned: 1,
      voided: 0,
    });

    expect(h.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      runnerUpUser: "Bee",
      runnerUpPage: "Hive",
    });
    expect(cardUpdates(h).map(({ where }) => where.id)).toEqual(["trophy_1"]);
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(locks(h)).not.toContain("7331 trophy_2");
  });
  it("swaps the winner and the runner-up: each copy moves in place, under its own card's lock", async () => {
    accounts({ Amy: "user_amy", Bee: "user_bee" });
    const h = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [amyTrophy(), beeTrophy([BEE_COPY])],
    });

    await expect(
      override(h, {
        winnerUser: "Bee",
        winnerPage: "Hive",
        runnerUpUser: "Amy",
        runnerUpPage: "Old page",
      })
    ).resolves.toMatchObject({ reassigned: 2, voided: 0 });

    expect(h.tx.cardOwnership.updateMany.mock.calls.map(([args]: [object]) => args)).toEqual([
      {
        where: { id: "own_1", ownerId: "user_amy", isLocked: false },
        data: { ownerId: "user_bee", acquiredAt: expect.any(Date) },
      },
      {
        where: { id: "own_2", ownerId: "user_bee", isLocked: false },
        data: { ownerId: "user_amy", acquiredAt: expect.any(Date) },
      },
    ]);
    expect(locks(h)).toEqual([
      "7332 daily:2026-10-20:winner",
      "7332 daily:2026-10-20:runner-up",
      "7331 trophy_1",
      "7331 trophy_2",
    ]);
    expect(cardUpdates(h).map(({ data }) => [data.title, data.metadata.wikiUser])).toEqual([
      ["Hive", "Bee"],
      ["Old page", "Amy"],
    ]);
  });
  it("still succeeds when the mint after the override fails, deferring it to the next sync", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(mintTrophyCards).mockRejectedValue(new Error("database went away"));
    const h = setup({ contest: [daily("Amy", "Old page")] });

    await expect(override(h, winner("Cy", "Page"))).resolves.toMatchObject({
      reassigned: 0,
      voided: 0,
      minted: 0,
      mintDeferred: true,
    });
    expect(error).toHaveBeenCalledWith(
      "[cards.trophies] Minting the override's trophies failed; the next sync mints them:",
      expect.any(Error)
    );
    error.mockRestore();
  });
});

describe("a contest stored twice", () => {
  const weeklyTrophy = (id: string, copies: Copy[]) =>
    amyTrophy(copies, { id, title: "Page", metadata: { contest: "weekly", wikiUser: "Amy" } });

  it("writes the override to both its entries and moves the card through the state-keyed one", async () => {
    accounts({ Cy: "user_cy" });
    const [ool] = weeklyTwins("Amy", "Amy");
    const h = setup({
      contest: weeklyTwins("Amy", "Amy"),
      keyed: ool,
      trophies: [weeklyTrophy("trophy_1", [AMY_COPY])],
    });

    await override(h, winner("Cy", "Page"), WEEKLY);

    expect(locks(h).slice(0, 2)).toEqual([
      "7332 weekly:2026-10-19:winner",
      "7332 weekly:2026-10-19:runner-up",
    ]);
    expect(h.tx.lorewardEntry.findMany).toHaveBeenCalledWith({
      where: {
        type: "weekly",
        OR: [{ dateStart: "2026-10-19" }, { dateStart: null, date: "2026-10-19" }],
      },
      select: expect.objectContaining({ id: true, winnerUser: true, runnerUpBytes: true }),
      orderBy: { id: "asc" },
    });
    expect(h.tx.lorewardEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["w_ool", "w_state"] } },
      data: expect.objectContaining({ winnerUser: "Cy", overriddenAt: expect.any(Date) }),
    });
    expect(h.tx.card.findMany.mock.calls[0]![0].where).toEqual({
      lorewardEntryId: { in: ["w_ool", "w_state"] },
      lorewardEdition: "winner",
    });
    expect(resolveLorewardPlace).toHaveBeenCalledWith(h.tx, {
      wikiUser: "Cy",
      page: "Page",
      type: "weekly",
      date: "2026-W43",
      dateStart: "2026-10-19",
      dateEnd: "2026-10-25",
    });
    expect(cardUpdates(h)[0]!.data.description).toBe(
      "Weekly Loreward winner, 2026-W43. Won by Cy with Page."
    );
    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
    expect(mintTrophyCards).toHaveBeenCalledWith(h.db, ["w_ool", "w_state"]);
  });
  it("refuses an override that leaves out a place the two records disagree on", async () => {
    const h = setup({ contest: weeklyTwins("Amy", "Bob") });

    await expect(
      override(h, { runnerUpUser: "Dee", runnerUpPage: "Hive" }, WEEKLY)
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The two records of this contest disagree on the winner. Set the winner too.",
    });
    expect(h.tx.lorewardEntry.updateMany).not.toHaveBeenCalled();

    const [ool, state] = weeklyTwins("Amy", "Amy");
    const pages = setup({ contest: [ool!, { ...state!, runnerUpPage: "Other hive" }] });
    await expect(override(pages, winner("Cy", "Page"), WEEKLY)).rejects.toMatchObject({
      message: "The two records of this contest disagree on the runner-up. Set the runner-up too.",
    });
  });
});

describe("the day an override names", () => {
  const CONTEST_KEY = { type: true, date: true, dateStart: true };

  it("finds a weekly by any day of it, and writes its entries under its first day, starting none", async () => {
    const [, state] = weeklyTwins("Amy", "Amy");
    const h = setup({ contest: weeklyTwins("Amy", "Amy"), keyed: null });
    h.tx.lorewardEntry.findFirst.mockResolvedValue(state);

    const result = await override(h, winner("Cy", "Page"), { date: "2026-10-22", type: "weekly" });

    expect(h.tx.lorewardEntry.findFirst).toHaveBeenCalledWith({
      where: {
        type: "weekly",
        OR: [
          { dateStart: { gte: "2026-10-16", lte: "2026-10-22" } },
          { dateStart: null, date: { gte: "2026-10-16", lte: "2026-10-22" } },
        ],
      },
      select: CONTEST_KEY,
      orderBy: [{ dateStart: { sort: "desc", nulls: "last" } }, { date: "desc" }],
    });
    expect(callOrder(h.tx.lorewardEntry.findFirst)).toBeLessThan(callOrder(h.tx.$executeRaw));
    expect(locks(h)).toEqual(["7332 weekly:2026-10-19:winner", "7332 weekly:2026-10-19:runner-up"]);
    expect(h.tx.lorewardEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["w_ool", "w_state"] } },
      data: expect.objectContaining({ winnerUser: "Cy", overriddenAt: expect.any(Date) }),
    });
    expect(h.tx.lorewardEntry.upsert).not.toHaveBeenCalled();
    // The bot is told of the contest by its first day
    expect(result.day).toBe("2026-10-19");
  });
  it("refuses a weekly or monthly day no recorded contest holds, writing and locking nothing", async () => {
    for (const key of [
      { date: "2026-10-22", type: "weekly" as const },
      { date: "2026-07-17", type: "monthly" as const },
    ]) {
      const h = setup({ contest: [], keyed: null });

      await expect(override(h, winner("Cy", "Page"), key)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: `No ${key.type} contest is recorded for ${key.date}. Enter a day of a recorded ${key.type} contest.`,
      });
      expect(locks(h)).toEqual([]);
      expect(h.tx.lorewardEntry.upsert).not.toHaveBeenCalled();
      expect(h.tx.lorewardEntry.updateMany).not.toHaveBeenCalled();
    }
    expect(mintTrophyCards).not.toHaveBeenCalled();
  });
});
