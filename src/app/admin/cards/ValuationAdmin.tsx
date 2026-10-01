"use client";

import { useEffect, useState } from "react";
import { Coins, Refresh as RefreshCw, FloppyDisk as Save } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";

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
  {
    key: "junkRate",
    label: "Junk payout rate",
    hint: "Fraction of floor paid when junking (max 0.5)",
  },
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
    <FacetCard className="space-y-5 p-5">
      <div className="border-separator border-b pb-4">
        <div className="flex items-center gap-2">
          <Coins className="text-yellow h-4 w-4" />
          <h2 className="text-label text-caption">Card Valuation Formula</h2>
        </div>
        <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
          Single source of truth for every card&apos;s value:{" "}
          <code className="rounded-control-sm bg-yellow/10 text-footnote text-yellow px-1 py-0.5 tabular-nums">
            max(rarityFloor × typeMult, nsValue × premium)
          </code>
          . Saving applies the change and revalues all cards.
        </p>
      </div>

      {isLoading ? (
        <p className="text-label-secondary text-footnote py-8 text-center">Loading config…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <span className="text-label-secondary text-eyebrow">{f.label}</span>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full font-mono"
                />
                {f.hint && (
                  <span className="text-label-secondary text-footnote block">{f.hint}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate(form)} disabled={busy} size="sm">
              {saveMutation.isPending ? (
                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Save &amp; Revalue All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recomputeMutation.mutate()}
              disabled={busy}
            >
              {recomputeMutation.isPending ? (
                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Recompute Only
            </Button>
          </div>
        </>
      )}
    </FacetCard>
  );
}
