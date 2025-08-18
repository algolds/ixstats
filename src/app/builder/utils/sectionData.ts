// Section configuration data

import {
  Flag,
  BarChart3,
  Users,
  Coins,
  Building2,
  Heart
} from 'lucide-react';
import type { Section } from '../types/builder';

export const sections: Section[] = [
  {
    id: 'symbols',
    name: 'National Symbols',
    icon: Flag,
    color: 'text-[var(--color-warning)]',
    description: 'Flag, coat of arms, national identity',
    completeness: 95
  },
  {
    id: 'core',
    name: 'Core Indicators',
    icon: BarChart3,
    color: 'text-[var(--color-brand-primary)]',
    description: 'GDP, population, growth rates',
    completeness: 90
  },
  {
    id: 'labor',
    name: 'Labor & Employment',
    icon: Users,
    color: 'text-[var(--color-success)]',
    description: 'Employment, wages, workforce',
    completeness: 75
  },
  {
    id: 'fiscal',
    name: 'Fiscal System',
    icon: Coins,
    color: 'text-[var(--color-warning)]',
    description: 'Taxes, budget, debt management',
    completeness: 80
  },
  {
    id: 'government',
    name: 'Government Spending',
    icon: Building2,
    color: 'text-[var(--color-purple)]',
    description: 'Education, healthcare, infrastructure',
    completeness: 85
  },
  {
    id: 'demographics',
    name: 'Demographics',
    icon: Heart,
    color: 'text-[var(--color-error)]',
    description: 'Age distribution, social structure',
    completeness: 70
  }
];