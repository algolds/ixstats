// src/app/admin/cards/CardImportStudio.tsx
// Unified Import Studio for Wiki Lore, NationStates Sync, and Commons Flags
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { OpenBook as BookOpen, Globe, WhiteFlag as Flag, Component as Layers } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { FacetContainer, FacetCard } from "~/components/ui/facet-container";
import { LoreCardBatchAdmin } from "./LoreCardBatchAdmin";
import { NSImportSuiteAdmin } from "./NSImportSuiteAdmin";
import { CommonsFlagImporterAdmin } from "./CommonsFlagImporterAdmin";

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
      <FacetCard
        depth={1}
        className="border-border bg-card/80 text-card-foreground rounded-2xl border p-4 shadow-md backdrop-blur-2xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border-primary/20 text-primary flex h-10 w-10 items-center justify-center rounded-xl border">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-foreground text-base font-bold">Card Import Studio</h2>
              <p className="text-muted-foreground text-xs">
                Unified data ingestion pipeline: Wiki lore archives, NationStates collections, and
                Commons flags
              </p>
            </div>
          </div>

          {/* Subtab Pills */}
          <FacetContainer
            depth={1}
            enableRefraction={true}
            className="border-border bg-muted/40 flex flex-wrap items-center gap-1.5 rounded-xl border p-1 backdrop-blur-md"
          >
            {SUBTABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubtab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubtab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "bg-background border-border text-foreground border font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <Badge
                      variant={tab.badgeVariant || "secondary"}
                      className="ml-0.5 px-1.5 py-0 font-mono text-[9px] font-medium"
                    >
                      {tab.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </FacetContainer>
        </div>
      </FacetCard>

      {/* ─── Active Subtab Content ───────────────────────────────── */}
      <div className="transition-opacity duration-200">
        {activeSubtab === "wiki" && <LoreCardBatchAdmin />}
        {activeSubtab === "ns" && <NSImportSuiteAdmin />}
        {activeSubtab === "flags" && <CommonsFlagImporterAdmin />}
      </div>
    </div>
  );
}
