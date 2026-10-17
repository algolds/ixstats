/** @jest-environment node */
/**
 * Trophy fixes (cards refresh spec §2.4): overriding a Loreward place takes its trophy with it, with an audit row, a
 * transfer event and a provenance note. The only way a bound card moves, and a one-of-one is never re-minted under a
 * second serial: the copy moves in place, or is given up for its serial to be reissued.
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
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}
interface Copy {
  id: string;
  cardId: string;
  ownerId: string;
  serialNumber: number;
}
interface Trophy {
  id: string;
  edition: "winner" | "runner-up";
  metadata: Record<string, string | null>;
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
  runnerUpUser: "Bee",
  runnerUpPage: "Hive",
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

const AMY_COPY: Copy = { id: "own_1", cardId: "trophy_1", ownerId: "user_amy", serialNumber: 1 };
const amyTrophy = (copies: Copy[] = [AMY_COPY], over: Partial<Trophy> = {}): Trophy => ({
  id: "trophy_1",
  edition: "winner",
  metadata: { contest: "daily", place: "winner", wikiUser: "Amy", grantedTo: "user_amy" },
  copies,
  ...over,
});

const winner = (winnerUser: string | null, winnerPage: string | null): LorewardOverride => ({
  winnerUser,
  winnerPage,
  runnerUpUser: "Bee",
  runnerUpPage: "Hive",
});

function setup({
  contest,
  trophies = [],
  keyed = contest[0] ?? null,
}: {
  contest: Entry[];
  trophies?: Trophy[];
  keyed?: Entry | null;
}): MockPrismaProxy {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(0) });
  db.lorewardEntry.findUnique.mockResolvedValue(keyed);
  db.lorewardEntry.findMany.mockResolvedValue(contest);
  db.lorewardEntry.upsert.mockResolvedValue({ id: "entry_new" });
  db.card.findMany.mockImplementation(async ({ where }: { where: { lorewardEdition: string } }) =>
    trophies
      .filter((trophy) => trophy.edition === where.lorewardEdition)
      .map(({ id, metadata }) => ({ id, metadata }))
  );
  db.cardOwnership.findMany.mockImplementation(
    async ({ where }: { where: { cardId: string } }) =>
      trophies.find((trophy) => trophy.id === where.cardId)?.copies ?? []
  );
  db.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
  return db;
}

const override = (
  db: MockPrismaProxy,
  fields: LorewardOverride,
  key: { date: string; type: "daily" | "weekly" } = { date: "2026-10-20", type: "daily" }
) => overrideLorewardEntry(db as never, actor, { ...key, fields });

/** The advisory locks taken, in order, as `<namespace> <key>`. */
const locks = (db: MockPrismaProxy): string[] =>
  db.$executeRaw.mock.calls.map(
    ([, namespace, key]: [string[], number, string]) => `${namespace} ${key}`
  );
const callOrder = (fn: jest.Mock, i = 0) => fn.mock.invocationCallOrder[i]!;
const cardUpdate = (db: MockPrismaProxy, i = 0) => db.card.update.mock.calls[i]![0];
const auditRow = (db: MockPrismaProxy, i = 0) => db.auditLog.create.mock.calls[i]![0].data;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolveLorewardPlace).mockReset().mockResolvedValue(null);
  jest.mocked(mintTrophyCards).mockReset().mockResolvedValue({ minted: 0 });
});

