// src/components/wiki-os/margin/tabs/MarginInspectTab.tsx
// Live simulation inspector and lore topology guide:
// Classifies article hierarchy according to Lore Theory (Hub, Spoke, Leaf)
// and validates article assertions against live IxStates simulation data.
// WikiOS & Apple Design Standard.

"use client";

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
import { cn } from "~/lib/utils";

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
        guideline: "Anchor sections with links back to the parent nation hub and link forward to specific offices and treaties.",
      };
    }

    // Check if Main Page Hub
    if (matchedCountry || (!lower.includes("of ") && !lower.includes("battle") && !lower.includes("treaty"))) {
      return {
        tier: "HUB",
        title: "Primary Country Hub",
        levelName: "Sovereign Overview",
        scopeName: "Foundational Context",
        description: "Central overview page answering the nation's core purpose, worldview, and general character.",
        guideline: "Keep statistics synchronized with simulation data and branch out into dedicated category subpages.",
      };
    }

    // Otherwise, Specific Topic / Iterative Lore
    return {
      tier: "ITERATIVE",
      title: "Specialized Leaf",
      levelName: "Topic Article",
      scopeName: "Focused Depth",
      description: "Dedicated entry for an individual artifact, battle, tradition, or historical office.",
      guideline: "Clarify why this element matters to the broader universe and maintain links back to relevant sovereign hubs.",
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
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* 1. Article Topology & Lore Structure */}
      <div className="rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3.5 space-y-3 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-margin-accent" />
            <h4 className="text-xs font-bold text-[var(--wikios-text)] tracking-tight">
              Article Topology
            </h4>
          </div>
          <span className="text-[10px] font-bold text-stone-950 bg-margin-accent px-2 py-0.5 rounded-full shadow-xs">
            {pageTierInfo.title}
          </span>
        </div>

        {/* Structural Spec Inset */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 space-y-0.5">
            <span className="text-[9.5px] font-semibold text-[var(--wikios-text-dim)] uppercase tracking-wider">
              Hierarchy Tier
            </span>
            <p className="text-[11.5px] font-bold text-[var(--wikios-text)] truncate">
              {pageTierInfo.levelName}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 space-y-0.5">
            <span className="text-[9.5px] font-semibold text-[var(--wikios-text-dim)] uppercase tracking-wider">
              Editorial Scope
            </span>
            <p className="text-[11.5px] font-bold text-[var(--wikios-text)] truncate">
              {pageTierInfo.scopeName}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-[var(--wikios-text-muted)] leading-relaxed">
          {pageTierInfo.description}
        </p>

        <div className="p-2.5 rounded-xl bg-[var(--wikios-surface)]/70 border border-[var(--wikios-border)]/70 text-[11px] text-[var(--wikios-text-muted)] space-y-1">
          <span className="text-[9.5px] font-bold text-margin-accent uppercase tracking-wider block">
            Linkage Recommendation
          </span>
          <p className="leading-snug text-[var(--wikios-text-dim)]">
            {pageTierInfo.guideline}
          </p>
        </div>
      </div>

      {/* 2. Simulation Registry & Live Telemetry */}
      {isLoading && (
        <div className="p-6 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 flex items-center justify-center gap-2 text-xs text-[var(--wikios-text-muted)] backdrop-blur-md">
          <RefreshCw className="w-4 h-4 animate-spin text-margin-accent" />
          <span>Querying simulation registry...</span>
        </div>
      )}

      {!isLoading && matchedCountry && (
        <div className="rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3.5 space-y-3 backdrop-blur-md shadow-xs">
          {/* Nation Dossier Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[var(--wikios-border)]/60 pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {matchedCountry.flagUrl ? (
                <img
                  src={matchedCountry.flagUrl}
                  alt={matchedCountry.name}
                  className="w-8 h-6 object-cover rounded border border-[var(--wikios-border)] shadow-xs"
                />
              ) : (
                <div className="w-8 h-6 rounded bg-margin-accent/15 border border-margin-accent/30 flex items-center justify-center text-xs font-bold text-margin-accent">
                  {matchedCountry.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-[var(--wikios-text)] truncate">
                  {matchedCountry.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>Simulation Active</span>
                </div>
              </div>
            </div>

            <Link
              href={`/countries/${matchedCountry.id}`}
              className="flex items-center gap-1 text-[10.5px] font-bold text-margin-accent hover:text-margin-accent/90 transition-colors p-1"
              title="Open sovereign dossier"
            >
              <span>Profile</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Metric Comparison Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-[var(--wikios-text-dim)] font-medium">
                <Users className="w-3 h-3 text-cyan-400" />
                <span>Population</span>
              </div>
              <div className="text-xs font-bold text-[var(--wikios-text)] tabular-nums">
                {formattedPop ?? "Calculating..."}
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-[var(--wikios-border)]/60 bg-[var(--wikios-surface)]/50 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-[var(--wikios-text-dim)] font-medium">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span>Gross Domestic Product</span>
              </div>
              <div className="text-xs font-bold text-[var(--wikios-text)] tabular-nums">
                {formattedGdp ?? "Calculating..."}
              </div>
            </div>
          </div>

          {/* Additional Registry Facts */}
          <div className="space-y-1.5 text-[11px] pt-1 border-t border-[var(--wikios-border)]/60">
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
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-margin-accent hover:bg-margin-accent/90 text-stone-950 text-xs font-bold shadow-xs active:scale-[0.98] transition-transform cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Propose edit with live stats</span>
            </button>
          )}
        </div>
      )}

      {!isLoading && !matchedCountry && (
        <div className="p-4 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 text-center space-y-2 backdrop-blur-md">
          <div className="w-8 h-8 rounded-full bg-[var(--wikios-surface)] border border-[var(--wikios-border)] flex items-center justify-center mx-auto text-[var(--wikios-text-dim)]">
            <Globe className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-[var(--wikios-text)]">
            Independent Encyclopedic Entry
          </p>
          <p className="text-[11px] text-[var(--wikios-text-dim)] leading-relaxed max-w-xs mx-auto">
            This entry represents an event, custom, or artifact rather than an active sovereign nation state.
          </p>
        </div>
      )}
    </div>
  );
}

