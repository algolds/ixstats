"use client";
// src/app/admin/cards/CardSettingsAdmin.tsx
// Unified Settings Studio for Card System Policies, Packs, Seasons, Valuation, Economy, and Takedowns

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ControlSlider as Sliders, Package, Calendar, Coins, ShieldAlert } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { CardGeneralSettingsAdmin } from "./CardGeneralSettingsAdmin";
import { CardPacksAdmin } from "./CardPacksAdmin";
import { IxCardSeasonAdmin } from "./IxCardSeasonAdmin";
import { ValuationAdmin } from "./ValuationAdmin";
import { CardTakedownsAdmin } from "./CardTakedownsAdmin";

export type SettingsSubtab = "general" | "packs" | "seasons" | "valuation" | "takedowns";

interface CardSettingsAdminProps {
  initialSubtab?: SettingsSubtab;
  onSubtabChange?: (subtab: SettingsSubtab) => void;
}

export function CardSettingsAdmin({
  initialSubtab = "general",
  onSubtabChange,
}: CardSettingsAdminProps) {
  const searchParams = useSearchParams();

  const [activeSubtab, setActiveSubtabState] = useState<SettingsSubtab>(() => {
    const urlSubtab = searchParams.get("subtab");
    if (
      urlSubtab &&
      ["general", "packs", "seasons", "valuation", "takedowns"].includes(urlSubtab)
    ) {
      return urlSubtab as SettingsSubtab;
    }
    const urlTab = searchParams.get("tab");
    if (urlTab === "packs" || urlTab === "pack") return "packs";
    if (urlTab === "season" || urlTab === "seasons") return "seasons";
    if (urlTab === "valuation" || urlTab === "bonuses" || urlTab === "economy") return "valuation";
    if (urlTab === "takedowns") return "takedowns";
    return initialSubtab;
  });

  // Sync state if initialSubtab changes
  useEffect(() => {
    if (initialSubtab) {
      setActiveSubtabState(initialSubtab);
    }
  }, [initialSubtab]);

  const setActiveSubtab = (subtab: SettingsSubtab) => {
    setActiveSubtabState(subtab);
    if (onSubtabChange) {
      onSubtabChange(subtab);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "settings");
      url.searchParams.set("subtab", subtab);
      window.history.pushState({}, "", url.toString());
    }
  };

  // Live takedowns count for badge
  const { data: hiddenCards } = api.nsImport.listHiddenNSCards.useQuery();
  const hiddenCardsCount = hiddenCards?.length ?? 0;

  const SUBTABS = [
    {
      id: "general" as SettingsSubtab,
      label: "General settings",
      description: "Platform switches, trading policies, marketplace tax & minting",
      icon: Sliders,
    },
    {
      id: "packs" as SettingsSubtab,
      label: "Packs & drop tables",
      description: "Pack catalog, probabilities, guaranteed slots & pricing",
      icon: Package,
    },
    {
      id: "seasons" as SettingsSubtab,
      label: "Seasons & rotation",
      description: "Season configuration, release dates & active card pools",
      icon: Calendar,
    },
    {
      id: "valuation" as SettingsSubtab,
      label: "Valuation & floors",
      description: "Rarity base curves, NS premium multipliers & junk rates",
      icon: Coins,
    },
    {
      id: "takedowns" as SettingsSubtab,
      label: "Takedowns & legal",
      description: "NS flag-owner copyright requests & retired card restore",
      icon: ShieldAlert,
      badge: hiddenCardsCount > 0 ? `${hiddenCardsCount}` : undefined,
      badgeVariant: "destructive" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Subnavigation ─────────────────────────────────────── */}
      <SegmentedControl
        asTabs
        aria-label="Card settings sections"
        value={activeSubtab}
        onValueChange={setActiveSubtab}
        options={SUBTABS.map((subtab) => {
          const Icon = subtab.icon;
          return {
            value: subtab.id,
            icon: <Icon />,
            "aria-label": subtab.label,
            label: (
              <>
                {subtab.label}
                {subtab.badge && (
                  <Badge
                    variant={subtab.badgeVariant === "destructive" ? "destructive" : "default"}
                    className="tabular-nums"
                  >
                    {subtab.badge}
                  </Badge>
                )}
              </>
            ),
          };
        })}
      />

      {/* ─── Subtab Content Panes ────────────────────────────────── */}
      {activeSubtab === "general" && (
        <div className="space-y-6">
          <CardGeneralSettingsAdmin />
        </div>
      )}

      {activeSubtab === "packs" && (
        <div className="space-y-6">
          <CardPacksAdmin />
        </div>
      )}

      {activeSubtab === "seasons" && (
        <div className="space-y-6">
          <IxCardSeasonAdmin />
        </div>
      )}

      {activeSubtab === "valuation" && (
        <div className="space-y-6">
          <ValuationAdmin />
        </div>
      )}

      {activeSubtab === "takedowns" && (
        <div className="space-y-6">
          <CardTakedownsAdmin />
        </div>
      )}
    </div>
  );
}
