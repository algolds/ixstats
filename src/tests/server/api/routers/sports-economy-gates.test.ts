/**
 * MyClub's Sovereign moves stop while the vault economy is in maintenance mode: every sports mutation that spends,
 * pays or refunds ₷ refuses with PRECONDITION_FAILED and moves nothing. The Exchange flag does not gate MyClub (spec
 * §6): with the Exchange switched off and maintenance off, a stadium upgrade still charges.
 *
 * Regression: the sports spends skipped the vault maintenance switch the Exchange honours.
 */
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  exchangeService: { spend: jest.fn(), earn: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { exchangeService } from "~/lib/vault/exchange-service";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(sportsRouter);
const spend = exchangeService.spend as jest.Mock;
const earn = exchangeService.earn as jest.Mock;

const ME = "db_me";
type Db = ReturnType<typeof createMockPrisma>;
type Caller = ReturnType<typeof createCaller>;

function callerWith(config: Record<string, string>) {
  const db = createMockPrisma();
  db.$executeRaw = jest.fn().mockResolvedValue(1) as never;
  db.$queryRaw = jest.fn().mockResolvedValue([{ id: "x" }]) as never;
  db.systemConfig.findMany.mockResolvedValue(
    Object.entries(config).map(([key, value]) => ({ key, value }))
  );
  const team = { id: "team_1", ownerUserId: ME, nationId: null, leagueId: "league_1" };
  db.sportTeam.findUnique.mockResolvedValue(team);
  db.sportPlayer.findUnique.mockResolvedValue({ id: "player_1", ratings: {}, team });
  db.sportTransferListing.findUnique.mockResolvedValue({ playerId: "player_1", status: "open" });
  db.sportTransferBid.findUnique.mockResolvedValue({
    id: "bid_1",
    status: "pending",
    bidderTeamId: "team_2",
    listing: { playerId: "player_1" },
  });
  db.sportMatch.findUnique.mockResolvedValue({
    id: "m1",
    seasonId: "s1",
    status: "scheduled",
    scheduledIxTime: Date.now() + 3_600_000,
  });
  const caller = createCaller(
    createMockRouterContext({
      auth: { userId: `clerk_${ME}` },
      user: { id: ME, clerkUserId: `clerk_${ME}`, role: { name: "user", level: 100 } },
      db,
    }) as never
  );
  return { db, caller };
}

const spends: [string, (c: Caller, db: Db) => Promise<unknown>][] = [
  ["upgradeStadium", (c) => c.upgradeStadium({ teamId: "team_1" })],
  ["invokePatronSaint", (c) => c.invokePatronSaint({ teamId: "team_1", saintName: "Ix" })],
  ["trainPlayer", (c) => c.trainPlayer({ playerId: "player_1", attributeFocus: "speed" })],
  ["teamTraining", (c) => c.teamTraining({ teamId: "team_1" })],
  ["placePrediction", (c) => c.placePrediction({ matchId: "m1", outcome: "home", stake: 10 })],
  [
    "createLeague",
    (c) => c.createLeague({ name: "L", sportPreset: "hockey", teamCount: 2, settings: {} }),
  ],
  [
    "claimTeam",
    (c, db) => {
      db.sportTeam.findUnique.mockResolvedValue({ id: "team_1", ownerUserId: null, league: null });
      db.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "upgrade_myclub_license" } },
      ]);
      return c.claimTeam({ teamId: "team_1" });
    },
  ],
  [
    "placeTransferBid",
    (c) => c.placeTransferBid({ listingId: "listing_1", amount: 10, bidderTeamId: "team_1" }),
  ],
  ["respondToTransferBid", (c) => c.respondToTransferBid({ bidId: "bid_1", action: "accept" })],
  [
    "respondToTransferBid (reject)",
    (c) => c.respondToTransferBid({ bidId: "bid_1", action: "reject" }),
  ],
];

beforeEach(() => {
  invalidateVaultConfigCache();
  spend.mockReset().mockResolvedValue({ success: true, newBalance: 0 });
  earn.mockReset().mockResolvedValue({ success: true, newBalance: 0 });
});

describe("sports ₷ moves in maintenance mode", () => {
  it.each(spends)("%s refuses and moves no Sovereigns", async (_name, run) => {
    const { db, caller } = callerWith({ vault_isMaintenanceMode: "true" });

    await expect(run(caller, db)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "The vault economy is in maintenance mode.",
    });

    expect(spend).not.toHaveBeenCalled();
    expect(earn).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not gate MyClub on the Exchange flag", async () => {
    const { db, caller } = callerWith({ vault_isExchangeEnabled: "false" });
    db.sportTeam.update.mockResolvedValue({ id: "team_1", stadiumCapacity: 6000 });

    await caller.upgradeStadium({ teamId: "team_1" });

    expect(spend).toHaveBeenCalledWith(ME, 1000, "STADIUM_UPGRADE", "STADIUM_UPGRADE:team_1", db);
  });
});
