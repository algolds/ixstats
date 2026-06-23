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
  cosmetic_emerald_glow: {
    id: "cosmetic_emerald_glow",
    name: "Emerald Profile Glow",
    description: "Surround your avatar with a vibrant glowing emerald energy aura.",
    category: "cosmetics",
    effects: {
      customizations: {
        avatarGlow: {
          enabled: true,
          color: "rgba(16,185,129,0.65)",
          intensity: "15px",
          style: "emerald",
        },
      },
    },
  },
  cosmetic_ruby_frame: {
    id: "cosmetic_ruby_frame",
    name: "Ruby Cyber Frame",
    description: "Equip a crimson-laser pulsing neon border around your card grids.",
    category: "cosmetics",
    effects: {
      customizations: {
        neonFrame: {
          enabled: true,
          color: "#ef4444",
          style: "ruby",
        },
      },
    },
  },
  cosmetic_diamond_badge: {
    id: "cosmetic_diamond_badge",
    name: "Diamond Shield Badge",
    description: "Showcase a shining cyan diamond shield badge next to your user name.",
    category: "cosmetics",
    effects: {
      customizations: {
        chatBadge: {
          enabled: true,
          icon: "Shield",
          color: "#06b6d4",
        },
      },
    },
  },
  cosmetic_summer_glow: {
    id: "cosmetic_summer_glow",
    name: "Summer Heat Glow",
    description: "Radiate warm orange solar rays surrounding your profile and avatar.",
    category: "cosmetics",
    effects: {
      customizations: {
        avatarGlow: {
          enabled: true,
          color: "rgba(249,115,22,0.65)",
          intensity: "15px",
          style: "summer",
        },
      },
    },
  },
  cosmetic_winter_frame: {
    id: "cosmetic_winter_frame",
    name: "Winter Frost Frame",
    description: "Chill your card borders with a frost-pulsing ice blue cybernetic frame.",
    category: "cosmetics",
    effects: {
      customizations: {
        neonFrame: {
          enabled: true,
          color: "#38bdf8",
          style: "winter",
        },
      },
    },
  },
  cosmetic_autumn_badge: {
    id: "cosmetic_autumn_badge",
    name: "Autumn Leaves Badge",
    description: "Mark your presence with a warm amber maple leaf badge icon in user catalogs.",
    category: "cosmetics",
    effects: {
      customizations: {
        chatBadge: {
          enabled: true,
          icon: "Leaf",
          color: "#d97706",
        },
      },
    },
  },
  cosmetic_diplomatic_badge: {
    id: "cosmetic_diplomatic_badge",
    name: "Diplomatic Shield Badge",
    description: "Display a formal diplomat shield emblem alongside your chat nickname.",
    category: "cosmetics",
    effects: {
      customizations: {
        chatBadge: {
          enabled: true,
          icon: "Heart",
          color: "#10b981",
        },
      },
    },
  },
};

export function getCosmeticEffects(id: string): ActiveCosmeticEffects | null {
  const item = COSMETICS_CATALOG[id];
  return item?.effects.customizations || null;
}
