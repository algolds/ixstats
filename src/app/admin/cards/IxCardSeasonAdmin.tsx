"use client";
// src/app/admin/cards/IxCardSeasonAdmin.tsx
// IxCard Season Configuration with Facet Glass & Apple Tactile Physics

import { useState, useEffect } from "react";
import { Component as Layers, Refresh as RefreshCw, FloppyDisk as Save } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

export function IxCardSeasonAdmin() {
  const notify = useNotify();
  const { data: currentSeason, isLoading, refetch } = api.vault.adminGetIxCardSeason.useQuery();
  const setSeasonMutation = api.vault.adminSetIxCardSeason.useMutation({
    onSuccess: () => {
      void refetch();
      notify.success("Season updated successfully.");
    },
    onError: (err) => {
      notify.error(`Error: ${err.message}`);
    },
  });

  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  useEffect(() => {
    if (currentSeason) setSelectedSeason(currentSeason);
  }, [currentSeason]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="text-tint h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="border-tint/20 bg-tint-fill rounded-row border p-3">
            <Layers className="text-tint h-6 w-6" />
          </div>
          <div>
            <h2 className="text-label text-title-3">IxCard Season Configuration</h2>
            <p className="text-label-secondary text-body">
              Set the current active IxCard season. This controls which season newly created cards
              (lore, special) are assigned to. NS-imported cards keep their original season in the{" "}
              <code className="text-tint text-footnote tabular-nums">nsSeason</code> field.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-label text-body font-medium">Current IxCard Season:</label>
            <Select
              value={String(selectedSeason)}
              onValueChange={(v) => setSelectedSeason(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Season {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setSeasonMutation.mutate({ season: selectedSeason })}
              disabled={setSeasonMutation.isPending || selectedSeason === currentSeason}
              className="gap-2"
            >
              {setSeasonMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Season
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-yellow/20 bg-yellow/10 border p-3">
            <Layers className="text-yellow h-6 w-6" />
          </div>
          <div>
            <h3 className="text-label text-title-3">How season assignment works</h3>
            <ul className="text-label-secondary text-body mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-label">NS-imported cards</strong> set both{" "}
                <code className="text-tint text-footnote tabular-nums">season</code> and{" "}
                <code className="text-tint text-footnote tabular-nums">nsSeason</code> to the NS
                season number
              </li>
              <li>
                <strong className="text-label">Crafted cards</strong> and{" "}
                <strong className="text-label">Lore cards</strong> set{" "}
                <code className="text-tint text-footnote tabular-nums">season</code> to the current
                IxCard season
              </li>
              <li>
                Season drops in the Vault store dynamically draw from the corresponding active
                season pack configurations.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
