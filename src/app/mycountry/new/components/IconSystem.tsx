"use client";

import React from 'react';
import {
  // Core Navigation
  Crown,
  Globe,
  Command,
  Settings,
  
  // Economic & Analytics
  TrendingUp,
  BarChart3,
  DollarSign,
  PieChart,
  LineChart,
  
  // Population & Demographics
  Users,
  User,
  Building2,
  Home,
  
  // Governance & Diplomacy
  Shield,
  Flag,
  Briefcase,
  FileText,
  Scale,
  
  // Intelligence & Data
  Brain,
  Eye,
  Search,
  Database,
  Activity,
  
  // Time & Progress
  Clock,
  Calendar,
  Zap,
  Target,
  
  // Status & Notifications
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Star,
  Award,
  Trophy,
  
  // System & Technical
  Cog,
  Monitor,
  Wifi,
  Signal,
  
  // Navigation & Actions
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Upload,
  
  // Social & Communications
  MessageSquare,
  Mail,
  Phone,
  
  // Geography & Location
  MapPin,
  Map,
  Compass,
  
  // Special Effects
  Sparkles,
  Zap as Lightning,
  
  type LucideIcon
} from 'lucide-react';

// Icon category definitions for consistent usage
export const IconCategories = {
  // Primary navigation and system identity
  NAVIGATION: {
    mycountry: Crown,
    public: Globe,
    command: Command,
    settings: Settings,
  },
  
  // Economic and financial metrics
  ECONOMIC: {
    growth: TrendingUp,
    analytics: BarChart3,
    currency: DollarSign,
    distribution: PieChart,
    trends: LineChart,
  },
  
  // Population and demographics
  DEMOGRAPHIC: {
    population: Users,
    individual: User,
    infrastructure: Building2,
    housing: Home,
  },
  
  // Government and diplomacy
  GOVERNANCE: {
    security: Shield,
    sovereignty: Flag,
    administration: Briefcase,
    legislation: FileText,
    justice: Scale,
  },
  
  // Intelligence and strategic data
  INTELLIGENCE: {
    analysis: Brain,
    surveillance: Eye,
    research: Search,
    data: Database,
    monitoring: Activity,
  },
  
  // Time and temporal systems
  TEMPORAL: {
    time: Clock,
    schedule: Calendar,
    acceleration: Zap,
    objectives: Target,
  },
  
  // Status indicators and achievements
  STATUS: {
    notifications: Bell,
    warnings: AlertTriangle,
    success: CheckCircle,
    information: Info,
    rating: Star,
    recognition: Award,
    achievement: Trophy,
  },
  
  // Technical and system
  SYSTEM: {
    configuration: Cog,
    display: Monitor,
    connectivity: Wifi,
    performance: Signal,
  },
  
  // Interface navigation
  INTERFACE: {
    expand: ChevronRight,
    collapse: ChevronDown,
    minimize: ChevronUp,
    external: ExternalLink,
    import: Download,
    export: Upload,
  },
  
  // Communication and social
  COMMUNICATION: {
    messages: MessageSquare,
    email: Mail,
    phone: Phone,
  },
  
  // Geographic and spatial
  GEOGRAPHIC: {
    location: MapPin,
    territory: Map,
    navigation: Compass,
  },
  
  // Visual effects and emphasis
  EFFECTS: {
    highlight: Sparkles,
    energy: Lightning,
  },
} as const;

// Unified color themes for different system modules
export const IconThemes = {
  mycountry: {
    primary: 'text-amber-600',
    secondary: 'text-amber-500',
    muted: 'text-amber-400',
    background: 'bg-amber-50 dark:bg-amber-950/20',
  },
  executive: {
    primary: 'text-purple-600',
    secondary: 'text-purple-500',
    muted: 'text-purple-400',
    background: 'bg-purple-50 dark:bg-purple-950/20',
  },
  intelligence: {
    primary: 'text-blue-600',
    secondary: 'text-blue-500',
    muted: 'text-blue-400',
    background: 'bg-blue-50 dark:bg-blue-950/20',
  },
  analytics: {
    primary: 'text-green-600',
    secondary: 'text-green-500',
    muted: 'text-green-400',
    background: 'bg-green-50 dark:bg-green-950/20',
  },
  global: {
    primary: 'text-slate-600',
    secondary: 'text-slate-500',
    muted: 'text-slate-400',
    background: 'bg-slate-50 dark:bg-slate-950/20',
  },
  warning: {
    primary: 'text-red-600',
    secondary: 'text-red-500',
    muted: 'text-red-400',
    background: 'bg-red-50 dark:bg-red-950/20',
  },
} as const;

