"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { Loader2 } from "lucide-react";

export function VaultSystemConfig() {
  const notify = useNotify();

  // tRPC Queries & Mutations
  const { data: vaultConfig, isLoading: isConfigLoading } =
    api.vault.adminGetVaultConfig.useQuery();

  const [configForm, setConfigForm] = useState({
    activeDailyCap: 100,
    socialDailyCap: 50,
    xpPerLevel: 1000,
    maxStreakBonus: 7,
    premiumMultiplier: 1,
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
  });

  useEffect(() => {
    if (vaultConfig) {
      setConfigForm({
        activeDailyCap: vaultConfig.activeDailyCap,
        socialDailyCap: vaultConfig.socialDailyCap,
        xpPerLevel: vaultConfig.xpPerLevel,
        maxStreakBonus: vaultConfig.maxStreakBonus,
        premiumMultiplier: vaultConfig.premiumMultiplier,
        priceGoldenProfileGlow: vaultConfig.priceGoldenProfileGlow ?? 500,
        priceNeonCyberFrame: vaultConfig.priceNeonCyberFrame ?? 750,
        priceEliteChatBadge: vaultConfig.priceEliteChatBadge ?? 1000,
        priceLoreRequestToken: vaultConfig.priceLoreRequestToken ?? 2500,
        priceCardCapacity: vaultConfig.priceCardCapacity ?? 5000,
        pricePassiveYieldBoost: vaultConfig.pricePassiveYieldBoost ?? 5000,
        isEarningEnabled: vaultConfig.isEarningEnabled ?? true,
        isTradingEnabled: vaultConfig.isTradingEnabled ?? true,
        isAuctionsEnabled: vaultConfig.isAuctionsEnabled ?? true,
        isStoreEnabled: vaultConfig.isStoreEnabled ?? true,
        isCraftingEnabled: vaultConfig.isCraftingEnabled ?? true,
        isPacksEnabled: vaultConfig.isPacksEnabled ?? true,
        isMaintenanceMode: vaultConfig.isMaintenanceMode ?? false,
        exemptStaffFromLimit: vaultConfig.exemptStaffFromLimit ?? true,
      });
    }
  }, [vaultConfig]);

  const saveConfigMutation = api.vault.adminSaveVaultConfig.useMutation({
    onSuccess: (data) => {
      notify.success("Success", data.message || "Vault configuration saved");
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to save vault configuration");
    },
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate(configForm);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/30 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-foreground text-lg font-bold">Vault Config</CardTitle>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Updates take effect immediately on active gameplay caps and credit generation.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isConfigLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-active-cap" className="text-foreground/80">
                    Daily Cap (Active)
                  </Label>
                  <div className="relative">
                    <Input
                      id="cfg-active-cap"
                      type="number"
                      min={1}
                      max={10000}
                      value={configForm.activeDailyCap}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, activeDailyCap: Number(e.target.value) }))
                      }
                      className="bg-background border-border/40 text-foreground pr-10 font-mono"
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
                      IxC
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-social-cap" className="text-foreground/80">
                    Daily Cap (Social)
                  </Label>
                  <div className="relative">
                    <Input
                      id="cfg-social-cap"
                      type="number"
                      min={1}
                      max={10000}
                      value={configForm.socialDailyCap}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, socialDailyCap: Number(e.target.value) }))
                      }
                      className="bg-background border-border/40 text-foreground pr-10 font-mono"
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
                      IxC
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-xp" className="text-foreground/80">
                    XP per Level
                  </Label>
                  <div className="relative">
                    <Input
                      id="cfg-xp"
                      type="number"
                      min={100}
                      max={100000}
                      value={configForm.xpPerLevel}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, xpPerLevel: Number(e.target.value) }))
                      }
                      className="bg-background border-border/40 text-foreground pr-12 font-mono"
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
                      XP
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-streak" className="text-foreground/80">
                    Max Streak Bonus
                  </Label>
                  <div className="relative">
                    <Input
                      id="cfg-streak"
                      type="number"
                      min={1}
                      max={365}
                      value={configForm.maxStreakBonus}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, maxStreakBonus: Number(e.target.value) }))
                      }
                      className="bg-background border-border/40 text-foreground pr-10 font-mono"
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
                      IxC
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-premium" className="text-foreground/80">
                    Premium Multiplier
                  </Label>
                  <div className="relative">
                    <Input
                      id="cfg-premium"
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={configForm.premiumMultiplier}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, premiumMultiplier: Number(e.target.value) }))
                      }
                      className="bg-background border-border/40 text-foreground pr-8 font-mono"
                    />
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
                      x
                    </span>
                  </div>
                </div>
              </div>

              {/* System switches section */}
              <div className="border-border/40 border-t pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {/* Enable Earning */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">Enable Earning</span>
                      <span className="text-muted-foreground text-[10px]">
                        Enables user active & social credits.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isEarningEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isEarningEnabled: val }))
                      }
                    />
                  </div>
                  {/* Enable Store Purchases */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">Enable Store</span>
                      <span className="text-muted-foreground text-[10px]">
                        Allows buying dynamic storefront cosmetics.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isStoreEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isStoreEnabled: val }))
                      }
                    />
                  </div>
                  {/* Enable Card Crafting */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">Enable Crafting</span>
                      <span className="text-muted-foreground text-[10px]">
                        Allows fusing and evolving collector cards.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isCraftingEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isCraftingEnabled: val }))
                      }
                    />
                  </div>
                  {/* Enable Card Packs */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">
                        Enable Card Packs
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Enables pack purchases & award mutations.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isPacksEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isPacksEnabled: val }))
                      }
                    />
                  </div>
                  {/* Enable P2P Trading */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">
                        Enable P2P Trading
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Allows player card negotiation trades.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isTradingEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isTradingEnabled: val }))
                      }
                    />
                  </div>
                  {/* Enable Auctions */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">
                        Enable P2P Auctions
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Enables card listings and active bidding.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isAuctionsEnabled}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isAuctionsEnabled: val }))
                      }
                    />
                  </div>
                  {/* Maintenance Mode */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-destructive text-xs font-semibold">
                        Maintenance Mode
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Blocks all write operations globally.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.isMaintenanceMode}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, isMaintenanceMode: val }))
                      }
                    />
                  </div>
                  {/* Exempt Staff from Card Limits */}
                  <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-lg border p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">
                        Exempt Staff
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Exempt role levels 20 & lower from capacity limit.
                      </span>
                    </div>
                    <Switch
                      checked={configForm.exemptStaffFromLimit}
                      onCheckedChange={(val) =>
                        setConfigForm((f) => ({ ...f, exemptStaffFromLimit: val }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-border/40 flex justify-end border-t pt-4">
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                  size="sm"
                  className="bg-amber-600 font-semibold text-white hover:bg-amber-700"
                >
                  {saveConfigMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Constants"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
