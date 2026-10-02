"use client";
// src/app/admin/vault/VaultBonusAdmin.tsx
// Metagame Economy Bonuses Configuration Suite for Vault Admin

import React, { useEffect, useState } from "react";
import {
  Gift,
  Refresh as RefreshCw,
  FloppyDisk as Save,
  UserBadgeCheck as UserCheck,
  Globe,
  Trophy,
  Trophy as Award,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";

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
    accentColor: "text-green",
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
    accentColor: "text-blue",
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
    accentColor: "text-yellow",
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
    accentColor: "text-purple",
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
        <RefreshCw className="text-label-secondary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <FacetCard className="border-green/30 bg-green/10 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-row border-green/40 bg-green/20 border p-3">
              <Gift className="text-green h-6 w-6" />
            </div>
            <div>
              <h2 className="text-label text-title-2">Metagame Economy & Bonuses</h2>
              <p className="text-label-secondary text-footnote">
                Global credit grants for milestones, deck imports, achievements, and lore rewards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="bg-surface border-separator rounded-row flex cursor-pointer items-center gap-2 border px-3 py-2">
              <Checkbox
                checked={enabled}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, enabled: checked === true ? 1 : 0 }))
                }
              />
              <span className="text-label text-caption">
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
            <FacetCard key={group.title} className="space-y-4 p-5">
              <div className="border-separator flex items-center gap-2 border-b pb-2">
                <GroupIcon className={`h-4 w-4 ${group.accentColor}`} />
                <div>
                  <h3 className="text-label text-headline">{group.title}</h3>
                  <p className="text-label-secondary text-footnote">{group.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                {group.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-label text-caption">{field.label}</label>
                      {field.hint && (
                        <span className="text-label-secondary text-footnote hidden sm:inline">
                          {field.hint}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        value={form[field.key] ?? ""}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0"
                        className="w-full font-mono"
                      />
                      <span className="text-label-secondary text-eyebrow absolute top-1/2 right-3 -translate-y-1/2 tabular-nums">
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
          variant="secondary"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="h-10"
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
