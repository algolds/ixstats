/**
 * Utility functions for embassy calculations
 * Handles mission progress, time remaining, efficiency, and budget calculations
 */

import type { EmbassyMission, EmbassyGameMode } from "~/types/diplomatic-network";

/**
 * Calculate mission progress percentage
 * @param mission - The embassy mission
 * @returns Progress percentage (0-100)
 */
export function calculateMissionProgress(mission: EmbassyMission): number {
  if (!mission.startedAt) return 0;

  const startTime = new Date(mission.startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = mission.duration * 60 * 60 * 1000; // Convert hours to milliseconds

  const elapsed = now - startTime;
  const progress = Math.min((elapsed / durationMs) * 100, 100);

  return Math.max(0, progress);
}

/**
 * Calculate time remaining for a mission
 * @param startedAt - Mission start time
 * @param duration - Mission duration in hours
 * @returns Formatted time remaining string
 */
export function calculateTimeRemaining(startedAt: string, duration: number): string {
  const startTime = new Date(startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = duration * 60 * 60 * 1000; // Convert hours to milliseconds
  const endTime = startTime + durationMs;

  const remaining = endTime - now;

  if (remaining <= 0) return "Ready to complete";

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Calculate embassy efficiency percentage
 * @param embassy - The embassy data
 * @returns Efficiency percentage (0-100)
 */
export function calculateEmbassyEfficiency(embassy: EmbassyGameMode): number {
  const baseEfficiency = 50;
  const levelBonus = embassy.level * 5;
  const influenceBonus = Math.min((embassy.influence || 0) / 1000, 20);
  const securityBonus = getSecurityBonus(embassy.securityLevel);
  const statusPenalty = getStatusPenalty(embassy.status);

  const efficiency = baseEfficiency + levelBonus + influenceBonus + securityBonus - statusPenalty;

  return Math.min(Math.max(efficiency, 0), 100);
}

/**
 * Get security level bonus for efficiency calculation
 */
function getSecurityBonus(securityLevel: string): number {
  switch (securityLevel) {
    case 'MAXIMUM': return 15;
    case 'HIGH': return 10;
    case 'MEDIUM': return 5;
    case 'LOW': return 0;
    default: return 0;
  }
}

/**
 * Get status penalty for efficiency calculation
 */
function getStatusPenalty(status: string): number {
  switch (status) {
    case 'SUSPENDED': return 50;
    case 'MAINTENANCE': return 25;
    case 'CLOSED': return 100;
    case 'ACTIVE': return 0;
    default: return 0;
  }
}

/**
 * Calculate months remaining based on budget and maintenance cost
 * @param budget - Current embassy budget
 * @param maintenanceCost - Monthly maintenance cost
 * @returns Number of months remaining
 */
export function calculateMonthsRemaining(budget: number, maintenanceCost: number): number {
  if (maintenanceCost <= 0) return 999;
  return Math.floor(budget / maintenanceCost);
}

/**
 * Check if maintenance is due for an embassy
 * @param lastMaintenance - Last maintenance date (optional)
 * @param nextMaintenance - Next scheduled maintenance date (optional)
 * @returns True if maintenance is due
 */
export function isMaintenanceDue(lastMaintenance?: string, nextMaintenance?: string): boolean {
  if (!nextMaintenance) return false;

  const now = new Date().getTime();
  const nextMaintenanceTime = new Date(nextMaintenance).getTime();

  return now >= nextMaintenanceTime;
}

/**
 * Check if embassy is inefficient (below 60% efficiency)
 * @param embassy - The embassy data
 * @returns True if inefficient
 */
export function isInefficient(embassy: EmbassyGameMode): boolean {
  return calculateEmbassyEfficiency(embassy) < 60;
}

/**
 * Calculate experience needed for next level
 * @param currentLevel - Current embassy level
 * @returns Experience points needed for next level
 */
export function calculateExperienceForNextLevel(currentLevel: number): number {
  return currentLevel * 1000;
}

/**
 * Calculate level progress percentage
 * @param experience - Current experience points
 * @param level - Current level
 * @returns Progress percentage to next level (0-100)
 */
export function calculateLevelProgress(experience: number, level: number): number {
  const requiredExp = calculateExperienceForNextLevel(level);
  return Math.min((experience / requiredExp) * 100, 100);
}