// Icon sizing standards
export const IconSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  xxl: 'h-12 w-12',
} as const;

// Utility component for consistent icon rendering
interface StandardIconProps {
  icon: LucideIcon;
  size?: keyof typeof IconSizes;
  theme?: keyof typeof IconThemes;
  variant?: 'primary' | 'secondary' | 'muted';
  className?: string;
}

export function StandardIcon({ 
  icon: Icon, 
  size = 'md', 
  theme = 'global', 
  variant = 'primary',
  className = '' 
}: StandardIconProps) {
  const sizeClass = IconSizes[size];
  const colorClass = IconThemes[theme][variant];
  
  return (
    <Icon className={`${sizeClass} ${colorClass} ${className}`} />
  );
}

// Context-aware icon selection helper
export function getContextIcon(context: string, category: keyof typeof IconCategories) {
  const icons = IconCategories[category];
  
  // Smart icon selection based on context
  switch (context) {
    case 'mycountry':
      return category === 'NAVIGATION' ? icons.mycountry || icons.public : Object.values(icons)[0];
    case 'executive':
      return category === 'GOVERNANCE' ? icons.administration || icons.security : Object.values(icons)[0];
    case 'intelligence':
      return category === 'INTELLIGENCE' ? icons.analysis || icons.surveillance : Object.values(icons)[0];
    case 'analytics':
      return category === 'ECONOMIC' ? icons.analytics || icons.trends : Object.values(icons)[0];
    default:
      return Object.values(icons)[0];
  }
}

// Section icon mapping for consistent dashboard-style layouts
export const SectionIcons = {
  // MyCountry specific sections
  'national-profile': IconCategories.NAVIGATION.mycountry,
  'executive-command': IconCategories.GOVERNANCE.administration,
  'strategic-focus': IconCategories.TEMPORAL.objectives,
  'achievements-rankings': IconCategories.STATUS.achievement,
  'national-timeline': IconCategories.INTELLIGENCE.analysis,
  'quick-actions': IconCategories.GOVERNANCE.administration,
  'key-metrics': IconCategories.ECONOMIC.analytics,
  'system-status': IconCategories.SYSTEM.performance,
  'external-links': IconCategories.INTERFACE.external,
  
  // Dashboard sections
  'global-intelligence': IconCategories.INTELLIGENCE.surveillance,
  'economic-intelligence': IconCategories.ECONOMIC.trends,
  'strategic-decision': IconCategories.GOVERNANCE.security,
  'activity-feed': IconCategories.STATUS.notifications,
  'command-center': IconCategories.NAVIGATION.command,
  
  // Recent additions
  'excellence-recognition': IconCategories.STATUS.achievement,
  'recent-activity': IconCategories.STATUS.notifications,
  
  // Missing icons for UnifiedLayout components
  'activity-rings': IconCategories.INTELLIGENCE.monitoring,
  'focus-cards': IconCategories.TEMPORAL.objectives,
  'achievements': IconCategories.STATUS.achievement,
  'milestones': IconCategories.STATUS.recognition,
} as const;

// Export commonly used icon sets for quick access
export const CommonIcons = {
  // Most frequently used across the app
  primary: IconCategories.NAVIGATION.mycountry,
  analytics: IconCategories.ECONOMIC.analytics,
  population: IconCategories.DEMOGRAPHIC.population,
  growth: IconCategories.ECONOMIC.growth,
  governance: IconCategories.GOVERNANCE.administration,
  intelligence: IconCategories.INTELLIGENCE.analysis,
  time: IconCategories.TEMPORAL.time,
  settings: IconCategories.NAVIGATION.settings,
  expand: IconCategories.INTERFACE.expand,
  collapse: IconCategories.INTERFACE.collapse,
} as const;

export default {
  IconCategories,
  IconThemes,
  IconSizes,
  StandardIcon,
  getContextIcon,
  SectionIcons,
  CommonIcons,
};