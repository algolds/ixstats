import { type PrismaClient } from "@prisma/client";
import { Cache } from "~/lib/cache";

export interface VaultEffectPerks {
  cardCapacity?: number;
  yieldBoost?: number;
  loreTokens?: number;
  [key: string]: unknown;
}

export interface VaultEffectItem {
  perks?: VaultEffectPerks;
  [key: string]: unknown;
}

export interface VaultConfig {
  activeDailyCap: number;
  socialDailyCap: number;
  xpPerLevel: number;
  maxStreakBonus: number;
  premiumMultiplier: number;
  priceGoldenProfileGlow: number;
  priceNeonCyberFrame: number;
  priceEliteChatBadge: number;
  priceLoreRequestToken: number;
  priceCardCapacity: number;
  pricePassiveYieldBoost: number;
  isEarningEnabled: boolean;
  isTradingEnabled: boolean;
  isAuctionsEnabled: boolean;
  isStoreEnabled: boolean;
  isCraftingEnabled: boolean;
  isPacksEnabled: boolean;
  isMaintenanceMode: boolean;
  exemptStaffFromLimit: boolean;
}

export const VAULT_CONFIG_DEFAULTS: VaultConfig = {
  activeDailyCap: 100,
  socialDailyCap: 50,
  xpPerLevel: 1000,
  maxStreakBonus: 7,
  premiumMultiplier: 1.0,
  priceGoldenProfileGlow: 500,
  priceNeonCyberFrame: 750,
  priceEliteChatBadge: 1000,
  priceLoreRequestToken: 2500,
  priceCardCapacity: 5000,
  pricePassiveYieldBoost: 5000,
  isEarningEnabled: true,
  isTradingEnabled: true,
  isAuctionsEnabled: true,
  isStoreEnabled: true,
  isCraftingEnabled: true,
  isPacksEnabled: true,
  isMaintenanceMode: false,
  exemptStaffFromLimit: true,
};

export const VAULT_CONFIG_KEYS: Record<keyof VaultConfig, string> = {
  activeDailyCap: "vault_activeDailyCap",
  socialDailyCap: "vault_socialDailyCap",
  xpPerLevel: "vault_xpPerLevel",
  maxStreakBonus: "vault_maxStreakBonus",
  premiumMultiplier: "vault_premiumMultiplier",
  priceGoldenProfileGlow: "vault_priceGoldenProfileGlow",
  priceNeonCyberFrame: "vault_priceNeonCyberFrame",
  priceEliteChatBadge: "vault_priceEliteChatBadge",
  priceLoreRequestToken: "vault_priceLoreRequestToken",
  priceCardCapacity: "vault_priceCardCapacity",
  pricePassiveYieldBoost: "vault_pricePassiveYieldBoost",
  isEarningEnabled: "vault_isEarningEnabled",
  isTradingEnabled: "vault_isTradingEnabled",
  isAuctionsEnabled: "vault_isAuctionsEnabled",
  isStoreEnabled: "vault_isStoreEnabled",
  isCraftingEnabled: "vault_isCraftingEnabled",
  isPacksEnabled: "vault_isPacksEnabled",
  isMaintenanceMode: "vault_isMaintenanceMode",
  exemptStaffFromLimit: "vault_exemptStaffFromLimit",
};

export const vaultConfigCache = new Cache<VaultConfig>({
  defaultTtlMs: 60_000,
  maxSize: 10,
});

export const userPerksCache = new Cache<VaultEffectItem[]>({
  defaultTtlMs: 300_000,
  maxSize: 500,
});

export const VAULT_CONFIG_CACHE_KEY = "vault_config";

export function invalidateVaultConfigCache(): void {
  vaultConfigCache.delete(VAULT_CONFIG_CACHE_KEY);
}

export function clearUserPerksCache(userId?: string): void {
  if (userId) {
    userPerksCache.delete(`user_perks:${userId}`);
  } else {
    userPerksCache.clear();
  }
}

