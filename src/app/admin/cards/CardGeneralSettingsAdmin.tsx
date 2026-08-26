// src/app/admin/cards/CardGeneralSettingsAdmin.tsx
// General Card System Settings & Global Policy Admin
"use client";

import { useEffect, useState } from "react";
import { Refresh as RefreshCw, FloppyDisk as Save, ShoppingBag, Gift, Sparks as Sparkles, Component as Layers, MediaImage as Image } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";

export function CardGeneralSettingsAdmin() {
  const notify = useNotify();
  const { data, isLoading, refetch } = api.cards.getGeneralConfig.useQuery();
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data) setForm(data as unknown as Record<string, number>);
  }, [data]);

  const saveMutation = api.cards.setGeneralConfig.useMutation({
    onSuccess: () => {
      notify.success("Settings updated", "Card system policies have been saved successfully.");
      void refetch();
    },
    onError: (e: { message: string }) => notify.error("Update failed", e.message),
  });

  const handleChange = (key: string, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  return (
    <FacetContainer className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-bold">General Card System Policies</h2>
          <p className="text-muted-foreground text-xs font-medium">
            Configure global marketplace controls, free pack allowances, drop rates, and lore permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="border-border/40 rounded-xl active:scale-[0.98]"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded-xl active:scale-[0.98]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Policies"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Marketplace & Trading Policies */}
        <FacetCard
          depth={1}
          className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/40 flex items-center gap-2.5 border-b pb-3">
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
            <h3 className="text-foreground text-sm font-bold">Marketplace & Trading</h3>
          </div>

          <div className="space-y-4">
            {/* Global Trading Toggle */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Global Trading & Auction House
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Master kill-switch for direct card trades and auction marketplace
                </p>
              </div>
              <Switch
                checked={(form.tradingEnabled ?? 1) === 1}
                onCheckedChange={(checked) => handleChange("tradingEnabled", checked ? 1 : 0)}
              />
            </div>

            {/* Auction House Rake / Fee % */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Marketplace Transaction Tax (House Rake)
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Percentage fee deducted from card sales/auctions
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.auctionHouseRakePct ?? 5}
                  onChange={(e) => handleChange("auctionHouseRakePct", Number(e.target.value))}
                  className="border-border/40 bg-background text-foreground focus:border-primary h-8 w-20 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">%</span>
              </div>
            </div>
          </div>
        </FacetCard>

        {/* Daily Claims & Allowance */}
        <FacetCard
          depth={1}
          className="border-border bg-card/60 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/60 flex items-center gap-2.5 border-b pb-3">
            <Gift className="h-4 w-4 text-purple-500" />
            <h3 className="text-foreground text-sm font-bold">Daily Free Packs & Cooldowns</h3>
          </div>

          <div className="space-y-4">
            {/* Daily Free Packs Amount */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Daily Free Pack Allowance
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Number of complimentary packs grantable per cooldown cycle
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={form.dailyFreePacks ?? 1}
                  onChange={(e) => handleChange("dailyFreePacks", Number(e.target.value))}
                  className="border-border bg-card text-foreground focus:border-primary h-8 w-20 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">packs</span>
              </div>
            </div>

            {/* Cooldown Hours */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Free Pack Reset Interval
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Hours required between consecutive free pack claims
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={form.dailyPackCooldownHours ?? 24}
                  onChange={(e) => handleChange("dailyPackCooldownHours", Number(e.target.value))}
                  className="border-border bg-card text-foreground focus:border-primary h-8 w-20 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">hours</span>
              </div>
            </div>
          </div>
        </FacetCard>

        {/* Player Minting & Lore Permissions */}
        <FacetCard
          depth={1}
          className="border-border bg-card/60 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/60 flex items-center gap-2.5 border-b pb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-foreground text-sm font-bold">Lore Creation & Permissions</h3>
          </div>

          <div className="space-y-4">
            {/* Player Minting Toggle */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Player Lore Card Submissions
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Allow regular players to propose lore cards for review
                </p>
              </div>
              <Switch
                checked={(form.allowPlayerMinting ?? 0) === 1}
                onCheckedChange={(checked) => handleChange("allowPlayerMinting", checked ? 1 : 0)}
              />
            </div>

            {/* Auto Generate Lore Thumbnails */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Auto-Resolve Wiki Thumbnails
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Automatically extract artwork during bulk wiki lore card scraping
                </p>
              </div>
              <Switch
                checked={(form.autoGenerateLoreThumbnails ?? 1) === 1}
                onCheckedChange={(checked) => handleChange("autoGenerateLoreThumbnails", checked ? 1 : 0)}
              />
            </div>
          </div>
        </FacetCard>

        {/* Binder & Recycler Limits */}
        <FacetCard
          depth={1}
          className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/40 flex items-center gap-2.5 border-b pb-3">
            <Layers className="h-4 w-4 text-cyan-500" />
            <h3 className="text-foreground text-sm font-bold">Inventory & Recycler Limits</h3>
          </div>

          <div className="space-y-4">
            {/* Max Inventory Cards */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Player Binder Capacity Cap
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Maximum active cards a user can hold in their collection
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={form.maxInventoryCards ?? 2500}
                  onChange={(e) => handleChange("maxInventoryCards", Number(e.target.value))}
                  className="border-border/40 bg-background text-foreground focus:border-primary h-8 w-24 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">cards</span>
              </div>
            </div>

            {/* Max Junk Batch Size */}
            <div className="border-border/40 bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Max Batch Junk/Recycle Limit
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Maximum cards recyclable in a single batch payout call
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={form.maxJunkBatchSize ?? 100}
                  onChange={(e) => handleChange("maxJunkBatchSize", Number(e.target.value))}
                  className="border-border/40 bg-background text-foreground focus:border-primary h-8 w-24 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">cards</span>
              </div>
            </div>
          </div>
        </FacetCard>
      </div>
    </FacetContainer>
  );
}
