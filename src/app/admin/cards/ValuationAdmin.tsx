"use client";

import { useEffect, useState } from "react";
import { Coins, RefreshCw, Save } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";

// Field metadata drives the whole form — add a config key here and it shows up.
const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "floorCommon", label: "Common floor", hint: "Min value of a Common card" },
  { key: "floorUncommon", label: "Uncommon floor", hint: "" },
  { key: "floorRare", label: "Rare floor", hint: "" },
  { key: "floorUltraRare", label: "Ultra-Rare floor", hint: "" },
  { key: "floorEpic", label: "Epic floor", hint: "" },
  { key: "floorLegendary", label: "Legendary floor", hint: "" },
  {
    key: "nsPremium",
    label: "NS import premium ×",
    hint: "Multiplier on NS bank value (≥1 retains value)",
  },
  { key: "multSpecial", label: "Special type ×", hint: "Multiplier on floor for SPECIAL cards" },
  { key: "multNation", label: "Nation type ×", hint: "Multiplier on floor for NATION cards" },
  { key: "junkRate", label: "Junk payout rate", hint: "Fraction of floor paid when junking" },
];

export function ValuationAdmin() {
  const notify = useNotify();
  const { data, isLoading, refetch } = api.cards.getValuationConfig.useQuery();
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data) setForm(data as Record<string, number>);
  }, [data]);

  const saveMutation = api.cards.setValuationConfig.useMutation({
    onSuccess: (res) => {
      notify.success("Valuation updated", `Recomputed ${res.updated.toLocaleString()} cards`);
      void refetch();
    },
    onError: (e) => notify.error("Update failed", e.message),
  });

  const recomputeMutation = api.cards.recomputeCardValues.useMutation({
    onSuccess: (res) =>
      notify.success("Recomputed", `${res.updated.toLocaleString()} cards revalued`),
    onError: (e) => notify.error("Recompute failed", e.message),
  });

  const busy = saveMutation.isPending || recomputeMutation.isPending;

  return (
    <div className="glass-card-child rounded-xl border border-amber-500/20 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Coins className="h-6 w-6 text-amber-400" />
        <h2 className="text-foreground text-xl font-semibold">Card Valuation</h2>
      </div>
      <p className="text-muted-foreground mb-6 text-sm text-balance">
        Single source of truth for every card&apos;s value:{" "}
        <code className="font-mono text-xs text-amber-400">
          max(rarityFloor × typeMult, nsValue × premium)
        </code>
        . Saving applies the change and revalues all cards (NS imports keep their bank value, lifted
        onto the floor curve with the premium).
      </p>

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Loading config…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-foreground text-sm font-medium">{f.label}</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))
                  }
                  className="border-input bg-background/50 text-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                />
                {f.hint && <span className="text-muted-foreground text-xs">{f.hint}</span>}
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {saveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save &amp; Revalue All
            </Button>
            <Button
              variant="outline"
              onClick={() => recomputeMutation.mutate()}
              disabled={busy}
              className="border-amber-500/20 text-amber-400"
            >
              {recomputeMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recompute Only
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
