// Configuration file for Atomic Builder steps and constants
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

import { Crown, Flag, Building2, TrendingUp, CheckCircle, type LucideIcon } from 'lucide-react';

export type BuilderStep = 'foundation' | 'core' | 'government' | 'economics' | 'preview';

// Define the primary MyCountry gold theme
export const BUILDER_GOLD = 'from-amber-500 to-yellow-600';
export const BUILDER_GOLD_HOVER = 'hover:from-amber-600 hover:to-yellow-700';

export interface StepConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgGradient: string;
  borderColor: string;
  hoverColor: string;
  tip: string;
  help: string;
}

export const stepConfig: Record<BuilderStep, StepConfig> = {
  foundation: {
    title: 'Foundation',
    description: 'Choose your starting nation',
    icon: Crown,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Select a real-world nation as your foundation to inherit its basic characteristics',
    help: 'Choose a country that will serve as the foundation for your new nation. You\'ll inherit its basic economic and demographic characteristics which you can then customize.'
  },
  core: {
    title: 'Core Identity',
    description: 'Define national character',
    icon: Flag,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Establish your nation\'s identity and core economic metrics',
    help: 'Set up your nation\'s fundamental identity including name, symbols, and core economic indicators that will drive all other calculations.'
  },
  government: {
    title: 'Government',
    description: 'Design your structure',
    icon: Building2,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Build your government using atomic components that create emergent behaviors',
    help: 'Design your government structure using atomic components. Each component adds unique characteristics and behaviors to your nation.'
  },
  economics: {
    title: 'Economics',
    description: 'Configure systems',
    icon: TrendingUp,
    color: BUILDER_GOLD,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    hoverColor: 'hover:border-amber-500/40',
    tip: 'Fine-tune economic parameters, tax policies, and demographic settings',
    help: 'Configure detailed economic systems including sectors, labor markets, fiscal policy, tax structure, and demographics.'
  },
  preview: {
    title: 'Preview',
    description: 'Review & create',
    icon: CheckCircle,
    color: 'from-green-500 to-green-600',
    bgGradient: 'from-green-500/10 via-green-500/5 to-transparent',
    borderColor: 'border-green-500/20',
    hoverColor: 'hover:border-green-500/40',
    tip: 'Review all your configurations before creating your nation',
    help: 'Review all your selections and configurations. Make sure everything looks correct before finalizing your nation.'
  },
};

export const stepOrder: BuilderStep[] = ['foundation', 'core', 'government', 'economics', 'preview'];
