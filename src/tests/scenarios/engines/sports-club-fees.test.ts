/** @jest-environment node */
/**
 * MyClub's paid actions charge and write in one transaction, on the in-memory client: when the write after the charge
 * fails, the charge rolls back with it (no Sovereigns gone, no ledger row). With a requestId, a retried request is
 * charged once and applied once (the stadium grows once, the league is chartered once and the retry gets it back);
 * a new requestId is a new purchase.
 *
 * Regression: the stadium upgrade, patron saint, player and team training and the league charter charged through
 * the wallet first and wrote their result in separate statements, so a failed write left the player charged with
 * nothing to show for it.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsClubRouter } from "~/server/api/routers/sports/club";
import { leaguesCrudRouter } from "~/server/api/routers/sports/leagues/crud";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addLeague,
  addPerson,
  asPerson,
  sovereignsOf,
  type Person,
} from "~/tests/helpers/sports-world";

const club = createCallerFactory(sportsClubRouter);
const leagues = createCallerFactory(leaguesCrudRouter);

let db: MemoryPrisma;
let dev: Person;

const as = () => asPerson(db as never, dev);
const wallet = async () => (await sovereignsOf(db as never, [dev.id]))[dev.id];
const ledgerRows = () => db.exchangeTransaction.count();

/** The transaction client: its delegates are not the plain client's, so a write inside a transaction is spied here. */
const txClient = () => db.$transaction(async (tx) => tx) as Promise<PrismaClient>;
const failOnce = (delegate: Record<string, unknown>, method: string) =>
  jest
    .spyOn(delegate as never, method as never)
    .mockRejectedValueOnce(new Error("connection reset") as never);

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  db.store.onRaw(/FROM "sport_players" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  db.store.onRaw(
    /FROM "sport_players" WHERE "teamId" = \? AND "isActive" = true ORDER BY id/,
    () => []
  );
  db.store.onRaw(/FROM "exchange_wallets" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  mockDb = db;
  const manager = await addPerson(db as never, "manager");
  dev = await addPerson(db as never, "dev", 5000);
  await addLeague(db as never, {
    id: "league",
    managerId: manager.id,
    sportPreset: "hockey",
    clubs: [{ id: "south", ownerUserId: dev.id, base: 60, rosterSize: 3 }],
  });
});
afterEach(() => jest.restoreAllMocks());

describe("a failed write rolls the charge back", () => {
  const cases: [string, (tx: PrismaClient) => void, () => Promise<unknown>][] = [
    [
      "upgradeStadium",
      (tx) => failOnce(tx.sportTeam as never, "update"),
      () => club(as()).upgradeStadium({ teamId: "south" }),
    ],
    [
      "invokePatronSaint",
      (tx) => failOnce(tx.sportTeam as never, "update"),
      () => club(as()).invokePatronSaint({ teamId: "south", saintName: "Ix" }),
    ],
    [
      "trainPlayer",
      (tx) => failOnce(tx.sportPlayer as never, "update"),
      () => club(as()).trainPlayer({ playerId: "south-p00", attributeFocus: "skating" }),
    ],
    [
      "teamTraining",
      (tx) => {
        jest.spyOn(Math, "random").mockReturnValue(0); // every player gains, so a rating is written
        failOnce(tx.sportPlayer as never, "update");
      },
      () => club(as()).teamTraining({ teamId: "south" }),
    ],
    [
      "createLeague",
      (tx) => failOnce(tx.sportPlayer as never, "createMany"),
      () =>
        leagues(as()).createLeague({
          name: "Dev L",
          sportPreset: "hockey",
          teamCount: 2,
          settings: {},
        }),
    ],
  ];

  it.each(cases)("%s", async (_name, breakWrite, run) => {
    const before = {
      team: await db.sportTeam.findUniqueOrThrow({ where: { id: "south" } }),
      players: await db.sportPlayer.findMany({ orderBy: { id: "asc" } }),
      leagues: await db.sportLeague.count(),
    };
    breakWrite(await txClient());

    await expect(run()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(await wallet()).toBe(5000);
    expect(await ledgerRows()).toBe(0);
    expect(await db.sportTeam.findUniqueOrThrow({ where: { id: "south" } })).toEqual(before.team);
    expect(await db.sportPlayer.findMany({ orderBy: { id: "asc" } })).toEqual(before.players);
    expect(await db.sportLeague.count()).toBe(before.leagues);
  });
});

describe("a retried request is charged and applied once", () => {
  it("grows the stadium once per requestId", async () => {
    const capacity = async () =>
      (await db.sportTeam.findUniqueOrThrow({ where: { id: "south" } })).stadiumCapacity;

    await club(as()).upgradeStadium({ teamId: "south", requestId: "press-0001" });
    const retry = await club(as()).upgradeStadium({ teamId: "south", requestId: "press-0001" });
    expect(retry.stadiumCapacity).toBe(6000);
    expect(await capacity()).toBe(6000);
    expect(await wallet()).toBe(4000);
    expect(
      await db.exchangeTransaction.findMany({ select: { sovereigns: true, idempotencyKey: true } })
    ).toEqual([{ sovereigns: -1000, idempotencyKey: `sports:stadium:${dev.id}:press-0001` }]);

    await club(as()).upgradeStadium({ teamId: "south", requestId: "press-0002" });
    expect(await capacity()).toBe(7000);
    expect(await wallet()).toBe(3000);
  });

  it.each([
    [
      "invokePatronSaint",
      () =>
        club(as()).invokePatronSaint({ teamId: "south", saintName: "Ix", requestId: "press-0001" }),
      100,
    ],
    [
      "trainPlayer",
      () =>
        club(as()).trainPlayer({
          playerId: "south-p00",
          attributeFocus: "skating",
          requestId: "press-0001",
        }),
      25,
    ],
    [
      "teamTraining",
      () => club(as()).teamTraining({ teamId: "south", requestId: "press-0001" }),
      100,
    ],
  ] as const)("%s charges once", async (_name, run, fee) => {
    await run();
    await run();
    expect(await wallet()).toBe(5000 - fee);
    expect(await ledgerRows()).toBe(1);
  });

  it("charters one league, and the retry gets that league back", async () => {
    const charter = () =>
      leagues(as()).createLeague({
        name: "Dev League",
        sportPreset: "hockey",
        teamCount: 2,
        settings: {},
        requestId: "press-0001",
      });

    const first = await charter();
    const retry = await charter();

    expect(retry.id).toBe(first.id);
    expect(retry.teams.map((t) => t.id)).toEqual(first.teams.map((t) => t.id));
    expect(await db.sportLeague.count({ where: { name: "Dev League" } })).toBe(1);
    expect(await wallet()).toBe(4500);
    expect(await ledgerRows()).toBe(1);
  });
});
