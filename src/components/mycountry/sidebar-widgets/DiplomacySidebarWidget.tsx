"use client";

import { useMemo } from "react";
import { Building2, Handshake, Scale, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface DiplomacySidebarWidgetProps {
  countryId: string;
}

/**
 * Diplomacy context widget — a thin adapter that feeds the unified
 * SectionContextWidget with quick stats (embassies / relations / avg strength)
 * and a recent-activity log (embassies, relations, foreign policies).
 */
export function DiplomacySidebarWidget({ countryId }: DiplomacySidebarWidgetProps) {
  const { data: embassiesRaw } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: relationsRaw } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const embassies = useMemo(() => embassiesRaw ?? [], [embassiesRaw]);
  const relations = useMemo(() => relationsRaw ?? [], [relationsRaw]);

  const { data: foreignPolicies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const activeEmbassiesList =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active") ?? [];
    const activeEmbassies = activeEmbassiesList.length;

    const relationsTargetIds = new Set(relations?.map((r: any) => r.targetCountryId) ?? []);
    let additionalRelationsCount = 0;
    activeEmbassiesList.forEach((e: any) => {
      const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
      if (!relationsTargetIds.has(partnerId)) {
        additionalRelationsCount++;
        relationsTargetIds.add(partnerId);
      }
    });

    const totalRelations = (relations?.length ?? 0) + additionalRelationsCount;
    const avgStrength =
      totalRelations > 0
        ? Math.round(
            relations!.reduce((sum: number, r: any) => sum + (r.strength ?? 0), 0) / totalRelations
          )
        : 0;
    return [
      { label: "Embassies", value: activeEmbassies, accentText: true },
      { label: "Relations", value: totalRelations, accentText: true },
      { label: "Avg", value: `${avgStrength}%`, accentText: true },
    ];
  }, [embassies, relations, countryId]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    embassies?.forEach((e: any) => {
      entries.push({
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: "text-cyan-500",
        text: `Embassy with ${e.country ?? e.guestCountry ?? "Unknown"}`,
        time: new Date(e.establishedAt ?? e.createdAt),
      });
    });

    relations?.forEach((r: any) => {
      const strength = r.strength ?? 0;
      entries.push({
        id: `relation-${r.id}`,
        icon: strength >= 70 ? TrendingUp : Handshake,
        iconColor: strength >= 70 ? "text-purple-500" : "text-blue-500",
        text: `${r.targetCountry?.name ?? r.countryB?.name ?? "Unknown"} — ${strength}%`,
        time: new Date(r.updatedAt ?? r.createdAt),
      });
    });

    foreignPolicies?.forEach((fp: any) => {
      if (fp.status === "active") {
        entries.push({
          id: `fp-${fp.id}`,
          icon: Scale,
          iconColor:
            fp.actionType === "free_trade" || fp.actionType === "military_alliance"
              ? "text-green-500"
              : "text-red-500",
          text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Unknown"}`,
          time: new Date(fp.createdAt),
        });
      }
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [embassies, relations, foreignPolicies]);

  return (
    <SectionContextWidget
      accent="cyan"
      title="Diplomatic Log"
      stats={stats}
      activity={activity}
      emptyMessage="No diplomatic activity yet"
    />
  );
}
