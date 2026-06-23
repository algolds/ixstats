/**
 * Tests for MyVault Service enhancements
 */

import { VaultService } from "../vault-service";

describe("VaultService - Upgrades & Perks", () => {
  let vaultService: VaultService;
  let mockDb: any;

  beforeEach(() => {
    vaultService = new VaultService();
    mockDb = {
      vaultTransaction: {
        findMany: jest.fn(),
      },
      vaultStoreItem: {
        findMany: jest.fn(),
      },
      myVault: {
        findUnique: jest.fn(),
      },
    };
  });

  describe("getCardCapacityBoost", () => {
    it("should calculate total boost from owned items effects", async () => {
      // Mock transactions to get item IDs
      mockDb.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "item_cap_50" } },
        { metadata: { itemId: "item_cap_100" } },
        { metadata: { other: "junk" } },
      ]);

      // Mock store items
      mockDb.vaultStoreItem.findMany.mockResolvedValue([
        {
          id: "item_cap_50",
          effects: {
            perks: {
              cardCapacity: 50,
            },
          },
        },
        {
          id: "item_cap_100",
          effects: {
            perks: {
              cardCapacity: 100,
            },
          },
        },
      ]);

      const boost = await vaultService.getCardCapacityBoost("user_123", mockDb);
      expect(boost).toBe(150);
      expect(mockDb.vaultTransaction.findMany).toHaveBeenCalledWith({
        where: {
          vault: { userId: "user_123" },
          type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
        },
        select: {
          metadata: true,
        },
      });
      expect(mockDb.vaultStoreItem.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["item_cap_50", "item_cap_100"] },
          isActive: true,
        },
        select: {
          id: true,
          effects: true,
        },
      });
    });

    it("should return 0 if no store items match or are active", async () => {
      mockDb.vaultTransaction.findMany.mockResolvedValue([]);
      const boost = await vaultService.getCardCapacityBoost("user_123", mockDb);
      expect(boost).toBe(0);
    });

    it("should handle stringified JSON metadata", async () => {
      mockDb.vaultTransaction.findMany.mockResolvedValue([
        { metadata: '{"itemId":"item_cap_50"}' },
        { metadata: '{"itemId":"item_cap_100"}' },
      ]);

      mockDb.vaultStoreItem.findMany.mockResolvedValue([
        {
          id: "item_cap_50",
          effects: {
            perks: {
              cardCapacity: 50,
            },
          },
        },
        {
          id: "item_cap_100",
          effects: {
            perks: {
              cardCapacity: 100,
            },
          },
        },
      ]);

      const boost = await vaultService.getCardCapacityBoost("user_123", mockDb);
      expect(boost).toBe(150);
    });

    it("should stack multiple purchases of the same item", async () => {
      mockDb.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "upgrade_card_capacity" } },
        { metadata: { itemId: "upgrade_card_capacity" } },
        { metadata: { itemId: "upgrade_card_capacity" } },
        { metadata: { itemId: "upgrade_card_capacity_mega" } },
      ]);

      mockDb.vaultStoreItem.findMany.mockResolvedValue([
        {
          id: "upgrade_card_capacity",
          effects: {
            perks: {
              cardCapacity: 50,
            },
          },
        },
        {
          id: "upgrade_card_capacity_mega",
          effects: {
            perks: {
              cardCapacity: 150,
            },
          },
        },
      ]);

      const boost = await vaultService.getCardCapacityBoost("user_123", mockDb);
      expect(boost).toBe(300); // 3 * 50 + 150
    });
  });

  describe("getYieldBoostMultiplier", () => {
    it("should sum up yield boost percentages", async () => {
      mockDb.vaultTransaction.findMany.mockResolvedValue([
        { metadata: { itemId: "item_yield_5" } },
        { metadata: { itemId: "item_yield_10" } },
      ]);

      mockDb.vaultStoreItem.findMany.mockResolvedValue([
        {
          id: "item_yield_5",
          effects: {
            perks: {
              yieldBoost: 0.05,
            },
          },
        },
        {
          id: "item_yield_10",
          effects: {
            perks: {
              yieldBoost: 0.1,
            },
          },
        },
      ]);

      const multiplier = await vaultService.getYieldBoostMultiplier("user_123", mockDb);
      expect(multiplier).toBeCloseTo(0.15);
    });
  });

  describe("getLoreTokensBalance", () => {
    it("should calculate balance correctly based on granted tokens and transaction history", async () => {
      // Mock store items granting 3 tokens in total
      mockDb.vaultTransaction.findMany.mockImplementation(async (args: any) => {
        // First call is for purchased store items in getPurchasedItemsEffects
        if (args.where?.type) {
          return [
            { metadata: { itemId: "item_token_2" } },
            { metadata: { itemId: "item_token_1" } },
          ];
        }
        // Second call is for LORE_CARD_REQUEST transactions inside getLoreTokensBalance
        return [
          { metadata: { useToken: true } },
          { metadata: { useToken: false } },
          { metadata: null },
        ];
      });

      mockDb.vaultStoreItem.findMany.mockResolvedValue([
        {
          id: "item_token_2",
          effects: {
            perks: {
              loreTokens: 2,
            },
          },
        },
        {
          id: "item_token_1",
          effects: {
            perks: {
              loreTokens: 1,
            },
          },
        },
      ]);

      mockDb.myVault.findUnique.mockResolvedValue({ id: "vault_abc" });

      const balance = await vaultService.getLoreTokensBalance("user_123", mockDb);
      expect(balance).toBe(2); // 3 total - 1 used = 2 remaining
    });

    it("should return 0 if user has no vault", async () => {
      mockDb.vaultTransaction.findMany.mockResolvedValue([]);
      mockDb.myVault.findUnique.mockResolvedValue(null);

      const balance = await vaultService.getLoreTokensBalance("user_123", mockDb);
      expect(balance).toBe(0);
    });
  });
});
