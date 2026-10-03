"use client";

import React from "react";

// CORE INTERFACES

export interface UnifiedAtomicComponent {
  id: string;
  name: string;
  category: string;
  description: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  prerequisites: string[];
  synergies: string[];
  conflicts: string[];
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode; // Optional custom icon component or JSX element
}

export interface AtomicComponentTheme {
  type: "unified" | "category-based";

  // For unified themes (tax=gold, government=blue)
  primary?: string; // e.g., 'gold' or 'blue'

  // For category-based themes (economy)
  categoryColors?: Record<string, string>; // e.g., { 'economicModel': 'emerald' }
}

export interface EffectivenessMetrics {
  baseEffectiveness: number;
  synergyBonus: number;
  conflictPenalty: number;
  totalEffectiveness: number;
  synergyCount: number;
  conflictCount: number;
}

// COMPONENT SELECTOR PROPS

export interface UnifiedAtomicComponentSelectorProps<T extends string> {
  // Data
  components: Record<string, UnifiedAtomicComponent>;
  categories: Record<string, string[]>;
  selectedComponents: T[];
  onComponentChange: (components: T[]) => void;

  maxComponents?: number;
  isReadOnly?: boolean;

  // Theming
  theme: AtomicComponentTheme;
  systemName: string;
  systemIcon: React.ComponentType<{ className?: string }>;

  // Synergy/Conflict Calculations
  calculateEffectiveness: (selected: T[]) => EffectivenessMetrics;
  checkSynergy: (comp1: string, comp2: string) => number;
  checkConflict: (comp1: string, comp2: string) => boolean;
}

// COMPONENT CARD PROPS

export interface UnifiedAtomicCardProps {
  component: UnifiedAtomicComponent;
  isSelected: boolean;
  onToggle: () => void;
  isDisabled?: boolean;
  hasConflict?: boolean;
  hasSynergy?: boolean;
  theme: AtomicComponentTheme;
  className?: string;
}
