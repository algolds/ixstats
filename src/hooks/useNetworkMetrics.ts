/**
 * useNetworkMetrics Hook
 *
 * Calculates aggregate metrics for an embassy network including total embassies,
 * average synergy scores, and cumulative bonuses across economic, diplomatic, and
 * cultural dimensions. The network power metric combines embassy count with
 * synergy strength to provide an overall diplomatic influence score.
 *
 * @param embassiesWithSynergies - Array of embassies enriched with synergy data
 * @returns Network metrics or null if no embassies exist
 */

import { useMemo } from "react";

interface EmbassyWithSynergies {
  totalSynergyScore: number;
  economicBonus: number;
  diplomaticBonus: number;
  culturalBonus: number;
}

interface NetworkMetrics {
  totalEmbassies: number;
  avgSynergyScore: number;
  totalEconomicBonus: number;
  totalDiplomaticBonus: number;
  totalCulturalBonus: number;
  networkPower: number;
}

export function useNetworkMetrics(
  embassiesWithSynergies: EmbassyWithSynergies[]
): NetworkMetrics | null {
  return useMemo(() => {
    if (!embassiesWithSynergies.length) return null;

    const totalEmbassies = embassiesWithSynergies.length;
    const avgSynergyScore =
      embassiesWithSynergies.reduce((sum, e) => sum + e.totalSynergyScore, 0) / totalEmbassies;
    const totalEconomicBonus = embassiesWithSynergies.reduce((sum, e) => sum + e.economicBonus, 0);
    const totalDiplomaticBonus = embassiesWithSynergies.reduce(
      (sum, e) => sum + e.diplomaticBonus,
      0
    );
    const totalCulturalBonus = embassiesWithSynergies.reduce((sum, e) => sum + e.culturalBonus, 0);

    return {
      totalEmbassies,
      avgSynergyScore,
      totalEconomicBonus,
      totalDiplomaticBonus,
      totalCulturalBonus,
      networkPower: Math.round(totalEmbassies * 10 + avgSynergyScore * 2),
    };
  }, [embassiesWithSynergies]);
}
