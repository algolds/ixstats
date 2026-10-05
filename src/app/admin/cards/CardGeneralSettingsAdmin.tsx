"use client";
// src/app/admin/cards/CardGeneralSettingsAdmin.tsx
// General Card System Settings & Global Policy Admin

import { useEffect, useState } from "react";
import {
  Refresh as RefreshCw,
  FloppyDisk as Save,
  ShoppingBag,
  Component as Layers,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
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
            Marketplace fee, base card capacity and the junk batch limit.
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
            <h3 className="text-label text-headline">Marketplace</h3>
          </div>

          <div className="space-y-4">
            {/* Auction House Rake / Fee % */}
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">
                  Marketplace Transaction Tax (House Rake)
                </label>
                <p className="text-label-secondary text-footnote">
                  Percentage taken from auction and buyout sales over 100 IxC
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.auctionHouseRakePct ?? 10}
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
            <Layers className="text-teal h-4 w-4" />
            <h3 className="text-label text-headline">Inventory & recycler limits</h3>
          </div>

          <div className="space-y-4">
            <div className="border-separator bg-surface rounded-row flex items-center justify-between gap-4 border p-3">
              <div className="space-y-0.5">
                <label className="text-label text-caption block">Base card capacity</label>
                <p className="text-label-secondary text-footnote">
                  Cards a player can hold before Vault capacity upgrades
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={form.maxInventoryCards ?? 150}
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
