import React from "react";

/**
 * Common Base Interface for Atomic Components (Government & Economy)
 */
export interface BaseAtomicComponent<TType extends string = string> {
  id: string;
  type: TType;
  name: string;
  description: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity?: number;
  category: string;
  color?: string;
  icon: React.ComponentType<{ className?: string }>;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement?: string;
    staffRequired?: number;
    technologyRequired?: boolean;
  };
  synergies?: readonly TType[] | TType[];
  conflicts?: readonly TType[] | TType[];
}

export interface InteractionInfo<TType extends string = string> {
  type: TType;
  name: string;
  score?: number;
  description?: string;
}

export interface AtomicMetrics {
  totalComponents: number;
  totalEffectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  synergyCount: number;
  conflictCount: number;
}

export interface AtomicTemplate<TType extends string = string> {
  id: string;
  name: string;
  description?: string;
  components: readonly TType[] | TType[];
  icon?: React.ComponentType<{ className?: string }>;
}
