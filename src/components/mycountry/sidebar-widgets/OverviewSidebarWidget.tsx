"use client";

import { useMemo } from "react";
import {
  Globe,
  Landmark,
  Swords,
  Heart,
  AlertTriangle,
  Gavel,
  type LucideIcon,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface OverviewSidebarWidgetProps {
  countryId: string;
}

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  diplomatic: { icon: Globe, color: "text-cyan-500" },
  economic: { icon: Landmark, color: "text-emerald-500" },
  military: { icon: Swords, color: "text-red-500" },
  social: { icon: Heart, color: "text-pink-500" },
  emergency: { icon: AlertTriangle, color: "text-amber-500" },
  governance: { icon: Gavel, color: "text-indigo-500" },
};

/**
 * Overview context widget — feeds the unified SectionContextWidget with
 * cross-section stats (active policies / embassies / parties) and the national
 * News Feed (canon feed — the same source as the Executive section's
 * NewsFeedWidget). This replaces the former "Country Log" activity list.
 */
export function OverviewSidebarWidget({ countryId }: OverviewSidebarWidgetProps) {
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: canonItems } = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 12 },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;
    const activeEmbassies =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const partyCount = parties?.length ?? 0;

    return [
      { label: "Policies", value: activePolicies, accentText: true },
      { label: "Embassies", value: activeEmbassies, accentText: true },
      { label: "Parties", value: partyCount, accentText: true },
    ];
  }, [policies, embassies, parties]);

  // News Feed — mirrors the Executive section's NewsFeedWidget mapping.
  const activity = useMemo<ContextActivityEntry[]>(() => {
    if (!canonItems || canonItems.length === 0) return [];
    return canonItems.slice(0, 8).map((item: any) => {
      const { icon, color } = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.diplomatic;
      return {
        id: item.id,
        icon,
        iconColor: color,
        text: item.title.length > 120 ? item.title.slice(0, 117) + "..." : item.title,
        time: new Date(item.timestamp),
      };
    });
  }, [canonItems]);

  return (
    <SectionContextWidget
      accent="amber"
      title="News Feed"
      stats={stats}
      activity={activity}
      emptyMessage="No recent activity. Execute actions to generate news."
    />
  );
}
