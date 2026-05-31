"use client";

import { useState, useEffect } from "react";
import { Layers, RefreshCw, Save } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

export function IxCardSeasonAdmin() {
  const { data: currentSeason, isLoading, refetch } = api.vault.adminGetIxCardSeason.useQuery();
  const setSeasonMutation = api.vault.adminSetIxCardSeason.useMutation({
    onSuccess: () => {
      void refetch();
    },
    onError: (err) => {
      alert(`Error: ${err.message}`);
    },
  });

  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  useEffect(() => {
    if (currentSeason) setSelectedSeason(currentSeason);
  }, [currentSeason]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card-parent rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/10 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
            <Layers className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">IxCard Season Configuration</h2>
            <p className="text-muted-foreground text-sm">
              Set the current active IxCard season. This controls which season newly created cards
              (crafting, lore, special) are assigned to. NS-imported cards keep their original season
              in the <code className="text-blue-400">nsSeason</code> field.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-foreground text-sm font-medium">Current IxCard Season:</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="border-border bg-background text-foreground rounded-lg border px-4 py-2 text-sm"
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
              className="bg-blue-500 hover:bg-blue-600"
            >
              {setSeasonMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>

          {setSeasonMutation.isSuccess && (
            <p className="text-green-400 text-sm">
              Season updated to {selectedSeason} successfully!
            </p>
          )}
        </div>
      </div>

      <div className="glass-card-parent rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/10 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <Layers className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-foreground text-lg font-semibold">How Season Assignment Works</h3>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong className="text-foreground">NS-imported cards</strong> set both{" "}
                <code className="text-blue-400">season</code> and{" "}
                <code className="text-blue-400">nsSeason</code> to the NS season number
              </li>
              <li>
                <strong className="text-foreground">Crafted cards</strong> and{" "}
                <strong className="text-foreground">Lore cards</strong> use the current IxCard season
              </li>
              <li>
                <strong className="text-foreground">Seasonal retirement</strong> checks{" "}
                <code className="text-blue-400">Card.season</code> against the current IxCard season
                to determine if a card set is retired
              </li>
              <li>
                Cards from past NS seasons still show their original{" "}
                <code className="text-blue-400">nsSeason</code> in the provenance timeline
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}