describe("reassigning a trophy", () => {
  it("moves the copy to the new winner's account in place, with a REASSIGN event, a provenance note and an audit row", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(db, winner("Cy", "New page"))).resolves.toEqual({
      reassigned: 1,
      voided: 0,
      minted: 0,
    });

    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { cardId: "trophy_1" },
      select: { id: true, cardId: true, ownerId: true, serialNumber: true },
    });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", ownerId: "user_amy", isLocked: false },
      data: { ownerId: "user_cy", acquiredAt: expect.any(Date) },
    });
    expect(db.cardTransferEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        cardId: "trophy_1",
        serialNumber: 1,
        fromUserId: "user_amy",
        toUserId: "user_cy",
        action: "REASSIGN",
      },
    });
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();

    expect(db.card.update).toHaveBeenCalledTimes(1);
    expect(cardUpdate(db)).toEqual({
      where: { id: "trophy_1" },
      data: {
        title: "New page",
        description: "Daily Loreward winner, 2026-10-20. Won by Cy with New page.",
        wikiArticleTitle: "New page",
        realmId: "default",
        isRetired: false,
        retiredAt: null,
        metadata: {
          contest: "daily",
          place: "winner",
          wikiUser: "Cy",
          grantedTo: "user_cy",
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
    });
    expect(articleHomeRealm).toHaveBeenCalledWith(db, "ixwiki", "New page");
    expect(auditRow(db)).toMatchObject({
      userId: "clerk_admin",
      action: "TROPHY_REASSIGN",
      entityType: "CARD",
      target: "trophy_1",
      details:
        "Reassigned the daily winner of 2026-10-20 trophy from Amy to Cy, granted to user_cy",
    });
    expect(mintTrophyCards).toHaveBeenCalledWith(db, ["entry_1"]);
  });

  it("writes every field of the override, resolving the new holder over the contest's days", async () => {
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await override(db, { ...winner("Cy", "New page"), winnerScore: 0, runnerUpBytes: 12 });

    expect(db.lorewardEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry_1"] } },
      data: {
        winnerUser: "Cy",
        winnerPage: "New page",
        winnerScore: 0,
        winnerBytes: null,
        runnerUpUser: "Bee",
        runnerUpPage: "Hive",
        runnerUpScore: null,
        runnerUpBytes: 12,
      },
    });
    expect(resolveLorewardPlace).toHaveBeenCalledWith(db, {
      wikiUser: "Cy",
      page: "New page",
      type: "daily",
      date: "2026-10-20",
      dateStart: null,
      dateEnd: null,
    });
  });

  it("takes both places' contest locks, winner first, before it reads the contest, then the card's serial lock", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await override(db, winner("Cy", "New page"));

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(locks(db)).toEqual([
      "7332 daily:2026-10-20:winner",
      "7332 daily:2026-10-20:runner-up",
      "7331 trophy_1",
    ]);
    expect(callOrder(db.$executeRaw, 1)).toBeLessThan(callOrder(db.lorewardEntry.findMany));
    expect(callOrder(db.$executeRaw, 2)).toBeLessThan(callOrder(db.cardOwnership.findMany));
    expect(callOrder(db.cardOwnership.findMany)).toBeLessThan(
      callOrder(db.cardOwnership.updateMany)
    );
  });

  it("gives the copy up when the new winner has no account yet, so the card waits for its grant", async () => {
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy()] });

    await expect(override(db, winner("Cy", "Page"))).resolves.toEqual({
      reassigned: 1,
      voided: 0,
      minted: 0,
    });

    expect(removeCopyTx).toHaveBeenCalledWith(db, AMY_COPY, "VOID");
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(cardUpdate(db).data).toMatchObject({
      isRetired: false,
      metadata: { wikiUser: "Cy", grantedTo: null },
    });
    expect(auditRow(db).details).toBe(
      "Reassigned the daily winner of 2026-10-20 trophy from Amy to Cy, waiting for their account"
    );
  });

  it("mints the copy (or reissues its serial) when the place had none and the new winner resolves", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy([])] });

    await override(db, winner("Cy", "Page"));

    expect(mintTrophyCopyTx).toHaveBeenCalledWith(db, "trophy_1", "user_cy");
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(cardUpdate(db).data.metadata).toMatchObject({ wikiUser: "Cy", grantedTo: "user_cy" });
  });

  it("leaves a copy that waits for no account unminted", async () => {
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy([])] });

    await override(db, winner("Cy", "Page"));

    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(cardUpdate(db).data.metadata).toMatchObject({ grantedTo: null });
  });

  it("keeps the copy where it is when the place's new page still resolves to its holder", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_amy");
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(db, winner("Amy", "New page"))).resolves.toMatchObject({ reassigned: 1 });

    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(cardUpdate(db).data).toMatchObject({ title: "New page", wikiArticleTitle: "New page" });
  });

  it("names a place with no page after its contest", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await override(db, winner("Cy", null));

    expect(cardUpdate(db).data).toMatchObject({
      title: "Daily Loreward 2026-10-20",
      wikiArticleTitle: null,
    });
  });

  it("refuses, rolling the override back, when the copy changed hands meanwhile", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });
    db.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    await expect(override(db, winner("Cy", "New page"))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This trophy's copy changed hands or was locked. Reload and try again.",
    });

    expect(db.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(mintTrophyCards).not.toHaveBeenCalled();
  });

  it("appends to the card's provenance, keeping the notes before it", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const earlier = { action: "REASSIGN", from: "Zed", to: "Amy", by: "clerk_x", at: "2026-10-01" };
    const trophy = amyTrophy();
    const db = setup({
      contest: [daily("Amy", "Page")],
      trophies: [{ ...trophy, metadata: { ...trophy.metadata, provenance: [earlier] } as never }],
    });

    await override(db, winner("Cy", "Page"));

    expect(cardUpdate(db).data.metadata.provenance).toEqual([
      earlier,
      expect.objectContaining({ action: "REASSIGN", from: "Amy", to: "Cy" }),
    ]);
  });
});

