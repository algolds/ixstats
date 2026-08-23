// src/app/admin/cards/CardGeneralSettingsAdmin.tsx
// General Card System Settings & Global Policy Admin
"use client";

import { useEffect, useState } from "react";
import { ControlSlider as Sliders, Refresh as RefreshCw, FloppyDisk as Save, ShieldCheck, ShoppingBag, Gift, Clock, Sparks as Sparkles, Component as Layers, Trash as Trash2, MediaImage as Image } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
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

  const isSaving = saveMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header card with action bar */}
      <FacetCard
        depth={2}
        className="border-border bg-card/80 rounded-2xl border p-6 shadow-lg backdrop-blur-xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="border-primary/30 bg-primary/10 rounded-xl border p-2.5 backdrop-blur-md">
              <Sliders className="text-primary h-5 w-5" />
            </div>
            <div>
              <h2 className="text-foreground text-lg font-bold">
                General System & Trading Policies
              </h2>
              <p className="text-muted-foreground text-xs">
                Global platform-level switches, market tax rates, pack allowances, and player
                minting rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading || isSaving}
              className="border-border bg-card/80 text-foreground hover:bg-accent h-8 rounded-xl border text-xs transition-all active:scale-95"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(form)}
              disabled={isLoading || isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              {isSaving ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save System Settings
            </Button>
          </div>
        </div>
      </FacetCard>

      {/* Grid of Setting Sections */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Marketplace & Trading Policies */}
        <FacetCard
          depth={1}
          className="border-border bg-card/60 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/60 flex items-center gap-2.5 border-b pb-3">
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
            <h3 className="text-foreground text-sm font-bold">Marketplace & Trading Policies</h3>
          </div>

          <div className="space-y-4">
            {/* Global Trading Toggle */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Global Trading & Auction House
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Master kill-switch for direct card trades and auction marketplace
                </p>
              </div>
              <select
                value={form.tradingEnabled ?? 1}
                onChange={(e) => handleChange("tradingEnabled", Number(e.target.value))}
                className="border-border bg-card text-foreground h-8 rounded-lg border px-2 text-xs font-semibold focus:outline-none"
              >
                <option value={1}>Enabled</option>
                <option value={0}>Disabled (Kill-Switch)</option>
              </select>
            </div>

            {/* Auction House Rake / Fee % */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
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
                  className="border-border bg-card text-foreground focus:border-primary h-8 w-20 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
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
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Player Lore Card Submissions
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Allow regular players to propose lore cards for review
                </p>
              </div>
              <select
                value={form.allowPlayerMinting ?? 0}
                onChange={(e) => handleChange("allowPlayerMinting", Number(e.target.value))}
                className="border-border bg-card text-foreground h-8 rounded-lg border px-2 text-xs font-semibold focus:outline-none"
              >
                <option value={0}>Admin-Only (Locked)</option>
                <option value={1}>Open for Player Drafts</option>
              </select>
            </div>

            {/* Auto Generate Lore Thumbnails */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
              <div className="space-y-0.5">
                <label className="text-foreground block text-xs font-semibold">
                  Auto-Resolve Wiki Thumbnails
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Automatically extract artwork during bulk wiki lore card scraping
                </p>
              </div>
              <select
                value={form.autoGenerateLoreThumbnails ?? 1}
                onChange={(e) => handleChange("autoGenerateLoreThumbnails", Number(e.target.value))}
                className="border-border bg-card text-foreground h-8 rounded-lg border px-2 text-xs font-semibold focus:outline-none"
              >
                <option value={1}>Enabled (Auto-Scrape)</option>
                <option value={0}>Disabled (Manual Artwork Only)</option>
              </select>
            </div>
          </div>
        </FacetCard>

        {/* Binder & Recycler Limits */}
        <FacetCard
          depth={1}
          className="border-border bg-card/60 space-y-4 rounded-2xl border p-6 backdrop-blur-md"
        >
          <div className="border-border/60 flex items-center gap-2.5 border-b pb-3">
            <Layers className="h-4 w-4 text-cyan-500" />
            <h3 className="text-foreground text-sm font-bold">Inventory & Recycler Limits</h3>
          </div>

          <div className="space-y-4">
            {/* Max Inventory Cards */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
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
                  className="border-border bg-card text-foreground focus:border-primary h-8 w-24 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">cards</span>
              </div>
            </div>

            {/* Max Junk Batch Size */}
            <div className="border-border bg-card/40 flex items-center justify-between gap-4 rounded-xl border p-3">
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
                  className="border-border bg-card text-foreground focus:border-primary h-8 w-24 rounded-lg border px-2 text-right font-mono text-xs font-semibold focus:outline-none"
                />
                <span className="text-muted-foreground text-xs font-semibold">cards</span>
              </div>
            </div>
          </div>
        </FacetCard>
      </div>
    </div>
  );
}