export async function getVaultConfig(db: {
  systemConfig: {
    findMany: (args: {
      where: { key: { in: string[] } };
    }) => Promise<Array<{ key: string; value: string }>>;
  };
}): Promise<VaultConfig> {
  const cached = vaultConfigCache.get(VAULT_CONFIG_CACHE_KEY);
  if (cached !== undefined) return cached;

  try {
    const configs = await db.systemConfig.findMany({
      where: { key: { in: Object.values(VAULT_CONFIG_KEYS) } },
    });

    const m = configs.reduce(
      (acc, c) => {
        acc[c.key] = c.value;
        return acc;
      },
      {} as Record<string, string>
    );

    const config: VaultConfig = {
      activeDailyCap: parseFloat(
        m.vault_activeDailyCap ?? String(VAULT_CONFIG_DEFAULTS.activeDailyCap)
      ),
      socialDailyCap: parseFloat(
        m.vault_socialDailyCap ?? String(VAULT_CONFIG_DEFAULTS.socialDailyCap)
      ),
      xpPerLevel: parseFloat(m.vault_xpPerLevel ?? String(VAULT_CONFIG_DEFAULTS.xpPerLevel)),
      maxStreakBonus: parseFloat(
        m.vault_maxStreakBonus ?? String(VAULT_CONFIG_DEFAULTS.maxStreakBonus)
      ),
      premiumMultiplier: parseFloat(
        m.vault_premiumMultiplier ?? String(VAULT_CONFIG_DEFAULTS.premiumMultiplier)
      ),
      priceGoldenProfileGlow: parseFloat(
        m.vault_priceGoldenProfileGlow ?? String(VAULT_CONFIG_DEFAULTS.priceGoldenProfileGlow)
      ),
      priceNeonCyberFrame: parseFloat(
        m.vault_priceNeonCyberFrame ?? String(VAULT_CONFIG_DEFAULTS.priceNeonCyberFrame)
      ),
      priceEliteChatBadge: parseFloat(
        m.vault_priceEliteChatBadge ?? String(VAULT_CONFIG_DEFAULTS.priceEliteChatBadge)
      ),
      priceLoreRequestToken: parseFloat(
        m.vault_priceLoreRequestToken ?? String(VAULT_CONFIG_DEFAULTS.priceLoreRequestToken)
      ),
      priceCardCapacity: parseFloat(
        m.vault_priceCardCapacity ?? String(VAULT_CONFIG_DEFAULTS.priceCardCapacity)
      ),
      pricePassiveYieldBoost: parseFloat(
        m.vault_pricePassiveYieldBoost ?? String(VAULT_CONFIG_DEFAULTS.pricePassiveYieldBoost)
      ),
      isEarningEnabled:
        m.vault_isEarningEnabled !== undefined
          ? m.vault_isEarningEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isEarningEnabled,
      isTradingEnabled:
        m.vault_isTradingEnabled !== undefined
          ? m.vault_isTradingEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isTradingEnabled,
      isAuctionsEnabled:
        m.vault_isAuctionsEnabled !== undefined
          ? m.vault_isAuctionsEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isAuctionsEnabled,
      isStoreEnabled:
        m.vault_isStoreEnabled !== undefined
          ? m.vault_isStoreEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isStoreEnabled,
      isCraftingEnabled:
        m.vault_isCraftingEnabled !== undefined
          ? m.vault_isCraftingEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isCraftingEnabled,
      isPacksEnabled:
        m.vault_isPacksEnabled !== undefined
          ? m.vault_isPacksEnabled === "true"
          : VAULT_CONFIG_DEFAULTS.isPacksEnabled,
      isMaintenanceMode:
        m.vault_isMaintenanceMode !== undefined
          ? m.vault_isMaintenanceMode === "true"
          : VAULT_CONFIG_DEFAULTS.isMaintenanceMode,
      exemptStaffFromLimit:
        m.vault_exemptStaffFromLimit !== undefined
          ? m.vault_exemptStaffFromLimit === "true"
          : VAULT_CONFIG_DEFAULTS.exemptStaffFromLimit,
    };

    vaultConfigCache.set(VAULT_CONFIG_CACHE_KEY, config);
    return config;
  } catch (error) {
    console.warn("[Vault Config] Failed to read from DB, using defaults:", error);
    return { ...VAULT_CONFIG_DEFAULTS };
  }
}

