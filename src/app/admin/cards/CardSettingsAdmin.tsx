// src/app/admin/cards/CardSettingsAdmin.tsx
// Unified Settings Studio for Card System Policies, Packs, Seasons, Valuation, Economy, and Takedowns
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sliders,
  Package,
  Calendar,
  Coins,
  ShieldAlert,
  Gavel,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import {
  FacetContainer,
  FacetCard,
} from "~/components/ui/facet-container";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { CardGeneralSettingsAdmin } from "./CardGeneralSettingsAdmin";
import { CardPacksAdmin } from "./CardPacksAdmin";
import { IxCardSeasonAdmin } from "./IxCardSeasonAdmin";
import { ValuationAdmin } from "./ValuationAdmin";
import { CardTakedownsAdmin } from "./CardTakedownsAdmin";

export type SettingsSubtab =
  | "general"
  | "packs"
  | "seasons"
  | "valuation"
  | "takedowns";


interface CardSettingsAdminProps {
  initialSubtab?: SettingsSubtab;
  onSubtabChange?: (subtab: SettingsSubtab) => void;
}

function SeedDemoAuctionsButton() {
  const notify = useNotify();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const seedMutation = api.cardMarket.seedDemoAuctions.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Demo Auctions Seeded", data.message);
      setConfirmOpen(false);
    },
    onError: (error: { message: string }) => {
      notify.error("Seeding Failed", error.message);
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 backdrop-blur-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/20 p-2.5 backdrop-blur-md">
            <Gavel className="h-5 w-5 text-amber-500 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">Demo Marketplace Auctions</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Seed synthetic market auctions with active bidding for test environments.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={seedMutation.isPending}
          className="h-9 rounded-xl border border-amber-400/30 bg-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all shadow-xs"
        >
          {seedMutation.isPending ? "Seeding..." : "Seed Demo Auctions"}
        </Button>
      </FacetCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Gavel className="h-5 w-5 text-amber-500" />
              Seed Demo Card Auctions?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              This will create test auctions in the card marketplace using sample cards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogClose>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="bg-amber-500 font-semibold text-black hover:bg-amber-400 active:scale-95 transition-all"
            >
              {seedMutation.isPending ? "Seeding..." : "Confirm Seed"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
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
      label: "General Settings",
      description: "Platform switches, trading policies, marketplace tax & minting",
      icon: Sliders,
    },
    {
      id: "packs" as SettingsSubtab,
      label: "Packs & Drop Tables",
      description: "Pack catalog, probabilities, guaranteed slots & pricing",
      icon: Package,
    },
    {
      id: "seasons" as SettingsSubtab,
      label: "Seasons & Rotation",
      description: "Season configuration, release dates & active card pools",
      icon: Calendar,
    },
    {
      id: "valuation" as SettingsSubtab,
      label: "Valuation & Floors",
      description: "Rarity base curves, NS premium multipliers & junk rates",
      icon: Coins,
    },
    {
      id: "takedowns" as SettingsSubtab,
      label: "Takedowns & Legal",
      description: "NS flag-owner copyright requests & retired card restore",
      icon: ShieldAlert,
      badge: hiddenCardsCount > 0 ? `${hiddenCardsCount}` : undefined,
      badgeVariant: "destructive" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Pill-Style Subnavigation Tabs ─────────────────────── */}
      <FacetContainer
        depth={2}
        enableRefraction={true}
        className="rounded-2xl border border-border bg-card/60 p-2 backdrop-blur-xl shadow-md"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {SUBTABS.map((subtab) => {
            const Icon = subtab.icon;
            const isActive = activeSubtab === subtab.id;
            return (
              <button
                key={subtab.id}
                onClick={() => setActiveSubtab(subtab.id)}
                className={`group flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  isActive
                    ? "border border-primary/40 bg-primary/20 text-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span>{subtab.label}</span>
                {subtab.badge && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      subtab.badgeVariant === "destructive"
                        ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {subtab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FacetContainer>

      {/* ─── Subtab Content Panes ────────────────────────────────── */}
      {activeSubtab === "general" && (
        <div className="space-y-6">
          <CardGeneralSettingsAdmin />
          <SeedDemoAuctionsButton />
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

