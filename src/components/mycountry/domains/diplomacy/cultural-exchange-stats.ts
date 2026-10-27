import type { RouterOutputs } from "~/trpc/react";
import type { Achievement, CulturalExchange } from "./cultural-exchange-types";

/** Live exchanges as the program shape; outcomes are not tracked server-side yet. */
export const toExchanges = (
  live: RouterOutputs["diplomaticCultural"]["getCulturalExchanges"]
): CulturalExchange[] =>
  live.map((exchange) => ({
    id: exchange.id,
    title: exchange.title,
    type: exchange.type as CulturalExchange["type"],
    description: exchange.description,
    hostCountry: exchange.hostCountry,
    participatingCountries: exchange.participatingCountries,
    status: exchange.status as CulturalExchange["status"],
    startDate: exchange.startDate,
    endDate: exchange.endDate,
    ixTimeContext: exchange.ixTimeContext,
    metrics: exchange.metrics,
    linkedMissions: exchange.linkedMissions,
    bonusReasoning: exchange.bonusReasoning,
    achievements: exchange.achievements,
    culturalArtifacts: exchange.culturalArtifacts,
    diplomaticOutcomes: { newPartnerships: 0, tradeAgreements: 0, futureCollaborations: [] },
  })) as CulturalExchange[];

const sum = (items: CulturalExchange[], pick: (e: CulturalExchange) => number) =>
  items.reduce((total, e) => total + pick(e), 0);

export function summarizeExchanges(exchanges: CulturalExchange[]) {
  const total = exchanges.length;
  return {
    totalExchanges: total,
    activeExchanges: exchanges.filter((e) => e.status === "active").length,
    completedExchanges: exchanges.filter((e) => e.status === "completed").length,
    totalParticipants: sum(exchanges, (e) => e.metrics.participants),
    avgCulturalImpact:
      total > 0 ? Math.round(sum(exchanges, (e) => e.metrics.culturalImpact) / total) : 0,
  };
}

const ACHIEVEMENT_RULES: {
  badge: Achievement;
  earned: (mine: CulturalExchange[], countryId: string, avgImpact: number) => boolean;
}[] = [
  {
    badge: {
      id: "first-exchange",
      name: "Cultural Pioneer",
      icon: "🌟",
      description: "Participated in first exchange",
    },
    earned: (mine) => mine.length >= 1,
  },
  {
    badge: {
      id: "active-participant",
      name: "Active Participant",
      icon: "🎭",
      description: "Participated in 5+ exchanges",
    },
    earned: (mine) => mine.length >= 5,
  },
  {
    badge: {
      id: "cultural-ambassador",
      name: "Cultural Ambassador",
      icon: "🏆",
      description: "Participated in 10+ exchanges",
    },
    earned: (mine) => mine.length >= 10,
  },
  {
    badge: {
      id: "host",
      name: "Gracious Host",
      icon: "🏛️",
      description: "Hosted a cultural exchange",
    },
    earned: (mine, countryId) => mine.some((e) => e.hostCountry.id === countryId),
  },
  {
    badge: {
      id: "completionist",
      name: "Completionist",
      icon: "✅",
      description: "Completed 3+ exchanges",
    },
    earned: (mine) => mine.filter((e) => e.status === "completed").length >= 3,
  },
  {
    badge: {
      id: "high-impact",
      name: "High Impact",
      icon: "💫",
      description: "70+ avg cultural impact",
    },
    earned: (_mine, _countryId, avgImpact) => avgImpact >= 70,
  },
];

export function deriveAchievements(
  exchanges: CulturalExchange[],
  countryId: string
): Achievement[] {
  const mine = exchanges.filter(
    (e) =>
      e.hostCountry.id === countryId || e.participatingCountries.some((c) => c.id === countryId)
  );
  const avgImpact = mine.length > 0 ? sum(mine, (e) => e.metrics.culturalImpact) / mine.length : 0;
  return ACHIEVEMENT_RULES.filter((r) => r.earned(mine, countryId, avgImpact)).map((r) => r.badge);
}

/** Active first, then by start date: oldest first for completed, newest first otherwise. */
export function filterExchanges(
  exchanges: CulturalExchange[],
  type: string,
  status: string
): CulturalExchange[] {
  return exchanges
    .filter((e) => (type === "all" || e.type === type) && (status === "all" || e.status === status))
    .sort((a, b) => {
      if ((a.status === "active") !== (b.status === "active"))
        return a.status === "active" ? -1 : 1;
      const delta = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      return a.status === "completed" ? delta : -delta;
    });
}
