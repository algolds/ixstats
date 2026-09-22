import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsTransfersRouter } from "~/server/api/routers/sports/transfers";
import { exchangeService } from "~/lib/vault/exchange-service";

type MockFn = any;

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)) as MockFn,
  sportPlayer: {
    findUnique: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
  sportTeam: {
    findUnique: jest.fn() as MockFn,
  },
  sportTransferListing: {
    findUnique: jest.fn() as MockFn,
    upsert: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
  },
  sportTransferBid: {
    findUnique: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    create: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
};

const baseContext = {
  db: mockPrisma,
  user: { id: "user_owner_1", clerkUserId: "clerk_owner_1" },
  auth: { userId: "user_owner_1" },
} as any;

describe("Sports Transfers & Escrow Tests", () => {
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(exchangeService, "spend").mockResolvedValue({ success: true, newBalance: 5000 });
    jest.spyOn(exchangeService, "earn").mockResolvedValue({ success: true, newBalance: 10000 });

    caller = createCallerFactory(sportsTransfersRouter)(baseContext);
  });

  describe("listPlayerForTransfer", () => {
    it("successfully creates a transfer listing when owner owns the player", async () => {
      mockPrisma.sportPlayer.findUnique.mockResolvedValue({
        id: "p1",
        teamId: "team_1",
        team: { id: "team_1", ownerUserId: "user_owner_1" },
      });
      mockPrisma.sportTransferListing.upsert.mockResolvedValue({
        id: "list_1",
        playerId: "p1",
        teamId: "team_1",
        price: 1500,
        status: "open",
      });

      const result = await caller.listPlayerForTransfer({
        playerId: "p1",
        price: 1500,
      });

      expect(result.status).toBe("open");
      expect(result.price).toBe(1500);
      expect(mockPrisma.sportTransferListing.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: "p1" },
          create: expect.objectContaining({ price: 1500, playerId: "p1" }),
        })
      );
    });

    it("rejects listing if user is not the team owner", async () => {
      mockPrisma.sportPlayer.findUnique.mockResolvedValue({
        id: "p1",
        teamId: "team_1",
        team: { id: "team_1", ownerUserId: "other_user" },
      });

      await expect(
        caller.listPlayerForTransfer({
          playerId: "p1",
          price: 1500,
        })
      ).rejects.toThrow("You do not own this player");
    });
  });

  describe("placeTransferBid with escrow lock", () => {
    it("locks sovereigns in escrow and creates pending bid", async () => {
      mockPrisma.sportTransferListing.findUnique.mockResolvedValue({
        id: "list_1",
        status: "open",
        price: 1500,
      });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_buyer",
        ownerUserId: "user_owner_1",
      });
      mockPrisma.sportTransferBid.create.mockResolvedValue({
        id: "bid_1",
        listingId: "list_1",
        bidderTeamId: "team_buyer",
        bidderUserId: "user_owner_1",
        amount: 2000,
        status: "pending",
      });

      const res = await caller.placeTransferBid({
        listingId: "list_1",
        amount: 2000,
        bidderTeamId: "team_buyer",
      });

      expect(exchangeService.spend).toHaveBeenCalledWith(
        "user_owner_1",
        2000,
        "SHARE_BUY",
        "TRANSFER_BID_ESCROW:list_1",
        mockPrisma
      );
      expect(res.status).toBe("pending");
      expect(res.amount).toBe(2000);
    });

    it("fails when user has insufficient Sovereign funds", async () => {
      mockPrisma.sportTransferListing.findUnique.mockResolvedValue({
        id: "list_1",
        status: "open",
      });
      mockPrisma.sportTeam.findUnique.mockResolvedValue({
        id: "team_buyer",
        ownerUserId: "user_owner_1",
      });
      jest.spyOn(exchangeService, "spend").mockResolvedValue({
        success: false,
        newBalance: 100,
        message: "Insufficient Sovereigns",
      });

      await expect(
        caller.placeTransferBid({
          listingId: "list_1",
          amount: 5000,
          bidderTeamId: "team_buyer",
        })
      ).rejects.toThrow("Insufficient Sovereigns");
    });
  });

  describe("respondToTransferBid (accept & reject)", () => {
    it("accepts bid, transfers player, pays seller, and refunds outbid suitors", async () => {
      mockPrisma.sportTransferBid.findUnique.mockResolvedValue({
        id: "bid_winning",
        listingId: "list_1",
        bidderTeamId: "team_buyer",
        bidderUserId: "buyer_user",
        amount: 3000,
        status: "pending",
        listing: {
          id: "list_1",
          playerId: "player_star",
          player: {
            id: "player_star",
            team: {
              id: "team_seller",
              ownerUserId: "user_owner_1",
            },
          },
        },
      });

      mockPrisma.sportTransferBid.findMany.mockResolvedValue([
        {
          id: "bid_losing_1",
          bidderUserId: "unlucky_user_1",
          amount: 2500,
        },
        {
          id: "bid_losing_2",
          bidderUserId: "unlucky_user_2",
          amount: 2800,
        },
      ]);

      const res = await caller.respondToTransferBid({
        bidId: "bid_winning",
        action: "accept",
      });

      expect(res.success).toBe(true);

      // Seller paid
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "user_owner_1",
        3000,
        "SHARE_SELL",
        "TRANSFER_ACCEPT:bid_winning",
        mockPrisma
      );

      // Player transferred
      expect(mockPrisma.sportPlayer.update).toHaveBeenCalledWith({
        where: { id: "player_star" },
        data: { teamId: "team_buyer" },
      });

      // Listing closed
      expect(mockPrisma.sportTransferListing.update).toHaveBeenCalledWith({
        where: { id: "list_1" },
        data: { status: "completed" },
      });

      // Outbid bidders refunded
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "unlucky_user_1",
        2500,
        "ADMIN_ADJUSTMENT",
        "TRANSFER_BID_REFUND:bid_losing_1",
        mockPrisma
      );
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "unlucky_user_2",
        2800,
        "ADMIN_ADJUSTMENT",
        "TRANSFER_BID_REFUND:bid_losing_2",
        mockPrisma
      );
    });

    it("rejects bid and immediately refunds bidder escrow", async () => {
      mockPrisma.sportTransferBid.findUnique.mockResolvedValue({
        id: "bid_low",
        listingId: "list_1",
        bidderUserId: "buyer_user",
        amount: 1000,
        status: "pending",
        listing: {
          id: "list_1",
          player: {
            team: {
              ownerUserId: "user_owner_1",
            },
          },
        },
      });

      const res = await caller.respondToTransferBid({
        bidId: "bid_low",
        action: "reject",
      });

      expect(res.success).toBe(true);
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "buyer_user",
        1000,
        "ADMIN_ADJUSTMENT",
        "TRANSFER_BID_REFUND:bid_low",
        mockPrisma
      );
      expect(mockPrisma.sportTransferBid.update).toHaveBeenCalledWith({
        where: { id: "bid_low" },
        data: { status: "rejected" },
      });
    });
  });

  describe("withdrawTransferBid", () => {
    it("allows bidder to withdraw active bid and refunds escrow", async () => {
      mockPrisma.sportTransferBid.findUnique.mockResolvedValue({
        id: "bid_own",
        bidderUserId: "user_owner_1",
        amount: 2200,
        status: "pending",
      });

      const res = await caller.withdrawTransferBid({ bidId: "bid_own" });

      expect(res.success).toBe(true);
      expect(exchangeService.earn).toHaveBeenCalledWith(
        "user_owner_1",
        2200,
        "ADMIN_ADJUSTMENT",
        "TRANSFER_BID_REFUND:bid_own",
        mockPrisma
      );
      expect(mockPrisma.sportTransferBid.update).toHaveBeenCalledWith({
        where: { id: "bid_own" },
        data: { status: "withdrawn" },
      });
    });
  });

  describe("cancelTransferListing", () => {
    it("cancels listing and refunds all pending bids", async () => {
      mockPrisma.sportTransferListing.findUnique.mockResolvedValue({
        id: "list_1",
        status: "open",
        player: {
          team: {
            ownerUserId: "user_owner_1",
          },
        },
      });
      mockPrisma.sportTransferBid.findMany.mockResolvedValue([
        { id: "b1", bidderUserId: "u1", amount: 1500 },
        { id: "b2", bidderUserId: "u2", amount: 1800 },
      ]);

      const res = await caller.cancelTransferListing({ listingId: "list_1" });

      expect(res.success).toBe(true);
      expect(res.refunded).toBe(2);
      expect(exchangeService.earn).toHaveBeenCalledTimes(2);
      expect(mockPrisma.sportTransferListing.update).toHaveBeenCalledWith({
        where: { id: "list_1" },
        data: { status: "cancelled" },
      });
    });
  });
});
