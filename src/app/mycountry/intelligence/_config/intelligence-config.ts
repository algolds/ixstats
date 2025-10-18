// Intelligence Center Configuration Constants

import {
  AlertTriangle,
  Activity,
  DollarSign,
  Users,
  Globe,
  Building,
  Shield,
  TrendingUp,
  Target,
} from 'lucide-react';

export const severityConfig = {
  critical: {
    color: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    badge: 'bg-red-500 text-white',
    icon: AlertTriangle
  },
  warning: {
    color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    badge: 'bg-yellow-500 text-white',
    icon: AlertTriangle
  },
  info: {
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    badge: 'bg-blue-500 text-white',
    icon: Activity
  },
  success: {
    color: 'border-green-500 bg-green-50 dark:bg-green-950/20',
    badge: 'bg-green-500 text-white',
    icon: Shield
  }
} as const;

export const areaConfig = {
  economic: { icon: DollarSign, label: 'Economic', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  population: { icon: Users, label: 'Population', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/20' },
  diplomatic: { icon: Globe, label: 'Diplomatic', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
  governance: { icon: Building, label: 'Governance', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' }
} as const;

export const briefingTypeConfig = {
  hot_issue: { icon: AlertTriangle, label: 'Hot Issue', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
  opportunity: { icon: TrendingUp, label: 'Opportunity', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' },
  risk_mitigation: { icon: Shield, label: 'Risk Mitigation', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
  strategic_initiative: { icon: Target, label: 'Strategic', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' }
} as const;

export type AreaType = keyof typeof areaConfig;
export type BriefingType = keyof typeof briefingTypeConfig;
export type SeverityType = keyof typeof severityConfig;
