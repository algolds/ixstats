/**
 * Diplomatic Operations Utilities
 *
 * Pure utility functions for diplomatic operations business logic.
 * No React dependencies - fully unit-testable.
 *
 * @module lib/diplomatic-operations-utils
 */

/**
 * Embassy status type definition
 */
export type EmbassyStatus = 'active' | 'strengthening' | 'neutral' | 'suspended' | 'closed';

/**
 * Mission status type definition
 */
export type MissionStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'available';

/**
 * Exchange status type definition
 */
export type ExchangeStatus = 'planning' | 'active' | 'completed';

/**
 * Mission difficulty type definition
 */
export type MissionDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Embassy interface (simplified)
 */
export interface Embassy {
  id: string;
  country: string;
  status: EmbassyStatus;
  strength: number;
  level?: number;
  hostCountryId?: string;
  guestCountryId?: string;
  role?: string;
}

/**
 * Mission interface (simplified)
 */
export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  difficulty: MissionDifficulty;
  progress?: number;
  priority?: string;
  createdAt?: Date | string;
}

/**
 * Cultural exchange interface (simplified)
 */
export interface CulturalExchange {
  id: string;
  title: string;
  status: ExchangeStatus;
  type: string;
  createdAt?: Date | string;
}

/**
 * Network metrics calculation result
 */
export interface NetworkMetrics {
  totalEmbassies: number;
  avgInfluence: number;
  activeCount: number;
  totalLevel: number;
  networkPower: number;
}

/**
 * Calculate network metrics from embassies
 *
 * @param embassies - Array of embassies
 * @returns Network metrics or null if no embassies
 */
export function calculateNetworkMetrics(embassies: Embassy[] | undefined): NetworkMetrics | null {
  if (!embassies || embassies.length === 0) return null;

  const totalEmbassies = embassies.length;
  const avgInfluence = embassies.reduce((sum, e) => sum + (e.strength || 0), 0) / totalEmbassies;
  const activeCount = embassies.filter(e => e.status === 'active').length;
  const totalLevel = embassies.reduce((sum, e) => sum + (e.level || 1), 0);

  return {
    totalEmbassies,
    avgInfluence,
    activeCount,
    totalLevel,
    networkPower: Math.round(totalEmbassies * 10 + avgInfluence + totalLevel * 5)
  };
}

/**
 * Filter embassies by status
 *
 * @param embassies - Array of embassies
 * @param status - Status to filter by (null for all)
 * @returns Filtered embassies
 */
export function filterEmbassiesByStatus(
  embassies: Embassy[] | undefined,
  status: EmbassyStatus | null
): Embassy[] {
  if (!embassies) return [];
  if (!status) return embassies;
  return embassies.filter(e => e.status === status);
}

/**
 * Filter embassies by region/country
 *
 * @param embassies - Array of embassies
 * @param region - Region or country name to filter by
 * @returns Filtered embassies
 */
export function filterEmbassiesByRegion(
  embassies: Embassy[] | undefined,
  region: string
): Embassy[] {
  if (!embassies || !region) return embassies || [];
  return embassies.filter(e =>
    e.country.toLowerCase().includes(region.toLowerCase())
  );
}

/**
 * Filter embassies by minimum strength
 *
 * @param embassies - Array of embassies
 * @param minStrength - Minimum strength threshold
 * @returns Filtered embassies
 */
export function filterEmbassiesByStrength(
  embassies: Embassy[] | undefined,
  minStrength: number
): Embassy[] {
  if (!embassies) return [];
  return embassies.filter(e => (e.strength || 0) >= minStrength);
}

/**
 * Sort embassies by strength (descending)
 *
 * @param embassies - Array of embassies
 * @returns Sorted embassies
 */
export function sortEmbassiesByStrength(embassies: Embassy[]): Embassy[] {
  return [...embassies].sort((a, b) => (b.strength || 0) - (a.strength || 0));
}

/**
 * Sort embassies by level (descending)
 *
 * @param embassies - Array of embassies
 * @returns Sorted embassies
 */
export function sortEmbassiesByLevel(embassies: Embassy[]): Embassy[] {
  return [...embassies].sort((a, b) => (b.level || 1) - (a.level || 1));
}

/**
 * Filter missions by status
 *
 * @param missions - Array of missions
 * @param status - Status to filter by ('all' for all missions)
 * @returns Filtered missions
 */
export function filterMissionsByStatus(
  missions: Mission[] | undefined,
  status: MissionStatus | 'all'
): Mission[] {
  if (!missions) return [];
  if (status === 'all') return missions;
  return missions.filter(m => m.status === status);
}

/**
 * Sort missions by priority
 *
 * @param missions - Array of missions
 * @returns Sorted missions (high priority first)
 */
export function sortMissionsByPriority(missions: Mission[]): Mission[] {
  const priorityOrder = { high: 3, normal: 2, low: 1 };
  return [...missions].sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
    return bPriority - aPriority;
  });
}

/**
 * Sort missions by status (active first, then available, then completed)
 *
 * @param missions - Array of missions
 * @returns Sorted missions
 */
