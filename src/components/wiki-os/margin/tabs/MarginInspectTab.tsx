"use client";
// src/components/wiki-os/margin/tabs/MarginInspectTab.tsx
// Live simulation inspector and lore topology guide:
// Classifies article hierarchy according to Lore Theory (Hub, Spoke, Leaf)
// and validates article assertions against live IxStates simulation data.
// WikiOS & Apple Design Standard.

import React, { useMemo } from "react";
import {
  Globe,
  Coins as DollarSign,
  User as Users,
  RefreshDouble as RefreshCw,
  DesignPencil as Edit3,
  OpenNewWindow as ExternalLink,
  Compass,
} from "iconoir-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { formatCompact } from "~/lib/format/compact";
import { ixstatesHref } from "~/lib/system/wikios-standalone";

interface MarginInspectTabProps {
  articleTitle: string;
  onProposeEdit: (originalText: string, suggestedText: string) => void;
  isAuthenticated: boolean;
}

export type PageTier = "HUB" | "LOADBEARING" | "ITERATIVE";

export function MarginInspectTab({
  articleTitle,
  onProposeEdit,
  isAuthenticated,
}: MarginInspectTabProps) {
  const cleanTitle = articleTitle.replace(/_/g, " ").trim();

  // 1. Query live country stats if an exact entity matches
  const { data: matchedCountry, isLoading } = api.countries.getByIdBasic.useQuery(
    { id: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 60_000 }
  );

  // 2. Classify Article Tier according to Lore Theory
  const pageTierInfo = useMemo<{
    tier: PageTier;
    title: string;
    levelName: string;
    scopeName: string;
    description: string;
    guideline: string;
  }>(() => {
    const lower = cleanTitle.toLowerCase();

    // Check if Loadbearing Spoke (Government, Economy, Politics, Military, History, Foreign Relations)
    const loadbearingKeywords = [
      "government of",
      "politics of",
      "economy of",
      "history of",
      "military of",
      "foreign relations of",
      "culture of",
      "geography of",
      "demographics of",
      "ministry of",
      "armed forces of",
    ];

    if (loadbearingKeywords.some((kw) => lower.includes(kw))) {
      return {
        tier: "LOADBEARING",
        title: "Loadbearing Spoke",
        levelName: "Institutional Subpage",
        scopeName: "Systemic Overview",
        description: "Core subsystem page covering state governance, economy, defense, or history.",
        guideline:
          "Anchor sections with links back to the parent nation hub and link forward to specific offices and treaties.",
      };
    }

    // Check if Main Page Hub
    if (
      matchedCountry ||
      (!lower.includes("of ") && !lower.includes("battle") && !lower.includes("treaty"))
    ) {
      return {
        tier: "HUB",
        title: "Primary Country Hub",
        levelName: "Sovereign Overview",
        scopeName: "Foundational Context",
        description:
          "Central overview page answering the nation's core purpose, worldview, and general character.",
        guideline:
          "Keep statistics synchronized with simulation data and branch out into dedicated category subpages.",
      };
    }

    // Otherwise, Specific Topic / Iterative Lore
    return {
      tier: "ITERATIVE",
      title: "Specialized Leaf",
      levelName: "Topic Article",
      scopeName: "Focused Depth",
      description:
        "Dedicated entry for an individual artifact, battle, tradition, or historical office.",
      guideline:
        "Clarify why this element matters to the broader universe and maintain links back to relevant sovereign hubs.",
    };
  }, [cleanTitle, matchedCountry]);

  const formattedGdp = useMemo(() => {
    if (!matchedCountry?.currentTotalGdp) return null;
    return `$${formatCompact(Number(matchedCountry.currentTotalGdp))}`;
  }, [matchedCountry]);

  const formattedPop = useMemo(() => {
    if (!matchedCountry?.currentPopulation) return null;
    return formatCompact(Number(matchedCountry.currentPopulation));
  }, [matchedCountry]);

  const handleGenerateFactDiff = () => {
    if (!matchedCountry) return;
    const oldText = `Population: (outdated value)\nGDP: (outdated value)`;
    const newText = `Population: ${formattedPop ?? "Unknown"}\nGDP: ${formattedGdp ?? "Unknown"}\nRegion: ${matchedCountry.continent ?? "IxWorld"}`;

    onProposeEdit(oldText, newText);
  };

  return (
    <div className="animate-in fade-in space-y-4 duration-150">
      {/* 1. Article Topology & Lore Structure */}
      <div className="rounded-card border-separator bg-surface space-y-3 border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="text-margin-accent h-4 w-4" />
            <h4 className="text-caption text-label font-semibold">Article Topology</h4>
          </div>
          <span className="bg-margin-accent text-caption rounded-full px-2 py-0.5 font-semibold text-(--margin-badge-text)">
            {pageTierInfo.title}
          </span>
        </div>

        {/* Structural Spec Inset */}
        <div className="text-footnote grid grid-cols-2 gap-2">
          <div className="rounded-row border-separator bg-surface-secondary space-y-0.5 border p-2">
            <span className="text-subhead text-label-secondary">Hierarchy Tier</span>
            <p className="text-caption text-label truncate font-semibold">
              {pageTierInfo.levelName}
            </p>
          </div>

          <div className="rounded-row border-separator bg-surface-secondary space-y-0.5 border p-2">
            <span className="text-subhead text-label-secondary">Editorial Scope</span>
            <p className="text-caption text-label truncate font-semibold">
              {pageTierInfo.scopeName}
            </p>
          </div>
        </div>

        <p className="text-footnote text-label-secondary leading-relaxed">
          {pageTierInfo.description}
        </p>

        <div className="rounded-row border-separator bg-surface text-footnote text-label-secondary space-y-1 border p-3">
          <span className="text-margin-accent text-subhead block">Linkage Recommendation</span>
          <p className="text-label-secondary leading-snug">{pageTierInfo.guideline}</p>
        </div>
      </div>

      {/* 2. Simulation Registry & Live Telemetry */}
      {isLoading && (
        <div className="rounded-card border-separator bg-surface text-footnote text-label-secondary flex items-center justify-center gap-2 border p-6">
          <RefreshCw className="text-margin-accent h-4 w-4 animate-spin" />
          <span>Querying simulation registry...</span>
        </div>
      )}

      {!isLoading && matchedCountry && (
        <div className="rounded-card border-separator bg-surface space-y-3 border p-4">
          {/* Nation Dossier Header */}
          <div className="border-separator flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              {matchedCountry.flagUrl ? (
                <img
                  src={matchedCountry.flagUrl}
                  alt={matchedCountry.name}
                  className="rounded-control-sm border-separator h-6 w-8 border object-cover"
                />
              ) : (
                <div className="bg-margin-accent/15 border-margin-accent/30 text-margin-accent rounded-control-sm text-caption flex h-6 w-8 items-center justify-center border font-semibold">
                  {matchedCountry.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-caption text-label truncate font-semibold">
                  {matchedCountry.name}
                </h4>
                <div className="text-caption text-green flex items-center gap-2 font-semibold">
                  <span className="bg-green/70 h-1.5 w-1.5 rounded-full" />
                  <span>Simulation Active</span>
                </div>
              </div>
            </div>

            <a
              href={ixstatesHref(`/countries/${matchedCountry.id}`)}
              className="text-margin-accent hover:text-margin-accent/90 text-caption flex items-center gap-1 p-1 font-semibold transition-colors"
              title="Open sovereign dossier"
            >
              <span>Profile</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Metric Comparison Grid */}
          <div className="text-footnote grid grid-cols-2 gap-2">
            <div className="rounded-row border-separator bg-surface-secondary space-y-1 border p-3">
              <div className="text-caption text-label-secondary flex items-center gap-1">
                <Users className="text-teal h-3 w-3" />
                <span>Population</span>
              </div>
              <div className="text-caption text-label font-semibold tabular-nums">
                {formattedPop ?? "Calculating..."}
              </div>
            </div>

            <div className="rounded-row border-separator bg-surface-secondary space-y-1 border p-3">
              <div className="text-caption text-label-secondary flex items-center gap-1">
                <DollarSign className="text-green h-3 w-3" />
                <span>Gross Domestic Product</span>
              </div>
              <div className="text-caption text-label font-semibold tabular-nums">
                {formattedGdp ?? "Calculating..."}
              </div>
            </div>
          </div>

          {/* Additional Registry Facts */}
          <div className="border-separator text-footnote space-y-2 border-t pt-1">
            {matchedCountry.continent && (
              <div className="text-label-secondary flex items-center justify-between">
                <span>Continental Region</span>
                <span className="text-label font-semibold">{matchedCountry.continent}</span>
              </div>
            )}
            {matchedCountry.currentGdpPerCapita && (
              <div className="text-label-secondary flex items-center justify-between">
                <span>GDP per Capita</span>
                <span className="text-label font-semibold tabular-nums">
                  ${Number(matchedCountry.currentGdpPerCapita).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Action: Propose Diff Patch */}
          {isAuthenticated && (
            <Button
              size="lg"
              onClick={handleGenerateFactDiff}
              className="bg-margin-accent hover:bg-margin-accent-hover w-full text-(--margin-badge-text)"
            >
              <Edit3 className="size-3.5" />
              <span>Propose edit with live stats</span>
            </Button>
          )}
        </div>
      )}

      {!isLoading && !matchedCountry && (
        <div className="rounded-card border-separator bg-surface space-y-2 border p-4 text-center">
          <div className="border-separator bg-surface text-label-secondary mx-auto flex h-8 w-8 items-center justify-center rounded-full border">
            <Globe className="h-4 w-4" />
          </div>
          <p className="text-caption text-label font-semibold">Independent Encyclopedic Entry</p>
          <p className="text-footnote text-label-secondary mx-auto max-w-xs leading-relaxed">
            This entry represents an event, custom, or artifact rather than an active sovereign
            nation state.
          </p>
        </div>
      )}
    </div>
  );
}
