export interface ActiveCosmeticEffects {
  avatarGlow?: {
    enabled: boolean;
    color: string;
    intensity: string;
  };
  chatBadge?: {
    enabled: boolean;
    icon: string;
    color: string;
  };
  neonFrame?: {
    enabled: boolean;
    color: string;
    style: string;
  };
}

export interface CosmeticCatalogItem {
  id: string;
  name: string;
  description: string;
  category: "cosmetics" | "upgrades";
  effects: {
    customizations?: ActiveCosmeticEffects;
  };
}

export const COSMETICS_CATALOG: Record<string, CosmeticCatalogItem> = {
  cosmetic_gold_glow: {
    id: "cosmetic_gold_glow",
    name: "Golden Profile Glow",
    description: "Adds a premium golden aura surrounding your user badges and avatar.",
    category: "cosmetics",
    effects: {
      customizations: {
        avatarGlow: {
          enabled: true,
          color: "rgba(245,158,11,0.65)",
          intensity: "15px",
        },
      },
    },
  },
  cosmetic_neon_frame: {
    id: "cosmetic_neon_frame",
    name: "Neon Cyber Frame",
    description: "Wraps your card profiles with a neon-glowing futuristic cybernetic border.",
    category: "cosmetics",
    effects: {
      customizations: {
        neonFrame: {
          enabled: true,
          color: "#22d3ee",
          style: "pulse",
        },
      },
    },
  },
  cosmetic_chat_badge: {
    id: "cosmetic_chat_badge",
    name: "Elite Chat Badge",
    description: "Displays a premium golden crown symbol next to your name in community grids.",
    category: "cosmetics",
    effects: {
      customizations: {
        chatBadge: {
          enabled: true,
          icon: "Crown",
          color: "#f59e0b",
        },
      },
    },
  },
};

export function getCosmeticEffects(id: string): ActiveCosmeticEffects | null {
  const item = COSMETICS_CATALOG[id];
  return item?.effects.customizations || null;
}
