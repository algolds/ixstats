// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import { ArrowRight, TrendingUp, TrendingDown, AlertTriangle, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import {
  computeAllCrossPillarEffects,
  type CrossPillarEffects,
  type PolicyData,
  type RelationData,
  type PartyData,
  // eslint-disable-next-line unused-imports/no-unused-imports
  type CrisisData,
  type LegislatureData,
  type SeatSummary,
} from "~/lib/statecraft/cross-pillar-engine";
import type { MyCountrySection } from "../MyCountrySidebarNav";

interface CrossPillarBannerProps {
  section: "executive" | "diplomacy" | "politics";
  countryId: string;
  onNavigate?: (section: MyCountrySection) => void;
}

interface InsightItem {
  message: string;
  delta: string;
  severity: "positive" | "negative" | "neutral";
  targetSection: MyCountrySection;
}

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  executive: {
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    border: "border-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
  },
  diplomacy: {
    bg: "bg-cyan-50/50 dark:bg-cyan-950/20",
    border: "border-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-300",
  },
  politics: {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    border: "border-indigo-500/20",
    text: "text-indigo-700 dark:text-indigo-300",
  },
};

/**
 * Cross-pillar awareness banner showing computed gameplay effects
 * between Executive, Diplomacy, and Politics.
 * Only renders when there are active effects to show.
 */
