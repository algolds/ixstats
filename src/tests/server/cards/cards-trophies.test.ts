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

const AMY_COPY: Copy = { id: "own_1", cardId: "trophy_1", ownerId: "user_amy", serialNumber: 1 };
const BEE_COPY: Copy = { id: "own_2", cardId: "trophy_2", ownerId: "user_bee", serialNumber: 1 };
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
  key: { date: string; type: "daily" | "weekly" } = { date: "2026-10-20", type: "daily" }
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
      select: { id: true, cardId: true, ownerId: true, serialNumber: true },
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

  it("starts a new holder with no page, score or bytes unless the override gives them", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")] });

    await override(h, { winnerUser: "Cy" });
    expect(h.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerUser: "Cy",
      winnerPage: null,
      winnerScore: null,
      winnerBytes: null,
      // The other place keeps its fields
      runnerUpUser: "Bee",
      runnerUpScore: 80,
    });

    const typed = setup({ contest: [daily("Amy", "Old page")] });
    await override(typed, { winnerUser: "Cy", winnerPage: "Cy's page", winnerBytes: 5 });
    expect(typed.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerPage: "Cy's page",
      winnerScore: null,
      winnerBytes: 5,
    });

    const retyped = setup({ contest: [daily("Amy", "Old page")] });
    await override(retyped, { winnerUser: "Amy" });
    expect(retyped.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerPage: "Old page",
      winnerScore: 90,
      winnerBytes: 900,
    });
  });

  it("writes the status it is given to every entry, and keeps it when it is not", async () => {
    const given = setup({ contest: [daily("Amy", "Old page")] });
    await overrideLorewardEntry(given.db as never, actor, {
      date: "2026-10-20",
      type: "daily",
      fields: { winnerUser: "Amy" },
      status: "approved",
    });
    expect(given.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      status: "approved",
    });

    const kept = setup({ contest: [daily("Amy", "Old page")] });
    await override(kept, { winnerUser: "Amy" });
    expect(kept.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).not.toHaveProperty("status");
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

  it("leaves a card that waits for no account unminted", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy([])] });

    await override(h, winner("Cy", "Old page"));

    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(removeCopyTx).not.toHaveBeenCalled();
  });

  it("keeps the copy, and its grant date, when the place's new page still resolves to its holder", async () => {
    accounts({ Amy: "user_amy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(h, winner("Amy", "New page"))).resolves.toMatchObject({
      reassigned: 1,
    });

    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(h.tx.cardTransferEvent.create).not.toHaveBeenCalled();
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(cardUpdates(h)[0]!.data).toMatchObject({
      title: "New page",
      wikiArticleTitle: "New page",
      metadata: { grantedTo: "user_amy", grantedAt: AMY_GRANTED_AT },
    });
  });

  it("names a place with no page after its contest", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await override(h, winner("Cy", null));

    expect(cardUpdates(h)[0]!.data).toMatchObject({
      title: "Daily Loreward 2026-10-20",
      wikiArticleTitle: null,
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

  it("reads a blank name as none", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy()] });

    await expect(override(h, winner("", ""))).resolves.toMatchObject({ voided: 1 });

    expect(h.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerUser: null,
      winnerPage: null,
    });
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

  it("leaves a place the override leaves out alone, even when its card disagrees with its entries", async () => {
    // A sync moved the runner-up from Bee to Dee after Bee's card was minted; the admin corrects only the winner
    accounts({ Cy: "user_cy", Dee: "user_dee" });
    const h = setup({
      contest: [{ ...daily("Amy", "Old page"), runnerUpUser: "Dee" }],
      trophies: [amyTrophy(), beeTrophy([BEE_COPY])],
    });

    await expect(override(h, winner("Cy", "New page"))).resolves.toMatchObject({
      reassigned: 1,
      voided: 0,
    });

    expect(h.tx.card.findMany).toHaveBeenCalledTimes(1);
    expect(h.tx.card.findMany.mock.calls[0]![0].where.lorewardEdition).toBe("winner");
    expect(cardUpdates(h).map(({ where }) => where.id)).toEqual(["trophy_1"]);
    expect(removeCopyTx).not.toHaveBeenCalled();
    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
  });

  it("voids the runner-up only when the override clears it", async () => {
    const h = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [amyTrophy(), beeTrophy([BEE_COPY])],
    });

    await expect(override(h, { runnerUpUser: null, runnerUpPage: null })).resolves.toMatchObject({
      reassigned: 0,
      voided: 1,
    });

    expect(h.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({
      winnerUser: "Amy",
      winnerPage: "Old page",
      runnerUpUser: null,
      runnerUpPage: null,
    });
    expect(removeCopyTx).toHaveBeenCalledWith(h.tx, BEE_COPY, "VOID");
    expect(cardUpdates(h).map(({ where }) => where.id)).toEqual(["trophy_2"]);
  });

  it("leaves an unchanged place alone when its card already agrees", async () => {
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [amyTrophy(), beeTrophy()] });

    await expect(override(h, winner("Amy", "Old page"))).resolves.toMatchObject({
      reassigned: 0,
      voided: 0,
      minted: 0,
      mintDeferred: false,
    });

    expect(h.tx.lorewardEntry.updateMany).toHaveBeenCalled();
    expect(h.tx.card.update).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).not.toHaveBeenCalled();
    expect(locks(h)).toHaveLength(2);
  });

  it("repairs a card whose holder disagrees with an unchanged place when the override is sent again", async () => {
    accounts({ Amy: "user_amy" });
    const stale = amyTrophy(undefined, { metadata: { wikiUser: "Zed", grantedTo: "user_amy" } });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [stale] });

    await expect(override(h, winner("Amy", "Old page"))).resolves.toMatchObject({
      reassigned: 1,
    });

    expect(cardUpdates(h)[0]!.data.metadata).toMatchObject({ wikiUser: "Amy" });
  });

  it("repairs a card whose title disagrees, and voids a card an empty place never voided", async () => {
    accounts({ Amy: "user_amy" });
    const retitled = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [amyTrophy(undefined, { title: "Another page" })],
    });
    await expect(override(retitled, winner("Amy", "Old page"))).resolves.toMatchObject({
      reassigned: 1,
    });

    const unvoided = setup({ contest: [daily(null, null)], trophies: [amyTrophy()] });
    await expect(override(unvoided, winner(null, null))).resolves.toMatchObject({ voided: 1 });

    const voided = amyTrophy([], { metadata: { voidedAt: "2026-10-18T00:00:00.000Z" } });
    const done = setup({ contest: [daily(null, null)], trophies: [voided] });
    await expect(override(done, winner(null, null))).resolves.toMatchObject({ voided: 0 });
  });

  it("brings back a voided card when the override names a holder its entries already record", async () => {
    accounts({ Amy: "user_amy" });
    const voided = amyTrophy([], {
      metadata: { wikiUser: "Amy", grantedTo: null, voidedAt: "2026-10-18T00:00:00.000Z" },
    });
    const h = setup({ contest: [daily("Amy", "Old page")], trophies: [voided] });

    await expect(override(h, winner("Amy", "Old page"))).resolves.toMatchObject({
      reassigned: 1,
    });

    expect(mintTrophyCopyTx).toHaveBeenCalledWith(h.tx, "trophy_1", "user_amy");
    expect(cardUpdates(h)[0]!.data).toMatchObject({
      isRetired: false,
      metadata: { voidedAt: null },
    });
  });

  it("voids one place and reassigns the other in one override, naming nobody for a card that records no holder", async () => {
    const unnamed = { contest: "daily" };
    const h = setup({
      contest: [daily("Amy", "Old page")],
      trophies: [amyTrophy([], { metadata: unnamed }), beeTrophy([], { metadata: unnamed })],
    });

    await expect(
      override(h, { winnerUser: null, winnerPage: null, runnerUpUser: "Dee" })
    ).resolves.toMatchObject({ reassigned: 1, voided: 1, minted: 0 });

    expect(auditRows(h).map((row) => row.details)).toEqual([
      "Voided the daily winner of 2026-10-20 trophy (was nobody)",
      "Reassigned the daily runner-up of 2026-10-20 trophy from nobody to Dee, waiting for their account",
    ]);
    expect(cardUpdates(h)[1]!.data.metadata.provenance).toEqual([
      expect.objectContaining({ from: null, to: "Dee" }),
    ]);
    expect(h.tx.card.findMany).toHaveBeenCalledWith({
      where: { lorewardEntryId: { in: ["entry_1"] }, lorewardEdition: "runner-up" },
      select: { id: true, title: true, isRetired: true, metadata: true },
      orderBy: { id: "asc" },
    });
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

  it("changes nothing on a place with no card yet, and leaves it to the mint", async () => {
    jest.mocked(mintTrophyCards).mockResolvedValue({ minted: 1 });
    const h = setup({ contest: [daily("Amy", "Old page")] });

    await expect(override(h, winner("Cy", "Page"))).resolves.toMatchObject({
      reassigned: 0,
      voided: 0,
      minted: 1,
      mintDeferred: false,
    });

    expect(resolveLorewardPlace).not.toHaveBeenCalled();
    expect(h.tx.card.update).not.toHaveBeenCalled();
  });

  it("creates the entry, approved and marked, when its contest has none, and leaves the trophy to the mint", async () => {
    const h = setup({ contest: [], keyed: null });

    await override(h, winner("Cy", "Page"));

    const written = {
      winnerUser: "Cy",
      winnerPage: "Page",
      winnerScore: null,
      winnerBytes: null,
      runnerUpUser: null,
      runnerUpPage: null,
      runnerUpScore: null,
      runnerUpBytes: null,
    };
    expect(h.tx.lorewardEntry.upsert).toHaveBeenCalledWith({
      where: { date_type: { date: "2026-10-20", type: "daily" } },
      create: {
        date: "2026-10-20",
        type: "daily",
        ...written,
        status: "approved",
        overriddenAt: expect.any(Date),
      },
      update: { ...written, overriddenAt: expect.any(Date) },
      select: { id: true },
    });
    expect(locks(h)).toEqual(["7332 daily:2026-10-20:winner", "7332 daily:2026-10-20:runner-up"]);
    expect(h.tx.lorewardEntry.updateMany).not.toHaveBeenCalled();
    expect(h.tx.card.findMany).not.toHaveBeenCalled();
    expect(mintTrophyCards).toHaveBeenCalledWith(h.db, ["entry_new"]);
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

  it("keeps the state-keyed entry's stored fields for those the override leaves out", async () => {
    const [ool, state] = weeklyTwins("Amy", "Amy");
    const h = setup({
      contest: [
        { ...ool!, winnerBytes: 1 },
        { ...state!, winnerBytes: 2 },
      ],
    });

    await override(h, winner("Amy", "Page"), WEEKLY);

    expect(h.tx.lorewardEntry.updateMany.mock.calls[0]![0].data).toMatchObject({ winnerBytes: 2 });
  });

  it("finds the contest by the keyed entry's own first day when the state key is overridden", async () => {
    const [, state] = weeklyTwins("Amy", "Amy");
    const h = setup({ contest: weeklyTwins("Amy", "Amy"), keyed: state });

    await override(h, winner("Cy", "Page"), { date: "2026-W43", type: "weekly" });

    expect(locks(h)[0]).toBe("7332 weekly:2026-10-19:winner");
    expect(h.tx.lorewardEntry.findUnique).toHaveBeenCalledWith({
      where: { date_type: { date: "2026-W43", type: "weekly" } },
      select: { type: true, date: true, dateStart: true },
    });
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

  it("counts a place its entries disagreed on as changed, even when the override names one of them", async () => {
    accounts({ Amy: "user_amy" });
    const h = setup({
      contest: weeklyTwins("Amy", "Bob"),
      trophies: [weeklyTrophy("trophy_1", [AMY_COPY])],
    });

    await expect(override(h, winner("Amy", "Page"), WEEKLY)).resolves.toMatchObject({
      reassigned: 1,
    });
  });

  it("keeps the place's trophy on the card whose copy the new holder already owns, and voids the other copy", async () => {
    accounts({ Cy: "user_cy" });
    const cyCopy = { id: "own_c", cardId: "trophy_b", ownerId: "user_cy", serialNumber: 1 };
    const amyCopy = { ...AMY_COPY, cardId: "trophy_a" };
    const h = setup({
      contest: weeklyTwins("Amy", "Amy"),
      trophies: [weeklyTrophy("trophy_a", [amyCopy]), weeklyTrophy("trophy_b", [cyCopy])],
    });

    await expect(override(h, winner("Cy", "Page"), WEEKLY)).resolves.toMatchObject({
      reassigned: 1,
      voided: 1,
    });

    expect(h.tx.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(removeCopyTx).toHaveBeenCalledWith(h.tx, amyCopy, "VOID");
    expect(auditRows(h)).toEqual([
      expect.objectContaining({
        action: "TROPHY_VOID",
        target: "trophy_a",
        details:
          "Voided the duplicate copy of the weekly winner of 2026-W43 trophy held by user_amy: the place's trophy is trophy_b",
      }),
      expect.objectContaining({ action: "TROPHY_REASSIGN", target: "trophy_b" }),
    ]);
    expect(cardUpdates(h).map(({ where, data }) => [where.id, data.metadata.grantedTo])).toEqual([
      ["trophy_a", null],
      ["trophy_b", "user_cy"],
    ]);
  });

  it("refills a place whose cards a void retired: the keeper comes back, the duplicate stays retired but unvoided", async () => {
    accounts({ Cy: "user_cy" });
    const voidedMeta = { contest: "weekly", wikiUser: "Amy", voidedAt: "2026-10-18T00:00:00.000Z" };
    const voidedCard = (id: string) =>
      amyTrophy([], { id, title: "Page", isRetired: true, metadata: voidedMeta });
    const [ool, state] = weeklyTwins("Amy", "Amy");
    const emptied = (entry: Entry): Entry => ({ ...entry, winnerUser: null, winnerPage: null });
    const h = setup({
      contest: [emptied(ool!), emptied(state!)],
      trophies: [voidedCard("trophy_a"), voidedCard("trophy_b")],
    });

    await override(h, winner("Cy", "Page"), WEEKLY);

    const [keeper, duplicate] = cardUpdates(h);
    expect(keeper).toMatchObject({
      where: { id: "trophy_a" },
      data: { isRetired: false, metadata: { voidedAt: null } },
    });
    expect(duplicate!.where.id).toBe("trophy_b");
    expect(duplicate!.data).not.toHaveProperty("isRetired");
    expect(duplicate!.data.metadata).toMatchObject({ voidedAt: null, wikiUser: "Cy" });
  });

  it("does nothing on a later override of the refilled place", async () => {
    const left = (id: string, isRetired: boolean) =>
      amyTrophy([], {
        id,
        title: "Page",
        isRetired,
        metadata: { contest: "weekly", wikiUser: "Cy", voidedAt: null },
      });
    const h = setup({
      contest: weeklyTwins("Cy", "Cy"),
      trophies: [left("trophy_a", false), left("trophy_b", true)],
    });

    await expect(override(h, winner("Cy", "Page"), WEEKLY)).resolves.toMatchObject({
      reassigned: 0,
      voided: 0,
    });
    expect(h.tx.card.update).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps the place's trophy on a card that is not retired when no card holds a copy", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({
      contest: weeklyTwins("Amy", "Amy"),
      trophies: [
        amyTrophy([], {
          id: "trophy_a",
          title: "Page",
          isRetired: true,
          metadata: { wikiUser: "Amy" },
        }),
        amyTrophy([], { id: "trophy_b", title: "Page", metadata: { wikiUser: "Amy" } }),
      ],
    });

    await override(h, winner("Cy", "Page"), WEEKLY);

    expect(mintTrophyCopyTx).toHaveBeenCalledTimes(1);
    expect(mintTrophyCopyTx).toHaveBeenCalledWith(h.tx, "trophy_b", "user_cy");
  });

  it("moves the held copy when no copy is the new holder's, and lets the other card only follow", async () => {
    accounts({ Cy: "user_cy" });
    const h = setup({
      contest: weeklyTwins("Amy", "Amy"),
      trophies: [
        weeklyTrophy("trophy_a", []),
        weeklyTrophy("trophy_b", [{ ...AMY_COPY, cardId: "trophy_b" }]),
      ],
    });

    await expect(override(h, winner("Cy", "Page"), WEEKLY)).resolves.toMatchObject({
      reassigned: 2,
      voided: 0,
    });

    expect(h.tx.cardOwnership.updateMany).toHaveBeenCalledTimes(1);
    expect(h.tx.cardTransferEvent.create.mock.calls[0]![0].data).toMatchObject({
      cardId: "trophy_b",
      toUserId: "user_cy",
    });
    expect(mintTrophyCopyTx).not.toHaveBeenCalled();
    expect(auditRows(h)[0]).toMatchObject({
      action: "TROPHY_REASSIGN",
      target: "trophy_a",
      details:
        "Reassigned the duplicate weekly winner of 2026-W43 trophy card from Amy to Cy: the place's trophy is trophy_b",
    });
    expect(cardUpdates(h).map(({ where, data }) => [where.id, data.metadata.grantedTo])).toEqual([
      ["trophy_a", null],
      ["trophy_b", "user_cy"],
    ]);
    expect(resolveLorewardPlace).toHaveBeenCalledTimes(1);
  });
});