export function sortMissionsByStatus(missions: Mission[]): Mission[] {
  const statusOrder: Record<MissionStatus, number> = {
    active: 4,
    available: 3,
    completed: 2,
    failed: 1,
    cancelled: 0
  };
  return [...missions].sort((a, b) => {
    return (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
  });
}

/**
 * Sort missions by date (newest first)
 *
 * @param missions - Array of missions
 * @returns Sorted missions
 */
export function sortMissionsByDate(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

/**
 * Filter cultural exchanges by status
 *
 * @param exchanges - Array of cultural exchanges
 * @param status - Status to filter by ('all' for all exchanges)
 * @returns Filtered exchanges
 */
export function filterExchangesByStatus(
  exchanges: CulturalExchange[] | undefined,
  status: ExchangeStatus | 'all'
): CulturalExchange[] {
  if (!exchanges) return [];
  if (status === 'all') return exchanges;
  return exchanges.filter(e => e.status === status);
}

/**
 * Sort cultural exchanges by type
 *
 * @param exchanges - Array of cultural exchanges
 * @returns Sorted exchanges
 */
export function sortExchangesByType(exchanges: CulturalExchange[]): CulturalExchange[] {
  return [...exchanges].sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * Sort cultural exchanges by date (newest first)
 *
 * @param exchanges - Array of cultural exchanges
 * @returns Sorted exchanges
 */
export function sortExchangesByDate(exchanges: CulturalExchange[]): CulturalExchange[] {
  return [...exchanges].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

/**
 * Calculate embassy strength percentage
 *
 * @param embassy - Embassy object
 * @returns Strength percentage (0-100)
 */
export function calculateEmbassyStrength(embassy: Embassy): number {
  return Math.min(100, Math.max(0, embassy.strength || 0));
}

/**
 * Calculate mission success probability based on difficulty and staff
 *
 * @param difficulty - Mission difficulty
 * @param staffCount - Number of staff assigned
 * @returns Success probability percentage (0-100)
 */
export function calculateMissionSuccessProbability(
  difficulty: MissionDifficulty,
  staffCount: number
): number {
  const baseChance: Record<MissionDifficulty, number> = {
    easy: 80,
    medium: 60,
    hard: 40,
    expert: 20
  };

  const base = baseChance[difficulty] || 50;
  const staffBonus = Math.min(20, (staffCount - 1) * 5); // 5% per additional staff, max 20%

  return Math.min(95, base + staffBonus);
}

/**
 * Validate treaty requirements
 *
 * @param embassyStrength - Embassy strength percentage
 * @param relationshipLevel - Relationship level (0-100)
 * @returns Whether treaty can be created
 */
export function validateTreatyRequirements(
  embassyStrength: number,
  relationshipLevel: number
): { valid: boolean; reason?: string } {
  if (embassyStrength < 30) {
    return { valid: false, reason: 'Embassy strength must be at least 30%' };
  }

  if (relationshipLevel < 50) {
    return { valid: false, reason: 'Relationship level must be at least 50%' };
  }

  return { valid: true };
}

/**
 * Calculate budget allocation impact
 *
 * @param currentBudget - Current embassy budget
 * @param additionalBudget - Budget to allocate
 * @returns Projected impact on embassy operations
 */
export function calculateBudgetAllocationImpact(
  currentBudget: number,
  additionalBudget: number
): {
  newBudget: number;
  percentageIncrease: number;
  estimatedStaffIncrease: number;
  estimatedStrengthBonus: number;
} {
  const newBudget = currentBudget + additionalBudget;
  const percentageIncrease = (additionalBudget / currentBudget) * 100;

  // Estimate 1 staff per 10k budget
  const estimatedStaffIncrease = Math.floor(additionalBudget / 10000);

  // Estimate 1% strength per 5k budget (capped at 10%)
  const estimatedStrengthBonus = Math.min(10, Math.floor(additionalBudget / 5000));

  return {
    newBudget,
    percentageIncrease,
    estimatedStaffIncrease,
    estimatedStrengthBonus
  };
}

/**
 * Get status color class for embassy status
 *
 * @param status - Embassy status
 * @returns CSS class string
 */
export function getEmbassyStatusColor(status: EmbassyStatus): string {
  const colors: Record<EmbassyStatus, string> = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    strengthening: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    neutral: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
    suspended: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    closed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
  };
  return colors[status] || colors.neutral;
}

/**
 * Get status color class for mission status
 *
 * @param status - Mission status
 * @returns CSS class string
 */
export function getMissionStatusColor(status: MissionStatus): string {
  const colors: Record<MissionStatus, string> = {
    active: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    cancelled: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    available: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
  };
  return colors[status] || colors.available;
}

/**
 * Get influence color class based on strength percentage
 *
 * @param strength - Strength percentage (0-100)
 * @returns CSS class string
 */
export function getInfluenceColor(strength: number): string {
  if (strength >= 75) return 'text-green-600';
  if (strength >= 50) return 'text-blue-600';
  if (strength >= 25) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get difficulty color class
 *
 * @param difficulty - Mission difficulty
 * @returns CSS class string
 */
export function getDifficultyColor(difficulty: MissionDifficulty): string {
  const colors: Record<MissionDifficulty, string> = {
    easy: 'text-green-600',
    medium: 'text-yellow-600',
    hard: 'text-orange-600',
    expert: 'text-red-600'
  };
  return colors[difficulty] || colors.medium;
}
