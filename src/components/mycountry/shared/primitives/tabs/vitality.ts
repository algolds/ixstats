import type React from "react";
import { Dollar as DollarSign, Group as Users, Globe, Building } from "iconoir-react";

export interface VitalityRing {
  id: string;
  label: string;
  value: number; // 0-100
  target?: number;
  color: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description?: string;
  onClick?: () => void;
}

function getAppleVitalityColor(score: number): string {
  if (score >= 80) return "var(--color-emerald-500)"; // Optimal
  if (score >= 65) return "var(--color-cyan-500)"; // Strong
  if (score >= 45) return "var(--color-amber-500)"; // Moderate
  return "var(--color-red-500)"; // Strained
}

/**
 * Helper function to create vitality rings from country data
 */
export function createVitalityRingsFromCountry(country: {
  economicVitality?: number | null;
  populationWellbeing?: number | null;
  diplomaticStanding?: number | null;
  governmentalEfficiency?: number | null;
}): VitalityRing[] {
  const econ = Number(country.economicVitality) || 0;
  const pop = Number(country.populationWellbeing) || 0;
  const diplo = Number(country.diplomaticStanding) || 0;
  const gov = Number(country.governmentalEfficiency) || 0;

  return [
    {
      id: "economic",
      label: "Economic",
      value: econ,
      color: getAppleVitalityColor(econ),
      icon: DollarSign,
      description: "Economic health",
    },
    {
      id: "population",
      label: "Wellbeing",
      value: pop,
      color: getAppleVitalityColor(pop),
      icon: Users,
      description: "Population wellbeing",
    },
    {
      id: "diplomatic",
      label: "Diplomatic",
      value: diplo,
      color: getAppleVitalityColor(diplo),
      icon: Globe,
      description: "Diplomatic standing",
    },
    {
      id: "government",
      label: "Efficiency",
      value: gov,
      color: getAppleVitalityColor(gov),
      icon: Building,
      description: "Government efficiency",
    },
  ];
}