describe("voiding a trophy", () => {
  it("voids the trophy of a place the override empties: the copy is removed and the card retired, unowned", async () => {
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy()] });

    await expect(override(db, winner(null, null))).resolves.toEqual({
      reassigned: 0,
      voided: 1,
      minted: 0,
    });

    expect(removeCopyTx).toHaveBeenCalledWith(db, AMY_COPY, "VOID");
    expect(resolveLorewardPlace).not.toHaveBeenCalled();
    expect(cardUpdate(db)).toEqual({
      where: { id: "trophy_1" },
      data: {
        isRetired: true,
        retiredAt: expect.any(Date),
        metadata: {
          contest: "daily",
          place: "winner",
          wikiUser: "Amy",
          grantedTo: null,
          provenance: [
            { action: "VOID", from: "Amy", to: null, by: "clerk_admin", at: expect.any(String) },
          ],
        },
      },
    });
    expect(auditRow(db)).toMatchObject({
      action: "TROPHY_VOID",
      target: "trophy_1",
      details: "Voided the daily winner of 2026-10-20 trophy (was Amy)",
    });
    // The copy is read under the card's serial lock, after the contest's
    expect(locks(db)[2]).toBe("7331 trophy_1");
    expect(callOrder(db.$executeRaw, 2)).toBeLessThan(callOrder(db.cardOwnership.findMany));
  });

  it("reads a blank name as none, as the form sends it", async () => {
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy()] });

    await expect(override(db, winner("", ""))).resolves.toMatchObject({ voided: 1 });

    expect(db.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerUser: null,
      winnerPage: null,
    });
  });
});

