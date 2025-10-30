// Section configuration data

import { Flag, BarChart3, Users, Coins, Building2, Heart, Crown, TrendingUp } from "lucide-react";
import type { Section } from "../types/builder";

export const sections: Section[] = [
  // PHASE 1: Foundation & Core Identity
  {
    id: "core",
    name: "Core Indicators",
    icon: BarChart3,
    color: "text-[var(--color-brand-primary)]",
    description: "National symbols, name, GDP, population, growth rates",
    completeness: 90,
  },

  // PHASE 2: Government Structure
  {
    id: "structure",
    name: "Government Builder",
    icon: Crown,
    color: "text-[var(--color-accent)]",
    description: "Departments, ministries, budget allocation",
    completeness: 0,
  },
  {
    id: "government",
    name: "Government Spending",
    icon: Building2,
    color: "text-[var(--color-purple)]",
    description: "Education, healthcare, infrastructure",
    completeness: 85,
  },

  // PHASE 3: Economy & Fiscal
  {
    id: "economy",
    name: "Economy Builder",
    icon: TrendingUp,
    color: "text-emerald-600",
    description: "Employment, income, sectors, trade, productivity",
    completeness: 95,
  },
  {
    id: "fiscal",
    name: "Tax Builder",
    icon: Coins,
    color: "text-[var(--color-warning)]",
    description: "Taxes, budget, debt management",
    completeness: 80,
  },

  // PHASE 4: Detailed Metrics
  {
    id: "labor",
    name: "Labor & Employment",
    icon: Users,
    color: "text-[var(--color-success)]",
    description: "Employment, wages, workforce",
    completeness: 75,
  },
  {
    id: "demographics",
    name: "Demographics",
    icon: Heart,
    color: "text-[var(--color-error)]",
    description: "Age distribution, social structure",
    completeness: 70,
  },

  // Optional: National Identity (can be integrated into Core Indicators)
  {
    id: "symbols",
    name: "National Identity",
    icon: Flag,
    color: "text-[var(--color-warning)]",
    description: "Flag, symbols, government type, culture",
    completeness: 95,
  },
];
