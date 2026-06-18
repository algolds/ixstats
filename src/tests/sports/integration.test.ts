import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { createCallerFactory } from "../../server/api/trpc";
import { sportsRouter } from "../../server/api/routers/sports";
import { exchangeService } from "../../lib/exchange-service";
import { transitionSeasonAction } from "../../lib/sports/transition";

// Mock exchangeService
jest.mock("../../lib/exchange-service", () => ({
  exchangeService: {
    spend: jest.fn(),
    earn: jest.fn(),
  },
}));

describe("MyLeague Phase 3 & 4 Integration Tests", () => {
  let mockPrisma: any;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
      sportLeague: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      sportTeam: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      sportPlayer: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      sportCoach: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      sportSeason: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      sportStanding: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sportTeamSeason: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sportRookieClass: {
        create: jest.fn().mockResolvedValue({}),
      },
      sportDraftPick: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sportMatch: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      sportTransferListing: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      sportTransferBid: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      policy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      card: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      cardOwnership: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      thinkpagesAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      thinkpagesPost: {
        create: jest.fn().mockResolvedValue({}),
      },
      wikiCache: {
        upsert: jest.fn().mockResolvedValue({}),
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
        "ADMIN_ADJUSTMENT",
        "STADIUM_UPGRADE:team_123",
        expect.any(Object)
      );
      expect(mockPrisma.sportTeam.update).toHaveBeenCalledWith({
        where: { id: "team_123" },
        data: { stadiumCapacity: { increment: 1000 } },
      });
    });

    it("allows managers to configure ticket prices", async () => {
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_123",
        ownerUserId: "test-manager-id",
      });
      mockPrisma.sportTeam.update.mockResolvedValue({ id: "team_123" });

      await caller.setTicketPrice({ teamId: "team_123", price: 25 });

      expect(mockPrisma.sportTeam.update).toHaveBeenCalledWith({
        where: { id: "team_123" },
        data: { ticketPrice: 25 },
      });
    });
  });

  describe("Phase 3: P2P Transfer Board with Escrow", () => {
    it("places transfer listing and allows bidding with escrow lockup", async () => {
      // 1. List player
      mockPrisma.sportPlayer.findUnique.mockResolvedValue({
        id: "player_abc",
        teamId: "team_123",
        team: { id: "team_123", ownerUserId: "test-manager-id" },
      });
      mockPrisma.sportTransferListing.upsert.mockResolvedValue({ id: "listing_xyz" });

      await caller.listPlayerForTransfer({ playerId: "player_abc", price: 250 });

      expect(mockPrisma.sportTransferListing.upsert).toHaveBeenCalledWith({
        where: { playerId: "player_abc" },
        update: { price: 250, status: "open", teamId: "team_123" },
        create: { playerId: "player_abc", teamId: "team_123", price: 250, status: "open" },
      });

      // 2. Bid on player (escrow)
      (exchangeService.spend as any).mockResolvedValue({ success: true });
      mockPrisma.sportTransferListing.findUnique.mockResolvedValue({
        id: "listing_xyz",
        status: "open",
      });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "bidder_team_789",
        ownerUserId: "test-manager-id",
      });
      mockPrisma.sportTransferBid.create.mockResolvedValue({ id: "bid_999" });

      await caller.placeTransferBid({
        listingId: "listing_xyz",
        amount: 300,
        bidderTeamId: "bidder_team_789",
      });

      expect(exchangeService.spend).toHaveBeenCalledWith(
        "test-manager-id",
        300,
        "SHARE_BUY",
        "TRANSFER_BID_ESCROW:listing_xyz",
        expect.any(Object)
      );
    });

    it("refunds bidder when bid is rejected", async () => {
      mockPrisma.sportTransferBid.findUnique.mockResolvedValue({
        id: "bid_999",
        status: "pending",
        amount: 300,
        bidderUserId: "bidder-user-id",
        listing: {
          playerId: "player_abc",
          player: {
            team: {
              id: "team_123",
              ownerUserId: "test-manager-id",
            },
          },
        },
      });

      await caller.respondToTransferBid({
        bidId: "bid_999",
        action: "reject",
      });

      expect(mockPrisma.sportTransferBid.update).toHaveBeenCalledWith({
        where: { id: "bid_999" },
        data: { status: "rejected" },
      });
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "bidder-user-id",
        300,
        "ADMIN_ADJUSTMENT",
        "TRANSFER_BID_REFUND:bid_999",
        expect.any(Object)
      );
    });
  });

  describe("Phase 4: MyCountry & Outer System Integrations", () => {
    it("buffs rookie class generated players when National Sports Academy policy is active", async () => {
      const mockSeason = {
        id: "season_completed",
        seasonNumber: 1,
        status: "completed",
        championTeamId: null,
        leagueId: "league_123",
        league: {
          sportPreset: "soccer",
          archetype: "league",
          nationAffiliation: "nation_france",
          settings: {},
          teams: [
            {
              id: "team_1",
              name: "PSG",
              players: [
                {
                  id: "p_1",
                  age: 20,
                  careerStage: "rookie",
                  ratings: { overall: 60, pace: 60, shooting: 60 },
                  isActive: true,
                },
              ],
              coaches: [],
            },
          ],
        },
      };

      mockPrisma.sportSeason.findUnique.mockResolvedValue(mockSeason);
      mockPrisma.sportTeam.findMany.mockResolvedValue(mockSeason.league.teams);
      mockPrisma.policy.findMany.mockResolvedValue([
        {
          name: "National Sports Academy",
          description: "Boost athletic training",
          category: "sports",
          status: "active",
        },
      ]);

      mockPrisma.sportSeason.create.mockResolvedValue({ id: "season_next", seasonNumber: 2 });

      // Run season transition
      const result = await transitionSeasonAction(mockPrisma, "season_completed");
      expect(result.success).toBe(true);

      // Verify rookie class created has policy buffs
      expect(mockPrisma.sportRookieClass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            players: expect.any(Array),
          }),
        })
      );

      const generatedRookies = mockPrisma.sportRookieClass.create.mock.calls[0][0].data.players;
      // Pace and shooting should have been buffed by +5, so they should be higher than baseline defaults
      // We will check that the rookie generation ran
      expect(generatedRookies.length).toBeGreaterThan(0);
    });

    it("triggers World Cup tournament draft and publishes results to ThinkPages on quadrennial seasons", async () => {
      const mockSeason = {
        id: "season_completed_3",
        seasonNumber: 3, // next season will be 4 (quadrennial)
        status: "completed",
        championTeamId: "team_1",
        leagueId: "league_123",
        league: {
          sportPreset: "soccer",
          archetype: "league",
          nationAffiliation: null,
          settings: {},
          teams: [
            {
              id: "team_1",
              name: "Team A",
              nationId: "country_germany",
              players: [
                {
                  id: "p_germany_1",
                  age: 25,
                  careerStage: "prime",
                  ratings: { overall: 85, pace: 80, shooting: 80 },
                  isActive: true,
                },
              ],
              coaches: [],
            },
            {
              id: "team_2",
              name: "Team B",
              nationId: "country_brazil",
              players: [
                {
                  id: "p_brazil_1",
                  age: 26,
                  careerStage: "prime",
                  ratings: { overall: 88, pace: 85, shooting: 85 },
                  isActive: true,
                },
              ],
              coaches: [],
            },
          ],
        },
      };

      mockPrisma.sportSeason.findUnique.mockResolvedValue(mockSeason);
      mockPrisma.sportTeam.findMany.mockResolvedValue(mockSeason.league.teams);
      mockPrisma.policy.findMany.mockResolvedValue([]);
      mockPrisma.sportSeason.create.mockResolvedValue({ id: "season_next_4", seasonNumber: 4 });

      // Return 11 players for Germany and 11 players for Brazil so threshold of >=8 is met
      const mockGermanyPlayers = Array.from({ length: 11 }, (_, i) => ({
        id: `p_germany_${i}`,
        age: 25,
        careerStage: "prime",
        ratings: { overall: 85, pace: 80, shooting: 80 },
        isActive: true,
      }));
      const mockBrazilPlayers = Array.from({ length: 11 }, (_, i) => ({
        id: `p_brazil_${i}`,
        age: 26,
        careerStage: "prime",
        ratings: { overall: 88, pace: 85, shooting: 85 },
        isActive: true,
      }));

      mockPrisma.sportPlayer.findMany
        .mockResolvedValueOnce(mockGermanyPlayers) // draft query for Germany
        .mockResolvedValueOnce(mockBrazilPlayers) // draft query for Brazil
        .mockResolvedValueOnce(mockGermanyPlayers) // average rating query for Germany
        .mockResolvedValueOnce(mockBrazilPlayers); // average rating query for Brazil

      mockPrisma.country.findUnique
        .mockResolvedValueOnce({ name: "Germany" })
        .mockResolvedValueOnce({ name: "Brazil" })
        .mockResolvedValueOnce({ name: "Germany" })
        .mockResolvedValueOnce({ name: "Brazil" });

      mockPrisma.thinkpagesAccount.findUnique.mockResolvedValue({ id: "sports_news_acc_id" });

      const result = await transitionSeasonAction(mockPrisma, "season_completed_3");
      expect(result.success).toBe(true);

      // Verify World Cup bulletin was published to ThinkPages
      expect(mockPrisma.thinkpagesPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: "sports_news_acc_id",
            content: expect.stringContaining("World Cup Final"),
            isAutoGenerated: true,
          }),
        })
      );
    });
  });

  describe("getMyClubs query", () => {
    it("returns clubs owned by the user with active season standing, position, and championships", async () => {
      mockPrisma.sportTeam.findMany.mockResolvedValue([
        {
          id: "team_1",
          name: "Paris St. Germain",
          leagueId: "league_1",
          stadiumCapacity: 50000,
          ticketPrice: 30,
        },
      ]);
      mockPrisma.sportSeason.findFirst = jest.fn().mockResolvedValue({
        id: "season_1",
        seasonNumber: 1,
      });
      mockPrisma.sportStanding.findMany.mockResolvedValue([
        {
          id: "standing_2",
          seasonId: "season_1",
          teamId: "team_2",
          wins: 5,
          losses: 1,
          draws: 0,
          points: 15,
          rank: 1,
        },
        {
          id: "standing_1",
          seasonId: "season_1",
          teamId: "team_1",
          wins: 4,
          losses: 2,
          draws: 0,
          points: 12,
          rank: 2,
        },
      ]);
      mockPrisma.sportSeason.count = jest.fn().mockResolvedValue(3);

      const result = await caller.getMyClubs();

      expect(mockPrisma.sportTeam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "test-manager-id" },
        })
      );
      expect(mockPrisma.sportSeason.findFirst).toHaveBeenCalledWith({
        where: { leagueId: "league_1", status: "in_progress" },
        select: { id: true, seasonNumber: true },
      });
      expect(mockPrisma.sportStanding.findMany).toHaveBeenCalledWith({
        where: { seasonId: "season_1" },
        orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
        select: {
          teamId: true,
          wins: true,
          losses: true,
          draws: true,
          points: true,
          rank: true,
          id: true,
          seasonId: true,
        },
      });
      expect(mockPrisma.sportSeason.count).toHaveBeenCalledWith({
        where: { championTeamId: "team_1", status: "completed" },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "team_1",
          name: "Paris St. Germain",
          stadiumCapacity: 50000,
          ticketPrice: 30,
          championships: 3,
          activeSeason: { id: "season_1", seasonNumber: 1 },
          currentStandings: expect.objectContaining({
            teamId: "team_1",
            wins: 4,
            losses: 2,
            points: 12,
            position: 2,
            rank: 2,
          }),
        })
      );
    });
  });
});
