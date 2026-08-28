"use client";
// src/components/wiki-os/margin/tabs/MarginInspectTab.tsx
// Live simulation inspector and lore topology guide:
// Classifies article hierarchy according to Lore Theory (Hub, Spoke, Leaf)
// and validates article assertions against live IxStates simulation data.
// WikiOS & Apple Design Standard.

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Globe,
  Coins as DollarSign,
  User as Users,
  RefreshDouble as RefreshCw,
  DesignPencil as Edit3,
  OpenNewWindow as ExternalLink,
  Compass,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";
import { api } from "~/trpc/react";

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
    const gdpVal = Number(matchedCountry.currentTotalGdp);
    if (gdpVal >= 1_000_000_000_000) return `$${(gdpVal / 1_000_000_000_000).toFixed(2)}T`;
    if (gdpVal >= 1_000_000_000) return `$${(gdpVal / 1_000_000_000).toFixed(2)}B`;
    return `$${(gdpVal / 1_000_000).toFixed(2)}M`;
  }, [matchedCountry]);

  const formattedPop = useMemo(() => {
    if (!matchedCountry?.currentPopulation) return null;
    const popVal = Number(matchedCountry.currentPopulation);
    if (popVal >= 1_000_000) return `${(popVal / 1_000_000).toFixed(2)}M`;
    return `${(popVal / 1_000).toFixed(1)}k`;
  }, [matchedCountry]);

  const handleGenerateFactDiff = () => {
    if (!matchedCountry) return;
    soundEffects.press();
    const oldText = `Population: (outdated value)\nGDP: (outdated value)`;
    const newText = `Population: ${formattedPop ?? "Unknown"}\nGDP: ${formattedGdp ?? "Unknown"}\nRegion: ${matchedCountry.continent ?? "IxWorld"}`;

    onProposeEdit(oldText, newText);
  };

  return (
    <div className="animate-in fade-in space-y-3.5 duration-150">
      {/* 1. Article Topology & Lore Structure */}
      <div className="space-y-3 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="text-margin-accent h-4 w-4" />
            <h4 className="text-xs font-bold tracking-tight text-[var(--wikios-text)]">
              Article Topology
            </h4>
          </div>
          <span className="bg-margin-accent rounded-full px-2 py-0.5 text-[10px] font-bold text-stone-950 shadow-xs">
            {pageTierInfo.title}
          </span>
        </div>

        {/* Structural Spec Inset */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-0.5 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 p-2">
            <span className="text-[9.5px] font-semibold tracking-wider text-[var(--wikios-text-dim)] uppercase">
              Hierarchy Tier
            </span>
            <p className="truncate text-[11.5px] font-bold text-[var(--wikios-text)]">
              {pageTierInfo.levelName}
            </p>
          </div>

          <div className="space-y-0.5 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 p-2">
            <span className="text-[9.5px] font-semibold tracking-wider text-[var(--wikios-text-dim)] uppercase">
              Editorial Scope
            </span>
            <p className="truncate text-[11.5px] font-bold text-[var(--wikios-text)]">
              {pageTierInfo.scopeName}
            </p>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-[var(--wikios-text-muted)]">
          {pageTierInfo.description}
        </p>

        <div className="space-y-1 rounded-xl border border-[var(--wikios-border)]/70 bg-[var(--wikios-surface)]/70 p-2.5 text-[11px] text-[var(--wikios-text-muted)]">
          <span className="text-margin-accent block text-[9.5px] font-bold tracking-wider uppercase">
            Linkage Recommendation
          </span>
          <p className="leading-snug text-[var(--wikios-text-dim)]">{pageTierInfo.guideline}</p>
        </div>
      </div>

      {/* 2. Simulation Registry & Live Telemetry */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-6 text-xs text-[var(--wikios-text-muted)] backdrop-blur-md">
          <RefreshCw className="text-margin-accent h-4 w-4 animate-spin" />
          <span>Querying simulation registry...</span>
        </div>
      )}

      {!isLoading && matchedCountry && (
        <div className="space-y-3 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3.5 shadow-xs backdrop-blur-md">
          {/* Nation Dossier Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[var(--wikios-border)]/60 pb-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {matchedCountry.flagUrl ? (
                <img
                  src={matchedCountry.flagUrl}
                  alt={matchedCountry.name}
                  className="h-6 w-8 rounded border border-[var(--wikios-border)] object-cover shadow-xs"
                />
              ) : (
                <div className="bg-margin-accent/15 border-margin-accent/30 text-margin-accent flex h-6 w-8 items-center justify-center rounded border text-xs font-bold">
                  {matchedCountry.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="truncate text-xs font-bold text-[var(--wikios-text)]">
                  {matchedCountry.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>Simulation Active</span>
                </div>
              </div>
            </div>

            <Link
              href={`/countries/${matchedCountry.id}`}
              className="text-margin-accent hover:text-margin-accent/90 flex items-center gap-1 p-1 text-[10.5px] font-bold transition-colors"
              title="Open sovereign dossier"
            >
              <span>Profile</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Metric Comparison Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--wikios-text-dim)]">
                <Users className="h-3 w-3 text-cyan-400" />
                <span>Population</span>
              </div>
              <div className="text-xs font-bold text-[var(--wikios-text)] tabular-nums">
                {formattedPop ?? "Calculating..."}
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--wikios-text-dim)]">
                <DollarSign className="h-3 w-3 text-emerald-400" />
                <span>Gross Domestic Product</span>
              </div>
              <div className="text-xs font-bold text-[var(--wikios-text)] tabular-nums">
                {formattedGdp ?? "Calculating..."}
              </div>
            </div>
          </div>

          {/* Additional Registry Facts */}
          <div className="space-y-1.5 border-t border-[var(--wikios-border)]/60 pt-1 text-[11px]">
            {matchedCountry.continent && (
              <div className="flex items-center justify-between text-[var(--wikios-text-dim)]">
                <span>Continental Region</span>
                <span className="font-semibold text-[var(--wikios-text)]">
                  {matchedCountry.continent}
                </span>
              </div>
            )}
            {matchedCountry.currentGdpPerCapita && (
              <div className="flex items-center justify-between text-[var(--wikios-text-dim)]">
                <span>GDP per Capita</span>
                <span className="font-semibold text-[var(--wikios-text)] tabular-nums">
                  ${Number(matchedCountry.currentGdpPerCapita).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Action: Propose Diff Patch */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleGenerateFactDiff}
              className="bg-margin-accent hover:bg-margin-accent/90 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-950 shadow-xs transition-transform active:scale-[0.98]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Propose edit with live stats</span>
            </button>
          )}
        </div>
      )}

      {!isLoading && !matchedCountry && (
        <div className="space-y-2 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-4 text-center backdrop-blur-md">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wikios-border)] bg-[var(--wikios-surface)] text-[var(--wikios-text-dim)]">
            <Globe className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-[var(--wikios-text)]">
            Independent Encyclopedic Entry
          </p>
          <p className="mx-auto max-w-xs text-[11px] leading-relaxed text-[var(--wikios-text-dim)]">
            This entry represents an event, custom, or artifact rather than an active sovereign
            nation state.
          </p>
        </div>
      )}
    </div>
  );
}
