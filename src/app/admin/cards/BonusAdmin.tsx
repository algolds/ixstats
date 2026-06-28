"use client";

import { useEffect, useState } from "react";
import { Gift, RefreshCw, Save } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";

const GROUPS: { title: string; fields: { key: string; label: string; hint?: string }[] }[] = [
  {
    title: "Onboarding (one-time)",
    fields: [
      { key: "newPlayer", label: "New player", hint: "First country link/create" },
      { key: "wikiImport", label: "Wiki country import", hint: "Founded on a wiki nation" },
    ],
  },
  {
    title: "NS deck import (per import)",
    fields: [
      { key: "nsPerCard", label: "Per card", hint: "Credits per imported card" },
      { key: "nsCap", label: "Cap", hint: "Max per import" },
    ],
  },
  {
    title: "Achievement unlock (by rarity, one-time each)",
    fields: [
      { key: "achievementCommon", label: "Common" },
      { key: "achievementUncommon", label: "Uncommon" },
      { key: "achievementRare", label: "Rare" },
      { key: "achievementEpic", label: "Epic" },
      { key: "achievementLegendary", label: "Legendary" },
    ],
  },
  {
    title: "Lorewards",
    fields: [{ key: "loreward", label: "Per win", hint: "Granted to mapped wiki winners" }],
  },
];

export function BonusAdmin() {
  const notify = useNotify();
  const { data, isLoading, refetch } = api.cards.getBonusConfig.useQuery();
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data) setForm(data as unknown as Record<string, number>);
  }, [data]);

  const saveMutation = api.cards.setBonusConfig.useMutation({
    onSuccess: () => {
      notify.success("Bonuses updated", "New amounts apply to future grants");
      void refetch();
    },
    onError: (e) => notify.error("Update failed", e.message),
  });

  const enabled = (form.enabled ?? 1) > 0;

  return (
    <div className="glass-card-child rounded-xl border border-emerald-500/20 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Gift className="h-6 w-6 text-emerald-400" />
        <h2 className="text-foreground text-xl font-semibold">Metagame Bonuses</h2>
      </div>
      <p className="text-muted-foreground mb-6 text-sm text-balance">
        IxCredits granted for non-core-gameplay actions. All post as{" "}
        <code className="font-mono text-xs text-emerald-400">EARN_BONUS</code> (uncapped, ungated).
        One-time bonuses never pay the same user twice.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Loading config…</p>
      ) : (
        <>
          <label className="mb-6 flex w-fit items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked ? 1 : 0 }))}
              className="h-4 w-4"
            />
            <span className="text-foreground text-sm font-medium">
              Bonuses enabled {enabled ? "" : "(all grants paused)"}
            </span>
          </label>

          <div className="space-y-6">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="text-foreground mb-2 text-sm font-semibold">{g.title}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.fields.map((f) => (
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
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {saveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Bonuses
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
