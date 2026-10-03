"use client";
// src/app/admin/cards/CardGeneralSettingsAdmin.tsx
// General Card System Settings & Global Policy Admin

import { useEffect, useState } from "react";
import {
  Refresh as RefreshCw,
  FloppyDisk as Save,
  ShoppingBag,
  Gift,
  Sparks as Sparkles,
  Component as Layers,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";

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
    <Card className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-label text-title-3">General card system policies</h2>
          <p className="text-label-secondary text-caption">
            Configure global marketplace controls, free pack allowances, drop rates, and lore
            permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Policies"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <ShoppingBag className="text-green h-4 w-4" />
            <h3 className="text-label text-headline">Marketplace & trading</h3>
          </div>

          <div className="space-y-4">
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Global trading & auction house
                </label>
                <p className="text-label-secondary text-footnote">
                  Master kill-switch for direct card trades and auction marketplace
                </p>
              </div>
              <Switch
                checked={(form.tradingEnabled ?? 1) === 1}
                onCheckedChange={(checked) => handleChange("tradingEnabled", checked ? 1 : 0)}
              />
            </div>

            {/* Auction House Rake / Fee % */}
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Marketplace Transaction Tax (House Rake)
                </label>
                <p className="text-label-secondary text-footnote">
                  Percentage fee deducted from card sales/auctions
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.auctionHouseRakePct ?? 5}
                  onChange={(e) => handleChange("auctionHouseRakePct", Number(e.target.value))}
                  className="w-20 text-right font-mono"
                />
                <span className="text-label-secondary text-caption">%</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <Gift className="text-purple h-4 w-4" />
            <h3 className="text-label text-headline">Daily free packs & cooldowns</h3>
          </div>

          <div className="space-y-4">
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">Daily free pack allowance</label>
                <p className="text-label-secondary text-footnote">
                  Number of complimentary packs grantable per cooldown cycle
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.dailyFreePacks ?? 1}
                  onChange={(e) => handleChange("dailyFreePacks", Number(e.target.value))}
                  className="w-20 text-right font-mono"
                />
                <span className="text-label-secondary text-caption">packs</span>
              </div>
            </div>

            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">Free pack reset interval</label>
                <p className="text-label-secondary text-footnote">
                  Hours required between consecutive free pack claims
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={form.dailyPackCooldownHours ?? 24}
                  onChange={(e) => handleChange("dailyPackCooldownHours", Number(e.target.value))}
                  className="w-20 text-right font-mono"
                />
                <span className="text-label-secondary text-caption">hours</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Player Minting & Lore Permissions */}
        <Card className="space-y-4 p-6">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <Sparkles className="text-yellow h-4 w-4" />
            <h3 className="text-label text-headline">Lore creation & permissions</h3>
          </div>

          <div className="space-y-4">
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Player lore card submissions
                </label>
                <p className="text-label-secondary text-footnote">
                  Allow regular players to propose lore cards for review
                </p>
              </div>
              <Switch
                checked={(form.allowPlayerMinting ?? 0) === 1}
                onCheckedChange={(checked) => handleChange("allowPlayerMinting", checked ? 1 : 0)}
              />
            </div>

            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Auto-Resolve Wiki Thumbnails
                </label>
                <p className="text-label-secondary text-footnote">
                  Automatically extract artwork during bulk wiki lore card scraping
                </p>
              </div>
              <Switch
                checked={(form.autoGenerateLoreThumbnails ?? 1) === 1}
                onCheckedChange={(checked) =>
                  handleChange("autoGenerateLoreThumbnails", checked ? 1 : 0)
                }
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <Layers className="text-teal h-4 w-4" />
            <h3 className="text-label text-headline">Inventory & recycler limits</h3>
          </div>

          <div className="space-y-4">
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">Player binder capacity cap</label>
                <p className="text-label-secondary text-footnote">
                  Maximum active cards a user can hold in their collection
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={form.maxInventoryCards ?? 2500}
                  onChange={(e) => handleChange("maxInventoryCards", Number(e.target.value))}
                  className="w-24 text-right font-mono"
                />
                <span className="text-label-secondary text-caption">cards</span>
              </div>
            </div>

            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Max Batch Junk/Recycle Limit
                </label>
                <p className="text-label-secondary text-footnote">
                  Maximum cards recyclable in a single batch payout call
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={form.maxJunkBatchSize ?? 100}
                  onChange={(e) => handleChange("maxJunkBatchSize", Number(e.target.value))}
                  className="w-24 text-right font-mono"
                />
                <span className="text-label-secondary text-caption">cards</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}
