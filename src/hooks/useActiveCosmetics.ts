import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { getCosmeticEffects } from "~/lib/cosmetics";

export interface AvatarGlowConfig {
  enabled: boolean;
  color: string;
  intensity: string;
}

export interface ChatBadgeConfig {
  enabled: boolean;
  icon: string;
  color: string;
}

export interface NeonFrameConfig {
  enabled: boolean;
  color: string;
  style: string;
}

export interface ActiveCosmetics {
  avatarGlow: AvatarGlowConfig;
  chatBadge: ChatBadgeConfig;
  neonFrame: NeonFrameConfig;
  isLoading: boolean;
}

const DEFAULT_COSMETICS: ActiveCosmetics = {
  avatarGlow: { enabled: false, color: "", intensity: "" },
  chatBadge: { enabled: false, icon: "", color: "" },
  neonFrame: { enabled: false, color: "", style: "" },
  isLoading: true,
};

export function useActiveCosmetics(): ActiveCosmetics {
  // Query owned items
  const { data: ownedData, isLoading: ownedLoading } = api.vault.getPurchasedItems.useQuery(
    undefined,
    {
      staleTime: 30000,
    }
  );
  // Query store items definition (to get list of storefront items)
  const { data: storeItems, isLoading: itemsLoading } = api.vault.listStoreItems.useQuery(
    undefined,
    {
      staleTime: 60000,
    }
  );
  // Query server-equipped state
  const { data: equippedData, isLoading: equippedLoading } = api.vault.getEquippedCosmetics.useQuery(
    undefined,
    {
      staleTime: 15000,
    }
  );

  const [localActive, setLocalActive] = useState<{
    cosmetics: Record<string, boolean>;
    upgrades: Record<string, boolean>;
  }>({ cosmetics: {}, upgrades: {} });

  const [cosmeticsState, setCosmeticsState] = useState<ActiveCosmetics>(DEFAULT_COSMETICS);

  // Sync with localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadLocalPreferences = () => {
      try {
        const savedCosmetics = localStorage.getItem("settings:active-cosmetics");
        const savedUpgrades = localStorage.getItem("settings:active-upgrades");
        setLocalActive({
          cosmetics: savedCosmetics ? JSON.parse(savedCosmetics) : {},
          upgrades: savedUpgrades ? JSON.parse(savedUpgrades) : {},
        });
      } catch (e) {
        console.error("[useActiveCosmetics] Failed to load local storage preferences:", e);
      }
    };

    loadLocalPreferences();

    // Event listeners
    window.addEventListener("cosmetics-updated", loadLocalPreferences);
    window.addEventListener("upgrades-updated", loadLocalPreferences);

    return () => {
      window.removeEventListener("cosmetics-updated", loadLocalPreferences);
      window.removeEventListener("upgrades-updated", loadLocalPreferences);
    };
  }, []);

  // Compute final states whenever inputs change
  useEffect(() => {
    if (ownedLoading || itemsLoading || equippedLoading) {
      setCosmeticsState((prev) => ({ ...prev, isLoading: true }));
      return;
    }

    const ownedItemIds = ownedData?.purchasedItemIds || [];
    const items = storeItems || [];
    const serverEquipped = equippedData?.equipped || [];

    const computed: ActiveCosmetics = {
      avatarGlow: { enabled: false, color: "rgba(245,158,11,0.65)", intensity: "15px" },
      chatBadge: { enabled: false, icon: "Crown", color: "#f59e0b" },
      neonFrame: { enabled: false, color: "#22d3ee", style: "pulse" },
      isLoading: false,
    };

    for (const item of items) {
      if (!ownedItemIds.includes(item.id)) continue;

      // Check if item is enabled (server equipped takes priority, fallback to local storage)
      const isEnabled =
        item.category === "cosmetics"
          ? (serverEquipped.includes(item.id) || (localActive.cosmetics[item.id] ?? false))
          : (localActive.upgrades[item.id] ?? false);

      if (!isEnabled) continue;

      // Resolve customization effects from canonical catalog first, fallback to DB effects
      const catalogEffects = getCosmeticEffects(item.id);
      const dbEffects = item.effects as Record<string, any> | null;
      const custom = catalogEffects || dbEffects?.customizations;

      if (custom) {
        if (custom.avatarGlow?.enabled) {
          computed.avatarGlow = {
            enabled: true,
            color: custom.avatarGlow.color || computed.avatarGlow.color,
            intensity: custom.avatarGlow.intensity || computed.avatarGlow.intensity,
          };
        }
        if (custom.chatBadge?.enabled) {
          computed.chatBadge = {
            enabled: true,
            icon: custom.chatBadge.icon || computed.chatBadge.icon,
            color: custom.chatBadge.color || computed.chatBadge.color,
          };
        }
        if (custom.neonFrame?.enabled) {
          computed.neonFrame = {
            enabled: true,
            color: custom.neonFrame.color || computed.neonFrame.color,
            style: custom.neonFrame.style || computed.neonFrame.style,
          };
        }
      }
    }

    setCosmeticsState(computed);
  }, [ownedData, storeItems, equippedData, ownedLoading, itemsLoading, equippedLoading, localActive]);

  return cosmeticsState;
}