/**
 * Helper to fetch active effects from purchased store items
 */
export async function getPurchasedItemsEffects(userId: string, db: PrismaClient): Promise<VaultEffectItem[]> {
  const cacheKey = `user_perks:${userId}`;
  const cached = userPerksCache.get(cacheKey);
  if (cached) return cached;

  try {
    const transactions = await db.vaultTransaction.findMany({
      where: {
        vault: { userId },
        type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] },
      },
      select: {
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const purchasedItemCounts: Record<string, number> = {};
    for (const tx of transactions) {
      let meta = tx.metadata;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch {}
      }
      if (meta && typeof meta === "object") {
        const metaObj = meta as Record<string, unknown>;
        if (metaObj.itemId && typeof metaObj.itemId === "string") {
          purchasedItemCounts[metaObj.itemId] = (purchasedItemCounts[metaObj.itemId] || 0) + 1;
        }
      }
    }

    const uniqueIds = Object.keys(purchasedItemCounts);
    if (uniqueIds.length === 0) {
      userPerksCache.set(cacheKey, []);
      return [];
    }

    const storeItems = await db.vaultStoreItem.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
      },
      select: {
        id: true,
        effects: true,
      },
    });

    const effectsList: VaultEffectItem[] = [];
    for (const item of storeItems) {
      const effects = item.effects;
      if (effects && typeof effects === "object") {
        const count = purchasedItemCounts[item.id] || 0;
        for (let i = 0; i < count; i++) {
          effectsList.push(effects as VaultEffectItem);
        }
      }
    }

    userPerksCache.set(cacheKey, effectsList);
    return effectsList;
  } catch (error) {
    console.error("[Vault Service] Error getting purchased items effects:", error);
    return [];
  }
}

/**
 * Calculate total card capacity boost from store upgrades
 */
export async function getCardCapacityBoost(userId: string, db: PrismaClient): Promise<number> {
  const effects = await getPurchasedItemsEffects(userId, db);
  let totalBoost = 0;
  for (const eff of effects) {
    const perks = eff.perks;
    if (perks && typeof perks.cardCapacity === "number") {
      totalBoost += perks.cardCapacity;
    }
  }
  return totalBoost;
}

/**
 * Calculate passive yield boost multiplier from store upgrades
 */
export async function getYieldBoostMultiplier(userId: string, db: PrismaClient): Promise<number> {
  const effects = await getPurchasedItemsEffects(userId, db);
  let totalBoost = 0;
  for (const eff of effects) {
    const perks = eff.perks;
    if (perks && typeof perks.yieldBoost === "number") {
      totalBoost += perks.yieldBoost;
    }
  }
  return totalBoost;
}

/**
 * Calculate current lore request tokens balance
 */
export async function getLoreTokensBalance(userId: string, db: PrismaClient): Promise<number> {
  const effects = await getPurchasedItemsEffects(userId, db);
  let totalGranted = 0;
  for (const eff of effects) {
    const perks = eff.perks;
    if (perks && typeof perks.loreTokens === "number") {
      totalGranted += perks.loreTokens;
    }
  }

  const vault = await db.myVault.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!vault) return 0;

  const transactions = await db.vaultTransaction.findMany({
    where: {
      vaultId: vault.id,
      source: "LORE_CARD_REQUEST",
    },
    select: {
      metadata: true,
    },
  });

  let usedTokenCount = 0;
  for (const tx of transactions) {
    let meta = tx.metadata;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {}
    }
    if (meta && typeof meta === "object") {
      const metaObj = meta as Record<string, unknown>;
      if (metaObj.useToken === true) {
        usedTokenCount++;
      }
    }
  }

  return Math.max(0, totalGranted - usedTokenCount);
}
