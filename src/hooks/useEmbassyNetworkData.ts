/**
 * useEmbassyNetworkData Hook
 *
 * Fetches and processes embassy network data with atomic component synergies.
 * Combines embassy data with atomic government components to calculate synergy scores
 * and bonuses for each embassy connection.
 *
 * @param countryId - The ID of the country to fetch embassies for
 * @param isOwner - Whether the current user owns this country
 * @returns Embassy data enriched with synergy calculations
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

interface AtomicSynergy {
  category: string;
  matchScore: number;
  sharedComponents: string[];
  benefits: {
    economic: number;
    diplomatic: number;
    cultural: number;
  };
}

interface EmbassyWithSynergies {
  id: string;
  name: string;
  hostCountryId: string;
  guestCountryId: string;
  hostCountry: string;
  hostCountryFlag: string | null;
  hostCountrySlug: string | null;
  guestCountry: string;
  guestCountryFlag: string | null;
  guestCountrySlug: string | null;
  countryId: string | null;
  country: string;
  countryFlag: string | null;
  countrySlug: string | null;
  status: string;
  strength: number;
  role: 'host' | 'guest';
  ambassadorName?: string | null;
  location?: string | null;
  staffCount?: number | null;
  services?: string[];
  establishedAt: string;
  level?: number | null;
  experience?: number | null;
  influence?: number | null;
  budget?: number | null;
  maintenanceCost?: number | null;
  securityLevel?: string | null;
  specialization?: string | null;
  specializationLevel?: number | null;
  lastMaintenance?: string | null;
  updatedAt: string;
  synergies: AtomicSynergy[];
  totalSynergyScore: number;
  economicBonus: number;
  diplomaticBonus: number;
  culturalBonus: number;
}

interface UseEmbassyNetworkDataReturn {
  embassiesWithSynergies: EmbassyWithSynergies[];
  isLoading: boolean;
}

/**
 * Calculate atomic synergies between countries based on shared government components
 */
function calculateAtomicSynergies(
  myComponents: Array<{ componentType: string; effectivenessScore: number }> | undefined,
  embassy: any
): AtomicSynergy[] {
  if (!myComponents || myComponents.length === 0) {
    return [];
  }

  const synergies: AtomicSynergy[] = [];

  // Group components by category for synergy calculation
  const componentCategories = {
    "Power Structure": ["CENTRALIZED_POWER", "FEDERAL_SYSTEM", "CONFEDERATE_SYSTEM", "UNITARY_SYSTEM"],
    "Decision Making": ["DEMOCRATIC_PROCESS", "AUTOCRATIC_PROCESS", "TECHNOCRATIC_PROCESS", "CONSENSUS_PROCESS", "OLIGARCHIC_PROCESS"],
    "Legitimacy": ["ELECTORAL_LEGITIMACY", "TRADITIONAL_LEGITIMACY", "PERFORMANCE_LEGITIMACY", "CHARISMATIC_LEGITIMACY", "RELIGIOUS_LEGITIMACY"],
    "Institutions": ["PROFESSIONAL_BUREAUCRACY", "MILITARY_ADMINISTRATION", "INDEPENDENT_JUDICIARY", "PARTISAN_INSTITUTIONS", "TECHNOCRATIC_AGENCIES"],
    "Control": ["RULE_OF_LAW", "SURVEILLANCE_SYSTEM", "PROPAGANDA_APPARATUS", "SECURITY_FORCES", "CIVIL_SOCIETY"]
  };

  // Calculate synergies for each category
  Object.entries(componentCategories).forEach(([categoryName, categoryComponents]) => {
    const myMatchingComponents = myComponents.filter(c =>
      categoryComponents.includes(c.componentType)
    );

    if (myMatchingComponents.length > 0) {
      // Calculate match score based on component effectiveness and embassy strength
      const avgEffectiveness = myMatchingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) / myMatchingComponents.length;
      const matchScore = Math.min(100, (avgEffectiveness + embassy.strength) / 2);

      if (matchScore > 30) {
        synergies.push({
          category: categoryName,
          matchScore,
          sharedComponents: myMatchingComponents.map(c =>
            c.componentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
          ),
          benefits: {
            economic: matchScore * 0.04,
            diplomatic: matchScore * 0.06,
            cultural: matchScore * 0.03
          }
        });
      }
    }
  });

  return synergies;
}

export function useEmbassyNetworkData(
  countryId: string,
  isOwner: boolean
): UseEmbassyNetworkDataReturn {
  // Fetch embassies
  const { data: embassies, isLoading } = api.diplomatic.getEmbassies.useQuery({
    countryId
  });

  // Fetch atomic government components for synergy calculation (only if owner)
  const { data: myComponents } = api.atomicGovernment.getComponents.useQuery(
    { countryId },
    { enabled: isOwner }
  );

  // Calculate atomic synergies for each embassy
  const embassiesWithSynergies = useMemo(() => {
    if (!embassies) return [];

    return embassies.map((embassy) => {
      // For each embassy, calculate synergies based on shared atomic components
      const synergies = calculateAtomicSynergies(myComponents, embassy);

      return {
        ...embassy,
        synergies,
        totalSynergyScore: synergies.reduce((sum, s) => sum + s.matchScore, 0),
        economicBonus: synergies.reduce((sum, s) => sum + s.benefits.economic, 0),
        diplomaticBonus: synergies.reduce((sum, s) => sum + s.benefits.diplomatic, 0),
        culturalBonus: synergies.reduce((sum, s) => sum + s.benefits.cultural, 0)
      };
    });
  }, [embassies, myComponents]);

  return {
    embassiesWithSynergies,
    isLoading
  };
}
