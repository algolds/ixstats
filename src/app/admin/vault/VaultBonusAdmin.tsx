// src/app/admin/vault/VaultBonusAdmin.tsx
// Metagame Economy Bonuses Configuration Suite for Vault Admin
"use client";

import React, { useEffect, useState } from "react";
import { Gift, Refresh as RefreshCw, FloppyDisk as Save, Sparks as Sparkles, UserBadgeCheck as UserCheck, Globe, Trophy, Trophy as Award, CheckCircle as CheckCircle2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";

interface BonusField {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BonusGroup {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  fields: BonusField[];
}

const GROUPS: BonusGroup[] = [
  {
    title: "Onboarding Rewards",
    description: "One-time milestone grants for player registration and nation founding",
    icon: UserCheck,
    accentColor: "text-emerald-500",
    fields: [
      {
        key: "newPlayer",
        label: "New Player Bonus",
        hint: "Granted on first country link or account creation",
      },
      {
        key: "wikiImport",
        label: "Wiki Country Import",
        hint: "Granted when founding from a canonical wiki nation",
      },
    ],
  },
  {
    title: "NationStates Deck Import",
    description: "IxCredits rewarded for syncing external NationStates trading cards",
    icon: Globe,
    accentColor: "text-blue-500",
    fields: [
      { key: "nsPerCard", label: "Credits Per Card", hint: "Credits awarded per imported card" },
      {
        key: "nsCap",
        label: "Per-Import Cap",
        hint: "Maximum total credits earned per single deck import",
      },
    ],
  },
  {
    title: "Achievement Unlock Tiers",
    description: "One-time milestone payouts when players unlock cards of specific rarities",
    icon: Trophy,
    accentColor: "text-amber-500",
    fields: [
      { key: "achievementCommon", label: "Common Unlock" },
      { key: "achievementUncommon", label: "Uncommon Unlock" },
      { key: "achievementRare", label: "Rare Unlock" },
      { key: "achievementEpic", label: "Epic Unlock" },
      { key: "achievementLegendary", label: "Legendary Unlock" },
    ],
  },
  {
    title: "Loreward Metagame Payouts",
    description: "Competitive lore creation and community showcase rewards",
    icon: Award,
    accentColor: "text-purple-500",
    fields: [
      {
        key: "loreward",
        label: "Per-Win Payout",
        hint: "Granted to winners of mapped wiki lore challenges",
      },
    ],
  },
];

export function VaultBonusAdmin() {
  const notify = useNotify();
  const { data, isLoading, refetch } = api.cards.getBonusConfig.useQuery();
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data) setForm(data as unknown as Record<string, number>);
  }, [data]);

  const saveMutation = api.cards.setBonusConfig.useMutation({
    onSuccess: () => {
      notify.success("Bonuses Updated", "New bonus reward amounts will apply to future grants.");
      void refetch();
    },
    onError: (e) => notify.error("Update Failed", e.message),
  });

  const enabled = (form.enabled ?? 1) > 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <FacetCard
        depth={2}
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-lg backdrop-blur-xl"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 p-2.5 backdrop-blur-md">
              <Gift className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-foreground text-xl font-bold">Metagame Economy & Bonuses</h2>
              <p className="text-muted-foreground text-xs">
                Global credit grants for milestones, deck imports, achievements, and lore rewards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="bg-card/60 border-border flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked ? 1 : 0 }))}
                className="border-border h-4 w-4 rounded accent-emerald-500"
              />
              <span className="text-foreground text-xs font-semibold">
                {enabled ? "Bonuses Active" : "Bonuses Paused"}
              </span>
            </label>
          </div>
        </div>
      </FacetCard>

      {/* Group Sections Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <FacetCard
              key={group.title}
              depth={1}
              className="border-border bg-card/80 space-y-4 rounded-2xl border p-5 shadow-sm backdrop-blur-xl"
            >
              <div className="border-border flex items-center gap-2.5 border-b pb-2">
                <GroupIcon className={`h-4 w-4 ${group.accentColor}`} />
                <div>
                  <h3 className="text-foreground text-sm font-bold">{group.title}</h3>
                  <p className="text-muted-foreground text-[11px]">{group.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                {group.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-foreground text-xs font-semibold">{field.label}</label>
                      {field.hint && (
                        <span className="text-muted-foreground hidden text-[10px] sm:inline">
                          {field.hint}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={form[field.key] ?? ""}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                        className="border-border bg-background/60 text-foreground h-8 w-full rounded-lg border px-3 font-mono text-xs transition-all focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[10px] uppercase">
                        Credits
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </FacetCard>
          );
        })}
      </div>

      {/* Save Button Bar */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="h-10 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-6 text-xs font-semibold text-emerald-600 shadow-sm transition-all hover:bg-emerald-500/30 active:scale-95 dark:text-emerald-300"
        >
          {saveMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveMutation.isPending ? "Saving..." : "Save Bonus Policies"}
        </Button>
      </div>
    </div>
  );
}
