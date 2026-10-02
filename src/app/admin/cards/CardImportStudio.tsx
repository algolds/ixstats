"use client";
// src/app/admin/cards/CardImportStudio.tsx
// Unified Import Studio for Wiki Lore, NationStates Sync, and Commons Flags

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { OpenBook as BookOpen, Globe, WhiteFlag as Flag, Component as Layers } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { LoreCardBatchAdmin } from "./LoreCardBatchAdmin";
import { NSImportSuiteAdmin } from "./NSImportSuiteAdmin";
import { CommonsFlagImporterAdmin } from "./CommonsFlagImporterAdmin";
import { Card } from "~/components/ui/card";

export type ImportSubtab = "wiki" | "ns" | "flags";

interface CardImportStudioProps {
  initialSubtab?: ImportSubtab;
  onSubtabChange?: (subtab: ImportSubtab) => void;
}

export function CardImportStudio({
  initialSubtab = "wiki",
  onSubtabChange,
}: CardImportStudioProps) {
  const searchParams = useSearchParams();

  const [activeSubtab, setActiveSubtabState] = useState<ImportSubtab>(() => {
    const urlSubtab = searchParams.get("subtab");
    if (urlSubtab === "wiki" || urlSubtab === "lore") return "wiki";
    if (urlSubtab === "ns" || urlSubtab === "nationstates" || urlSubtab === "import") return "ns";
    if (urlSubtab === "flags" || urlSubtab === "commons") return "flags";
    return initialSubtab;
  });

  // Sync state if initialSubtab changes
  useEffect(() => {
    if (initialSubtab) {
      setActiveSubtabState(initialSubtab);
    }
  }, [initialSubtab]);

  const setActiveSubtab = (subtab: ImportSubtab) => {
    setActiveSubtabState(subtab);
    if (onSubtabChange) {
      onSubtabChange(subtab);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "imports");
      url.searchParams.set("subtab", subtab);
      window.history.pushState({}, "", url.toString());
    }
  };

  // Live stat badges for subtabs
  const { data: loreStats } = api.cards.getLoreStats.useQuery();
  const { data: activeNSJobs } = api.nsImport.getActiveJobs.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const pendingRequestsCount = loreStats?.pendingRequests ?? 0;
  const activeJobsCount = activeNSJobs?.length ?? 0;

  const SUBTABS = [
    {
      id: "wiki" as ImportSubtab,
      label: "Wiki Lore Importer",
      description: "Batch generate & scrape lore cards from IxWiki, IIWiki & WikiOS",
      icon: BookOpen,
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} requests` : undefined,
      badgeVariant: "secondary" as const,
    },
    {
      id: "ns" as ImportSubtab,
      label: "NationStates Sync",
      description: "Region scrapers, sync daemons & active/CTE nation compatibility",
      icon: Globe,
      badge: activeJobsCount > 0 ? `${activeJobsCount} active` : undefined,
      badgeVariant: "default" as const,
    },
    {
      id: "flags" as ImportSubtab,
      label: "Commons Flags",
      description: "Vector SVG & high-res flag importer from Wikimedia Commons",
      icon: Flag,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Import Studio Subnavigation Header ───────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-tint-fill text-tint rounded-row flex size-10 items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-label text-headline">Card Import Studio</h2>
              <p className="text-label-secondary text-footnote">
                Unified data ingestion pipeline: Wiki lore archives, NationStates collections, and
                Commons flags
              </p>
            </div>
          </div>

          {/* Subtab switcher */}
          <SegmentedControl
            asTabs
            aria-label="Import sources"
            value={activeSubtab}
            onValueChange={setActiveSubtab}
            options={SUBTABS.map((tab) => {
              const Icon = tab.icon;
              return {
                value: tab.id,
                icon: <Icon />,
                label: (
                  <>
                    {tab.label}
                    {tab.badge && (
                      <Badge variant={tab.badgeVariant || "secondary"} className="tabular-nums">
                        {tab.badge}
                      </Badge>
                    )}
                  </>
                ),
                "aria-label": tab.label,
              };
            })}
          />
        </div>
      </Card>

      {/* ─── Active Subtab Content ───────────────────────────────── */}
      <div className="duration-fast transition-opacity">
        {activeSubtab === "wiki" && <LoreCardBatchAdmin />}
        {activeSubtab === "ns" && <NSImportSuiteAdmin />}
        {activeSubtab === "flags" && <CommonsFlagImporterAdmin />}
      </div>
    </div>
  );
}
