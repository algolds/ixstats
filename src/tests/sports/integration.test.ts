import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { exchangeService } from "~/lib/vault/exchange-service";
describe("MyLeague Phase 3 & 4 Integration Tests", () => {
  let mockPrisma: any;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(exchangeService, "spend").mockResolvedValue({ success: true, newBalance: 1000 });
    jest.spyOn(exchangeService, "earn").mockResolvedValue({ success: true, newBalance: 1000 });
    jest
      .spyOn(exchangeService, "getOrCreateWallet")
      .mockResolvedValue({ id: "wallet_1", sovereigns: 1000 } as any);
    jest
      .spyOn(exchangeService, "getBalance")
      .mockResolvedValue({ sovereigns: 1000, lifetimeEarned: 1000, lifetimeSpent: 0 } as any);

    mockPrisma = {
      $transaction: jest.fn<any>((cb: any) => cb(mockPrisma)),
      sportLeague: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockResolvedValue({}),
      },
      sportTeam: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportPlayer: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportCoach: {
        create: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportSeason: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportStanding: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        createMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
      },
      sportTeamSeason: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
      },
      sportRookieClass: {
        create: jest.fn<any>().mockResolvedValue({}),
      },
      sportDraftPick: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
      },
      sportMatch: {
        create: jest.fn<any>().mockResolvedValue({}),
        findMany: jest.fn<any>().mockResolvedValue([]),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportTransferListing: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        upsert: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      sportTransferBid: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockResolvedValue({}),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      country: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        findFirst: jest.fn<any>().mockResolvedValue(null),
        update: jest.fn<any>().mockResolvedValue({}),
      },
      policy: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      card: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockResolvedValue({}),
      },
      cardOwnership: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockResolvedValue({}),
      },
      thinkpagesAccount: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockResolvedValue({}),
      },
      thinkpagesPost: {
        create: jest.fn<any>().mockResolvedValue({}),
      },
      wikiCache: {
        upsert: jest.fn<any>().mockResolvedValue({}),
      },
      vaultTransaction: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
    };

    const createCaller = createCallerFactory(sportsRouter);
    caller = createCaller({
      db: mockPrisma,
      auth: { userId: "test-auth-id" },
      user: { id: "test-manager-id" },
      headers: {
        get: jest.fn().mockReturnValue("127.0.0.1"),
      },
    } as any);
  });

  describe("Phase 3: Exchange Economics Integration", () => {
    it("deducts charter fee on createLeague", async () => {
      // Mock exchangeService.spend success
      (exchangeService.spend as any).mockResolvedValue({ success: true, newBalance: 500 });
      mockPrisma.sportLeague.create.mockResolvedValue({ id: "league_123" });
      mockPrisma.sportTeam.create.mockResolvedValue({ id: "team_123" });
      mockPrisma.sportPlayer.create.mockResolvedValue({ id: "player_123" });
      mockPrisma.sportCoach.create.mockResolvedValue({ id: "coach_123" });

      await caller.createLeague({
        name: "Test Premier League",
        sportPreset: "soccer",
        teamCount: 2,
        settings: {},
      });

      expect(exchangeService.spend).toHaveBeenCalledWith(
        "test-manager-id",
        500,
        "CHARTER_FEE",
        "LEAGUE_CREATE:Test Premier League",
        expect.any(Object)
      );
    });

    it("deducts claim fee on claimTeam", async () => {
      (exchangeService.spend as any).mockResolvedValue({ success: true, newBalance: 450 });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_123",
        ownerUserId: null,
      });
      mockPrisma.sportTeam.update.mockResolvedValue({
        id: "team_123",
        ownerUserId: "test-manager-id",
      });
      mockPrisma.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "upgrade_myclub_license" } },
      ]);

      await caller.claimTeam({ teamId: "team_123" });

      expect(exchangeService.spend).toHaveBeenCalledWith(
        "test-manager-id",
        50,
        "CHARTER_FEE",
        "TEAM_CLAIM:team_123",
        expect.any(Object)
      );
    });

    it("upgrades stadium capacity and charges wallet", async () => {
      (exchangeService.spend as any).mockResolvedValue({ success: true, newBalance: 1000 });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_123",
        ownerUserId: "test-manager-id",
        stadiumCapacity: 5000,
      });
      mockPrisma.sportTeam.update.mockResolvedValue({ id: "team_123" });

      await caller.upgradeStadium({ teamId: "team_123" });

      expect(exchangeService.spend).toHaveBeenCalledWith(
        "test-manager-id",
        1000,
        "STADIUM_UPGRADE",
        "STADIUM_UPGRADE:team_123",
        expect.any(Object)
      );
      expect(mockPrisma.sportTeam.update).toHaveBeenCalledWith({
        where: { id: "team_123" },
        data: { stadiumCapacity: { increment: 1000 } },
      });
    });
    it("throws TRPCError when exchangeService.spend returns failure on claimTeam", async () => {
      (exchangeService.spend as any).mockResolvedValue({
        success: false,
        message: "Insufficient Sovereigns",
      });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_123",
        ownerUserId: null,
      });
      mockPrisma.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "upgrade_myclub_license" } },
      ]);

      await expect(
        caller.claimTeam({
          teamId: "team_123",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: "BAD_REQUEST",
          message: "Insufficient Sovereigns",
        })
      );
    });
  });
});
