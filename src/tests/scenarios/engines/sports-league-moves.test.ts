/** @jest-environment node */
/**
 * Moving a club between leagues and deleting a league, on the in-memory client. A club joins only a league its mover
 * runs, of the same sport, with room, and only while neither league has a season in progress. A league holding
 * another player's club is not deleted; one that is deleted first hands back every escrow its cascade would take:
 * bids on its clubs' players, bids its clubs placed elsewhere, and stakes on its unplayed matches, each under its own
 * key. A season reset and a regenerated schedule refund the open stakes on the matches they delete.
 *
 * Regressions: transferTeam let any club owner move into any league (another player's, mid-season, no capacity
 * check); deleteLeague cascade-deleted other players' paid clubs and open bids with their escrow; resetSeason and
 * regenerateSchedule deleted matches with open predictions, and their stakes, behind them.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { leaguesCrudRouter } from "~/server/api/routers/sports/leagues/crud";
import { leaguesScheduleRouter } from "~/server/api/routers/sports/leagues/schedule";
import { sportsTransfersRouter } from "~/server/api/routers/sports/transfers";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addLeague,
  addPerson,
  asPerson,
  sovereignsOf,
  type Person,
} from "~/tests/helpers/sports-world";

const leagues = createCallerFactory(leaguesCrudRouter);
const schedule = createCallerFactory(leaguesScheduleRouter);
const transfers = createCallerFactory(sportsTransfersRouter);

let db: MemoryPrisma;
let mia: Person; // runs League Home (clubs home-a, hers, and home-b, unowned)
let ola: Person; // runs League Away (clubs away-x, Dev's, and away-y, Ben's)
let dev: Person;
let ben: Person;
let cleo: Person;

const as = (who: Person) => asPerson(db as never, who);

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  db.store.onRaw(/FROM "sport_teams" WHERE id = \? FOR SHARE/, ([id]) => [{ id }]);
  db.store.onRaw(/FROM "sport_players" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  db.store.onRaw(/FROM "sport_teams" WHERE "leagueId" = \? FOR UPDATE/, () => []);
  db.store.onRaw(/FROM "sport_players" WHERE "teamId" IN \(SELECT/, () => []);
  db.store.onRaw(/FROM "sport_matches" WHERE "seasonId" IN \(\?(, \?)*\) FOR UPDATE/, () => []);
  db.store.onRaw(/FROM "exchange_wallets" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
  mockDb = db;
  mia = await addPerson(db as never, "mia", 1000);
  ola = await addPerson(db as never, "ola", 1000);
  dev = await addPerson(db as never, "dev", 1000);
  ben = await addPerson(db as never, "ben", 1000);
  cleo = await addPerson(db as never, "cleo", 1000);
  await addLeague(db as never, {
    id: "home",
    managerId: mia.id,
    sportPreset: "hockey",
    clubs: [
      { id: "home-a", ownerUserId: mia.id, base: 60, rosterSize: 2 },
      { id: "home-b", ownerUserId: null, base: 60, rosterSize: 2 },
    ],
  });
  await addLeague(db as never, {
    id: "away",
    managerId: ola.id,
    sportPreset: "hockey",
    clubs: [
      { id: "away-x", ownerUserId: dev.id, base: 60, rosterSize: 2 },
      { id: "away-y", ownerUserId: ben.id, base: 60, rosterSize: 2 },
    ],
  });
});
afterEach(() => jest.restoreAllMocks());

const leagueOf = async (teamId: string) =>
  (await db.sportTeam.findUniqueOrThrow({ where: { id: teamId } })).leagueId;

describe("transferTeam", () => {
  it("refuses a move into a league the club's owner does not run", async () => {
    await expect(
      leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "home" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await leagueOf("away-y")).toBe("away");
  });

  it("moves a club into the owner's own league of the same sport, between seasons, with room", async () => {
    await addLeague(db as never, {
      id: "bens",
      managerId: ben.id,
      sportPreset: "hockey",
      clubs: [],
    });
    await addLeague(db as never, {
      id: "bens-f1",
      managerId: ben.id,
      sportPreset: "f1",
      clubs: [],
    });

    // Another sport
    await expect(
      leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "bens-f1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "That league plays another sport" });

    // Either league mid-season
    const season = await db.sportSeason.create({
      data: { leagueId: "away", seasonNumber: 1, status: "in_progress", startIxTime: 0 },
    });
    await expect(
      leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "bens" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.sportSeason.update({ where: { id: season.id }, data: { status: "completed" } });
    await db.sportSeason.create({
      data: { leagueId: "bens", seasonNumber: 1, status: "in_progress", startIxTime: 0 },
    });
    await expect(
      leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "bens" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.sportSeason.updateMany({ where: { leagueId: "bens" }, data: { status: "completed" } });

    // Full
    await db.sportTeam.createMany({
      data: Array.from({ length: 64 }, (_, i) => ({
        id: `bens-${i}`,
        leagueId: "bens",
        name: `B${i}`,
      })),
    });
    await expect(
      leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "bens" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "That league is full" });
    expect(await leagueOf("away-y")).toBe("away");

    await db.sportTeam.deleteMany({ where: { leagueId: "bens" } });
    await leagues(as(ben)).transferTeam({ teamId: "away-y", targetLeagueId: "bens" });
    expect(await leagueOf("away-y")).toBe("bens");
  });
});

describe("deleteLeague", () => {
  it("keeps a league while another player owns one of its clubs", async () => {
    await db.sportTeam.update({ where: { id: "home-b" }, data: { ownerUserId: cleo.id } });

    await expect(leagues(as(mia)).deleteLeague({ id: "home" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot delete a league while other players own clubs in it",
    });
    expect(await db.sportTeam.count({ where: { leagueId: "home" } })).toBe(2);
  });

  it("refunds every bid and stake the cascade would take, once, before deleting", async () => {
    // Ben bids on Mia's player; Mia's club bids on Dev's player
    const onMine = await transfers(as(mia)).listPlayerForTransfer({
      playerId: "home-a-p00",
      price: 200,
    });
    const benBid = await transfers(as(ben)).placeTransferBid({
      listingId: onMine.id,
      amount: 200,
      bidderTeamId: "away-y",
    });
    const onDevs = await transfers(as(dev)).listPlayerForTransfer({
      playerId: "away-x-p00",
      price: 100,
    });
    const miaBid = await transfers(as(mia)).placeTransferBid({
      listingId: onDevs.id,
      amount: 100,
      bidderTeamId: "home-a",
    });
    // Cleo staked 50 on a Home match not yet played
    const season = await db.sportSeason.create({
      data: { leagueId: "home", seasonNumber: 1, status: "in_progress", startIxTime: 0 },
    });
    const match = await db.sportMatch.create({
      data: {
        seasonId: season.id,
        matchDay: 1,
        homeTeamId: "home-a",
        awayTeamId: "home-b",
        scheduledIxTime: Date.now() + 3_600_000,
      },
    });
    const stake = await db.sportPrediction.create({
      data: {
        matchId: match.id,
        seasonId: season.id,
        userId: cleo.clerkUserId,
        outcome: "home",
        stake: 50,
        createdIxTime: 0,
      },
    });
    await db.exchangeWallet.update({ where: { userId: cleo.id }, data: { sovereigns: 950 } });
    expect(await sovereignsOf(db as never, [mia.id, ben.id, cleo.id])).toEqual({
      [mia.id]: 900,
      [ben.id]: 800,
      [cleo.id]: 950,
    });

    await leagues(as(mia)).deleteLeague({ id: "home" });

    expect(await db.sportLeague.findUnique({ where: { id: "home" } })).toBeNull();
    expect(await sovereignsOf(db as never, [mia.id, ben.id, cleo.id])).toEqual({
      [mia.id]: 1000,
      [ben.id]: 1000,
      [cleo.id]: 1000,
    });
    const keys = (
      await db.exchangeTransaction.findMany({
        where: { sovereigns: { gt: 0 }, idempotencyKey: { not: null } },
        select: { idempotencyKey: true },
      })
    ).map((r) => r.idempotencyKey);
    expect(keys.sort()).toEqual(
      [
        `PREDICTION_REFUND:${stake.id}`,
        `TRANSFER_BID_REFUND:${benBid.id}`,
        `TRANSFER_BID_REFUND:${miaBid.id}`,
      ].sort()
    );
    // The bid Mia's club placed on Dev's player outlives the league, closed
    expect(await db.sportTransferBid.findUniqueOrThrow({ where: { id: miaBid.id } })).toMatchObject(
      { status: "expired" }
    );
  });
});

describe("season reset and schedule regeneration", () => {
  it.each(["resetSeason", "regenerateSchedule"] as const)(
    "%s refunds the open stakes on the matches it deletes",
    async (procedure) => {
      const season = await db.sportSeason.create({
        data: { leagueId: "home", seasonNumber: 1, status: "in_progress", startIxTime: 0 },
      });
      const match = await db.sportMatch.create({
        data: {
          seasonId: season.id,
          matchDay: 1,
          homeTeamId: "home-a",
          awayTeamId: "home-b",
          scheduledIxTime: Date.now() + 3_600_000,
        },
      });
      const stake = await db.sportPrediction.create({
        data: {
          matchId: match.id,
          seasonId: season.id,
          userId: cleo.clerkUserId,
          outcome: "away",
          stake: 75,
          createdIxTime: 0,
        },
      });
      await db.exchangeWallet.update({ where: { userId: cleo.id }, data: { sovereigns: 925 } });

      await schedule(as(mia))[procedure]({ seasonId: season.id });

      expect((await sovereignsOf(db as never, [cleo.id]))[cleo.id]).toBe(1000);
      expect(
        await db.exchangeTransaction.count({
          where: { idempotencyKey: `PREDICTION_REFUND:${stake.id}` },
        })
      ).toBe(1);
      expect(await db.sportPrediction.count({ where: { id: stake.id } })).toBe(0);
    }
  );
});
