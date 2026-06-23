import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { getCosmeticEffects } from "~/lib/cosmetics";
import { useUser } from "~/context/auth-context";

export interface AvatarGlowConfig {
  enabled: boolean;
  color: string;
  intensity: string;
  style?: string;
}

export interface ChatBadgeConfig {
  enabled: boolean;
  icon: string;
  color: string;
}

export interface NeonFrameConfig {
  enabled: boolean;
  color: string;
  style?: string;
}

export interface ActiveCosmetics {
  avatarGlow: AvatarGlowConfig;
  chatBadge: ChatBadgeConfig;
  neonFrame: NeonFrameConfig;
  isLoading: boolean;
}

const DEFAULT_COSMETICS: ActiveCosmetics = {
  avatarGlow: { enabled: false, color: "", intensity: "", style: "" },
  chatBadge: { enabled: false, icon: "", color: "" },
  neonFrame: { enabled: false, color: "", style: "" },
  isLoading: true,
};

export function useActiveCosmetics(): ActiveCosmetics {
  const { user: authUser, isSignedIn, isLoaded } = useUser();

  // Query current user role
  const { data: currentUserData, isLoading: userLoading } =
    api.users.getCurrentUserWithRole.useQuery(undefined, {
      enabled: isLoaded && isSignedIn && !!authUser,
      staleTime: 60000,
    });

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
  const { data: equippedData, isLoading: equippedLoading } =
    api.vault.getEquippedCosmetics.useQuery(undefined, {
      staleTime: 15000,
    });

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
    if (ownedLoading || itemsLoading || equippedLoading || (isSignedIn && userLoading)) {
      setCosmeticsState((prev) => ({ ...prev, isLoading: true }));
      return;
    }

    const ownedItemIds = ownedData?.purchasedItemIds || [];
    const items = storeItems || [];
    const serverEquipped = equippedData?.equipped || [];

    const userRoleLevel = currentUserData?.user?.role?.level;
    const isAdmin = userRoleLevel !== undefined && userRoleLevel <= 10;

    const computed: ActiveCosmetics = {
      avatarGlow: isAdmin
        ? { enabled: true, color: "rgba(234,179,8,0.8)", intensity: "20px", style: "imperial" }
        : { enabled: false, color: "rgba(245,158,11,0.65)", intensity: "15px" },
      chatBadge: { enabled: false, icon: "Crown", color: "#f59e0b" },
      neonFrame: { enabled: false, color: "#22d3ee", style: "pulse" },
      isLoading: false,
    };

    const previewCosmeticId =
      typeof window !== "undefined" ? localStorage.getItem("settings:preview-cosmetic") : null;

    for (const item of items) {
      const isPreview = item.id === previewCosmeticId;
      if (!ownedItemIds.includes(item.id) && !isPreview) continue;

      // Check if item is enabled (server equipped takes priority, fallback to local storage)
      const isEnabled =
        isPreview ||
        (item.category === "cosmetics"
          ? serverEquipped.includes(item.id) || (localActive.cosmetics[item.id] ?? false)
          : (localActive.upgrades[item.id] ?? false));

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
            style: custom.avatarGlow.style || computed.avatarGlow.style,
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

    // Prevent redundant state updates if the computed state is structurally identical
    setCosmeticsState((prev) => {
      const isGlowEqual =
        prev.avatarGlow.enabled === computed.avatarGlow.enabled &&
        prev.avatarGlow.color === computed.avatarGlow.color &&
        prev.avatarGlow.intensity === computed.avatarGlow.intensity &&
        prev.avatarGlow.style === computed.avatarGlow.style;

      const isBadgeEqual =
        prev.chatBadge.enabled === computed.chatBadge.enabled &&
        prev.chatBadge.icon === computed.chatBadge.icon &&
        prev.chatBadge.color === computed.chatBadge.color;

      const isFrameEqual =
        prev.neonFrame.enabled === computed.neonFrame.enabled &&
        prev.neonFrame.color === computed.neonFrame.color &&
        prev.neonFrame.style === computed.neonFrame.style;

      const isLoadingEqual = prev.isLoading === computed.isLoading;

      if (isGlowEqual && isBadgeEqual && isFrameEqual && isLoadingEqual) {
        return prev;
      }
      return computed;
    });
  }, [
    ownedData,
    storeItems,
    equippedData,
    ownedLoading,
    itemsLoading,
    equippedLoading,
    localActive,
    currentUserData,
    userLoading,
    isSignedIn,
  ]);

  return cosmeticsState;
}
