"use client";

import { useEffect, useState } from "react";
import { Coins, Refresh as RefreshCw, FloppyDisk as Save } from "iconoir-react";
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
    if (data) setForm(data as unknown as Record<string, number>);
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
    <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-5">
      <div className="border-b border-border/20 pb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-400" />
          <h2 className="text-foreground text-xs font-bold">Card Valuation Formula</h2>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          Single source of truth for every card&apos;s value:{" "}
          <code className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
            max(rarityFloor × typeMult, nsValue × premium)
          </code>
          . Saving applies the change and revalues all cards.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center text-xs">Loading config…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{f.label}</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))
                  }
                  className="h-8 w-full rounded-xl border border-border/30 bg-background/50 px-3 font-mono text-xs text-foreground shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                />
                {f.hint && <span className="text-muted-foreground text-[10px] block">{f.hint}</span>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={busy}
              size="sm"
              className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              {saveMutation.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save &amp; Revalue All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recomputeMutation.mutate()}
              disabled={busy}
              className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              {recomputeMutation.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Recompute Only
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
