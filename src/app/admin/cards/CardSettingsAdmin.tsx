"use client";
// src/app/admin/cards/CardSettingsAdmin.tsx
// Unified Settings Studio for Card System Policies, Packs, Seasons, Valuation, Economy, and Takedowns

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ControlSlider as Sliders,
  Package,
  Calendar,
  Coins,
  ShieldAlert,
  Hammer as Gavel,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
import { Card } from "~/components/ui/card";

export type SettingsSubtab = "general" | "packs" | "seasons" | "valuation" | "takedowns";

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
      <Card className="border-yellow/20 bg-yellow/5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-yellow/30 bg-yellow/20 border p-3">
            <Gavel className="text-yellow h-5 w-5" />
          </div>
          <div>
            <p className="text-label text-headline">Demo Marketplace Auctions</p>
            <p className="text-label-secondary text-footnote mt-0.5">
              Seed synthetic market auctions with active bidding for test environments.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => setConfirmOpen(true)}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? "Seeding..." : "Seed Demo Auctions"}
        </Button>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Gavel className="text-yellow h-5 w-5" />
              Seed Demo Card Auctions?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create test auctions in the card marketplace using sample cards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogClose>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
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
                    variant={subtab.badgeVariant === "destructive" ? "destructive" : "neutral"}
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