describe("the places an override changes", () => {
  it("voids one place and reassigns the other in one override, naming nobody for a card that records no holder", async () => {
    const unnamed = { contest: "daily" };
    const db = setup({
      contest: [daily("Amy", "Page")],
      trophies: [
        amyTrophy([], { metadata: unnamed }),
        amyTrophy([], { id: "trophy_2", edition: "runner-up", metadata: unnamed }),
      ],
    });

    await expect(
      override(db, { winnerUser: null, runnerUpUser: "Dee", runnerUpPage: "Hive" })
    ).resolves.toEqual({ reassigned: 1, voided: 1, minted: 0 });

    expect(
      db.auditLog.create.mock.calls.map(
        ([{ data }]: [{ data: { details: string } }]) => data.details
      )
    ).toEqual([
      "Voided the daily winner of 2026-10-20 trophy (was nobody)",
      "Reassigned the daily runner-up of 2026-10-20 trophy from nobody to Dee, waiting for their account",
    ]);
    expect(cardUpdate(db, 1).data.metadata.provenance).toEqual([
      expect.objectContaining({ from: null, to: "Dee" }),
    ]);
  });

  it("leaves an unchanged place alone", async () => {
    const db = setup({ contest: [daily("Amy", "Page")], trophies: [amyTrophy()] });

    await expect(override(db, winner("Amy", "Page"))).resolves.toEqual({
      reassigned: 0,
      voided: 0,
      minted: 0,
    });

    expect(db.lorewardEntry.updateMany).toHaveBeenCalled();
    expect(db.card.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("reconciles only the runner-up when only the runner-up changes", async () => {
    const db = setup({
      contest: [daily("Amy", "Page")],
      trophies: [amyTrophy([], { id: "trophy_2", edition: "runner-up" })],
    });

    await override(db, {
      winnerUser: "Amy",
      winnerPage: "Page",
      runnerUpUser: "Dee",
      runnerUpPage: "Hive",
    });

    expect(db.card.findMany).toHaveBeenCalledTimes(1);
    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { lorewardEntryId: { in: ["entry_1"] }, lorewardEdition: "runner-up" },
      select: { id: true, metadata: true },
      orderBy: { id: "asc" },
    });
    expect(cardUpdate(db).data).toMatchObject({
      description: "Daily Loreward runner-up, 2026-10-20. Won by Dee with Hive.",
    });
  });

  it("changes nothing on a place with no card yet, and leaves it to the mint", async () => {
    jest.mocked(mintTrophyCards).mockResolvedValue({ minted: 1 });
    const db = setup({ contest: [daily("Amy", "Page")] });

    await expect(override(db, winner("Cy", "Page"))).resolves.toEqual({
      reassigned: 0,
      voided: 0,
      minted: 1,
    });

    expect(resolveLorewardPlace).not.toHaveBeenCalled();
    expect(db.card.update).not.toHaveBeenCalled();
  });

  it("creates the entry, approved, when its contest has none, and leaves the trophy to the mint", async () => {
    const db = setup({ contest: [], keyed: null });

    await override(db, winner("Cy", "Page"));

    const written = {
      winnerUser: "Cy",
      winnerPage: "Page",
      winnerScore: null,
      winnerBytes: null,
      runnerUpUser: "Bee",
      runnerUpPage: "Hive",
      runnerUpScore: null,
      runnerUpBytes: null,
    };
    expect(db.lorewardEntry.upsert).toHaveBeenCalledWith({
      where: { date_type: { date: "2026-10-20", type: "daily" } },
      create: { date: "2026-10-20", type: "daily", ...written, status: "approved" },
      update: written,
      select: { id: true },
    });
    expect(locks(db)).toEqual(["7332 daily:2026-10-20:winner", "7332 daily:2026-10-20:runner-up"]);
    expect(db.lorewardEntry.updateMany).not.toHaveBeenCalled();
    expect(db.card.findMany).not.toHaveBeenCalled();
    expect(mintTrophyCards).toHaveBeenCalledWith(db, ["entry_new"]);
  });
});

describe("a contest stored twice", () => {
  it("writes the override to both its entries and moves the card through the state-keyed one", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const [ool] = weeklyTwins("Amy", "Amy");
    const db = setup({
      contest: weeklyTwins("Amy", "Amy"),
      keyed: ool,
      trophies: [amyTrophy(undefined, { metadata: { contest: "weekly", wikiUser: "Amy" } })],
    });

    await override(db, winner("Cy", "Page"), { date: "2026-10-19", type: "weekly" });

    expect(locks(db).slice(0, 2)).toEqual([
      "7332 weekly:2026-10-19:winner",
      "7332 weekly:2026-10-19:runner-up",
    ]);
    expect(db.lorewardEntry.findMany).toHaveBeenCalledWith({
      where: {
        type: "weekly",
        OR: [{ dateStart: "2026-10-19" }, { dateStart: null, date: "2026-10-19" }],
      },
      select: expect.objectContaining({ id: true, winnerUser: true }),
      orderBy: { id: "asc" },
    });
    expect(db.lorewardEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["w_ool", "w_state"] } },
      data: expect.objectContaining({ winnerUser: "Cy" }),
    });
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({
      lorewardEntryId: { in: ["w_ool", "w_state"] },
      lorewardEdition: "winner",
    });
    expect(resolveLorewardPlace).toHaveBeenCalledWith(db, {
      wikiUser: "Cy",
      page: "Page",
      type: "weekly",
      date: "2026-W43",
      dateStart: "2026-10-19",
      dateEnd: "2026-10-25",
    });
    expect(cardUpdate(db).data.description).toBe(
      "Weekly Loreward winner, 2026-W43. Won by Cy with Page."
    );
    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
    expect(mintTrophyCards).toHaveBeenCalledWith(db, ["w_ool", "w_state"]);
  });

  it("finds the contest by the keyed entry's own first day when the state key is overridden", async () => {
    const [, state] = weeklyTwins("Amy", "Amy");
    const db = setup({ contest: weeklyTwins("Amy", "Amy"), keyed: state });

    await override(db, winner("Cy", "Page"), { date: "2026-W43", type: "weekly" });

    expect(locks(db)[0]).toBe("7332 weekly:2026-10-19:winner");
    expect(db.lorewardEntry.findUnique).toHaveBeenCalledWith({
      where: { date_type: { date: "2026-W43", type: "weekly" } },
      select: { type: true, date: true, dateStart: true },
    });
  });

  it("counts a place its entries disagreed on as changed, even when the override names one of them", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_amy");
    const db = setup({ contest: weeklyTwins("Amy", "Bob"), trophies: [amyTrophy()] });

    await expect(
      override(db, winner("Amy", "Page"), { date: "2026-10-19", type: "weekly" })
    ).resolves.toMatchObject({ reassigned: 1 });
  });

  it("keeps one copy for the place when each entry has a card: the held one moves, the other only follows", async () => {
    jest.mocked(resolveLorewardPlace).mockResolvedValue("user_cy");
    const db = setup({
      contest: weeklyTwins("Amy", "Amy"),
      trophies: [
        amyTrophy([], { id: "trophy_a" }),
        amyTrophy([{ ...AMY_COPY, cardId: "trophy_b" }], { id: "trophy_b" }),
      ],
    });

    await expect(
      override(db, winner("Cy", "Page"), { date: "2026-10-19", type: "weekly" })
    ).resolves.toMatchObject({ reassigned: 2 });

    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
    expect(db.cardTransferEvent.create.mock.calls[0]![0].data).toMatchObject({
      cardId: "trophy_b",
      toUserId: "user_cy",
    });
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    const grants = db.card.update.mock.calls.map(
      ([{ where, data }]: [
        { where: { id: string }; data: { metadata: { grantedTo: string } } },
      ]) => [where.id, data.metadata.grantedTo]
    );
    expect(grants).toEqual([
      ["trophy_a", null],
      ["trophy_b", "user_cy"],
    ]);
    expect(resolveLorewardPlace).toHaveBeenCalledTimes(1);
  });
});
