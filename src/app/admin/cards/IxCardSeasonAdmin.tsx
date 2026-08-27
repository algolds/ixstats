// src/app/admin/cards/IxCardSeasonAdmin.tsx
// IxCard Season Configuration with Facet Glass & Apple Tactile Physics
"use client";

import { useState, useEffect } from "react";
import { Component as Layers, Refresh as RefreshCw, FloppyDisk as Save } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";

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
        <RefreshCw className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-border/30 bg-card/25 rounded-2xl border p-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="border-primary/20 bg-primary/10 rounded-xl border p-3">
            <Layers className="text-primary h-6 w-6" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">IxCard Season Configuration</h2>
            <p className="text-muted-foreground text-sm">
              Set the current active IxCard season. This controls which season newly created cards
              (crafting, lore, special) are assigned to. NS-imported cards keep their original
              season in the <code className="text-primary font-mono text-xs">nsSeason</code> field.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-foreground text-sm font-medium">Current IxCard Season:</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="border-border/40 bg-background text-foreground rounded-xl border px-3 py-2 text-sm focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
            <Button
              onClick={() => setSeasonMutation.mutate({ season: selectedSeason })}
              disabled={setSeasonMutation.isPending || selectedSeason === currentSeason}
              className="gap-2 rounded-xl active:scale-[0.98]"
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
      </div>

      <div className="border-border/30 bg-card/25 rounded-2xl border p-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Layers className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-foreground text-lg font-semibold">How Season Assignment Works</h3>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong className="text-foreground">NS-imported cards</strong> set both{" "}
                <code className="text-primary font-mono text-xs">season</code> and{" "}
                <code className="text-primary font-mono text-xs">nsSeason</code> to the NS season
                number
              </li>
              <li>
                <strong className="text-foreground">Crafted cards</strong> and{" "}
                <strong className="text-foreground">Lore cards</strong> set{" "}
                <code className="text-primary font-mono text-xs">season</code> to the current IxCard
                season
              </li>
              <li>
                Season drops in the Vault store dynamically draw from the corresponding active
                season pack configurations.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IxCardSeasonAdmin;