export function CrossPillarBanner({ section, countryId, onNavigate }: CrossPillarBannerProps) {
  // Fetch data from all three pillars
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const effects = useMemo((): CrossPillarEffects | null => {
    if (!policies || !relations || !parties) return null;

    const policyData: PolicyData[] = policies.map((p: any) => ({
      id: p.id,
      name: p.name,
      policyType: p.policyType || p.category || "economic",
      category: p.category,
      status: p.status,
      priority: p.priority,
    }));

    const relationData: RelationData[] = relations.map((r: any) => ({
      id: r.id,
      targetCountryId: r.targetCountryId || r.countryBId || "",
      targetCountryName: r.targetCountry?.name || r.countryB?.name || "Unknown",
      strength: r.strength ?? 50,
      relationType: r.relationType,
    }));

    const partyData: PartyData[] = parties.map((p: any) => ({
      id: p.id,
      name: p.name,
      ideology: p.ideology || "center",
      baseSupport: p.baseSupport ?? 10,
    }));

    const seatSummary: SeatSummary[] =
      parliament?.partySummary?.map((s: any) => ({
        partyId: s.partyId || s.id || "",
        partyName: s.partyName || s.name || "",
        seats: s.seats || 0,
        ideology: s.ideology,
      })) ?? [];

    const legislatureData: LegislatureData | null = legislature
      ? {
          totalSeats: legislature.totalSeats ?? 0,
          electoralSystem: (legislature as any).electoralSystem,
        }
      : null;

    return computeAllCrossPillarEffects({
      policies: policyData,
      relations: relationData,
      parties: partyData,
      foreignPolicies: [], // TODO: wire to api.diplomaticPolicies.getActiveForeignPolicies when available
      crises: [], // TODO: wire to api.crisisEvents.getActive when available
      legislature: legislatureData,
      seatSummary,
      lastElectionResult: null, // TODO: wire when election results are available
    });
  }, [policies, relations, parties, legislature, parliament]);

  const insights = useMemo((): InsightItem[] => {
    if (!effects) return [];

    const items: InsightItem[] = [];

    if (section === "executive") {
      // Show how diplomacy/politics affect executive
      const topDiplomaticEffect = effects.policyEffects
        .filter((e) => e.source === "diplomacy")
        .sort((a, b) => Math.abs(b.effectivenessModifier) - Math.abs(a.effectivenessModifier))[0];

      if (topDiplomaticEffect && topDiplomaticEffect.effectivenessModifier !== 0) {
        items.push({
          message: topDiplomaticEffect.reason,
          delta: `${topDiplomaticEffect.effectivenessModifier > 0 ? "+" : ""}${topDiplomaticEffect.effectivenessModifier}% effectiveness`,
          severity: topDiplomaticEffect.effectivenessModifier > 0 ? "positive" : "negative",
          targetSection: "diplomacy",
        });
      }

      const topLegislativeEffect = effects.policyEffects
        .filter((e) => e.source === "legislature")
        .sort((a, b) => Math.abs(b.effectivenessModifier) - Math.abs(a.effectivenessModifier))[0];

      if (topLegislativeEffect) {
        items.push({
          message: topLegislativeEffect.reason,
          delta: `${topLegislativeEffect.passageProbability}% passage probability`,
          severity: (topLegislativeEffect.passageProbability ?? 50) >= 50 ? "positive" : "negative",
          targetSection: "politics",
        });
      }
    }

    if (section === "diplomacy") {
      // Show how executive policies affect diplomacy
      const totalDiplomaticDelta = effects.diplomaticEffects.reduce(
        (sum, e) => sum + e.strengthDelta,
        0
      );
      const affectedRelations = effects.diplomaticEffects.length;

      if (affectedRelations > 0) {
        items.push({
          message: `${affectedRelations} relationship${affectedRelations > 1 ? "s" : ""} affected by executive policies`,
          delta: `${totalDiplomaticDelta > 0 ? "+" : ""}${Math.round(totalDiplomaticDelta)}% aggregate strength`,
          severity:
            totalDiplomaticDelta > 0
              ? "positive"
              : totalDiplomaticDelta < 0
                ? "negative"
                : "neutral",
          targetSection: "executive",
        });
      }
    }

    if (section === "politics") {
      // Show how policies affect party support
      const significantPartyEffects = effects.partyEffects.filter(
        (e) => Math.abs(e.supportDelta) >= 1
      );
      if (significantPartyEffects.length > 0) {
        const topEffect = significantPartyEffects.sort(
          (a, b) => Math.abs(b.supportDelta) - Math.abs(a.supportDelta)
        )[0]!;
        items.push({
          message: `${topEffect.partyName} is ${topEffect.stance === "support" ? "benefiting from" : "opposing"} executive policies`,
          delta: `${topEffect.supportDelta > 0 ? "+" : ""}${topEffect.supportDelta.toFixed(1)}% support shift`,
          severity: topEffect.supportDelta > 0 ? "positive" : "negative",
          targetSection: "executive",
        });
      }
    }

    return items.slice(0, 2); // Max 2 insights
  }, [effects, section]);

  // Don't render if no insights
  if (insights.length === 0) return null;

  const colors = SECTION_COLORS[section] ?? SECTION_COLORS.executive;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} space-y-1.5 px-3 py-2`}>
      <div className="flex items-center gap-1.5">
        <Zap className={`h-3.5 w-3.5 ${colors.text}`} />
        <span className={`text-xs font-semibold ${colors.text}`}>Cross-Pillar Effects</span>
      </div>
      {insights.map((insight, i) => (
        <button
          key={i}
          onClick={() => onNavigate?.(insight.targetSection)}
          className="group flex w-full items-center justify-between gap-2 text-left transition-opacity hover:opacity-80"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {insight.severity === "positive" ? (
              <TrendingUp className="h-3 w-3 shrink-0 text-green-500" />
            ) : insight.severity === "negative" ? (
              <TrendingDown className="h-3 w-3 shrink-0 text-red-500" />
            ) : (
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
            )}
            <span className="text-muted-foreground truncate text-xs">{insight.message}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge
              variant="outline"
              className={`px-1 py-0 text-[0.6rem] ${
                insight.severity === "positive"
                  ? "border-green-500/30 text-green-600 dark:text-green-400"
                  : insight.severity === "negative"
                    ? "border-red-500/30 text-red-600 dark:text-red-400"
                    : "border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              {insight.delta}
            </Badge>
            <ArrowRight className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </button>
      ))}
    </div>
  );
}
