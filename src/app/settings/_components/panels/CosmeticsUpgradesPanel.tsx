"use client";

import { Button } from "~/components/ui/button";
import React from "react";
import Link from "next/link";
import {
  Crown as Gem,
  Check,
  Cpu,
  Crown,
  OpenBook as BookOpen,
  Database,
  StatUp as TrendingUp,
  RefreshDouble as RefreshCw,
  Cart as ShoppingCart,
  Flash,
  Shield,
  Palette,
  Eye,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

const QUALITY_BADGES: Record<string, { label: string; class: string }> = {
  COMMON: { label: "Common", class: "border-border/40 bg-muted/40 text-muted-foreground" },
  RARE: { label: "Rare", class: "border-border/60 bg-muted/60 text-foreground" },
  EPIC: { label: "Epic", class: "border-border/80 bg-muted/80 text-foreground font-semibold" },
  LEGENDARY: { label: "Legendary", class: "border-border bg-muted text-foreground font-bold" },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palette,
  Gem,
  Cpu,
  Crown,
  BookOpen,
  Database,
  TrendingUp,
  Flash,
  Shield,
  Eye,
};

export function CosmeticsUpgradesPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: storeItems, isLoading: storeLoading } = api.vault.listStoreItems.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: purchasedData, isLoading: purchasedLoading } = api.vault.getPurchasedItems.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const { data: equippedData, isLoading: equippedLoading } =
    api.vault.getEquippedCosmetics.useQuery(undefined, { refetchOnWindowFocus: false });

  const purchasedItemIds = purchasedData?.purchasedItemIds ?? [];
  const purchaseCounts = purchasedData?.purchaseCounts ?? {};
  const equippedCosmetics = equippedData?.equipped ?? [];

  const toggleEquipMutation = api.vault.toggleEquipCosmetic.useMutation({
    onSuccess: (res) => {
      soundEffects.toggle();
      notify.success(res.isEquipped ? "Cosmetic equipped" : "Cosmetic unequipped");
      void utils.vault.getEquippedCosmetics.invalidate();
      void utils.vault.getPurchasedItems.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to equip cosmetic");
    },
  });

  const handleRefreshAll = () => {
    soundEffects.press();
    void utils.vault.invalidate();
    notify.success("Inventory updated");
  };

  // Strictly filter to PURCHASED/OWNED items only
  const ownedCosmetics = (storeItems ?? []).filter(
    (item) =>
      item.category === "cosmetics" &&
      (purchasedItemIds.includes(item.id) || equippedCosmetics.includes(item.id))
  );

  const ownedUpgrades = (storeItems ?? []).filter(
    (item) =>
      item.category === "upgrades" &&
      (purchasedItemIds.includes(item.id) || (purchaseCounts[item.id] ?? 0) > 0)
  );

  const isDataLoading = storeLoading || purchasedLoading || equippedLoading;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Cosmetics & upgrades"
        category="Vault"
        description="Profile cosmetics, avatar accents and permanent upgrades you own."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Vault store</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
            <Button
              type="button"
              onClick={handleRefreshAll}
              data-cuelume-press="soft"
              title="Sync with server"
              variant="secondary"
              size="icon-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* Owned cosmetics */}
      <SettingsGroup
        title="Owned cosmetics"
        description="Card frames, avatar accents and badges in your inventory."
      >
        {isDataLoading ? (
          <div className="text-muted-foreground p-4 text-center text-xs">
            Loading your cosmetics...
          </div>
        ) : ownedCosmetics.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Palette className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-xs font-semibold">You have no cosmetics yet</p>
            <p className="text-muted-foreground/70 mt-0.5 max-w-sm text-xs">
              Buy profile effects, card borders and chat badges in the Vault store.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Browse the Vault store</span>
              </Link>
            </Button>
          </div>
        ) : (
          ownedCosmetics.map((item) => {
            const isEquipped = equippedCosmetics.includes(item.id);
            const Icon = ICON_MAP[item.icon] || Palette;
            const qualityMeta = QUALITY_BADGES[item.quality] ?? QUALITY_BADGES.COMMON;
            const isToggling =
              toggleEquipMutation.isPending && toggleEquipMutation.variables?.itemId === item.id;

            return (
              <SettingsRow
                key={item.id}
                label={item.name}
                description={item.description ?? "Cosmetic for your profile and card showcase"}
                icon={Icon}
                glyphClass="bg-muted/60 text-foreground"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "hidden rounded-md border px-1.5 py-0.5 text-xs font-semibold sm:inline-block",
                      qualityMeta.class
                    )}
                  >
                    {qualityMeta.label}
                  </span>

                  <Button
                    type="button"
                    disabled={isToggling}
                    onClick={() => toggleEquipMutation.mutate({ itemId: item.id })}
                    data-cuelume-press="soft"
                    variant={isEquipped ? "default" : "secondary"}
                    size="sm"
                  >
                    {isEquipped && <Check className="h-3.5 w-3.5" />}
                    <span>{isToggling ? "Saving..." : isEquipped ? "Equipped" : "Equip"}</span>
                  </Button>
                </div>
              </SettingsRow>
            );
          })
        )}
      </SettingsGroup>

      {/* Purchased upgrades */}
      <SettingsGroup
        title="Purchased upgrades"
        description="Permanent upgrades such as extra card capacity and passive yield."
      >
        {isDataLoading ? (
          <div className="text-muted-foreground p-4 text-center text-xs">
            Loading purchased upgrades...
          </div>
        ) : ownedUpgrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Gem className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-xs font-semibold">You have no upgrades yet</p>
            <p className="text-muted-foreground/70 mt-0.5 max-w-sm text-xs">
              Buy card capacity and yield upgrades in the Vault store.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Browse the Vault store</span>
              </Link>
            </Button>
          </div>
        ) : (
          ownedUpgrades.map((item) => {
            const count = purchaseCounts[item.id] || 1;
            const Icon = ICON_MAP[item.icon] || Gem;
            const qualityMeta = QUALITY_BADGES[item.quality] ?? QUALITY_BADGES.COMMON;

            return (
              <SettingsRow
                key={item.id}
                label={item.name}
                description={item.description ?? "Permanent Vault upgrade"}
                icon={Icon}
                glyphClass="bg-muted/60 text-foreground"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "hidden rounded-md border px-1.5 py-0.5 text-xs font-semibold sm:inline-block",
                      qualityMeta.class
                    )}
                  >
                    {qualityMeta.label}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="border-border/60 bg-muted/40 text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold">
                      <Check className="text-muted-foreground h-3.5 w-3.5" />
                      <span>Active {count > 1 ? `(×${count})` : ""}</span>
                    </span>
                  </div>
                </div>
              </SettingsRow>
            );
          })
        )}
      </SettingsGroup>
    </div>
  );
}
