"use client";

import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Users,
  Shield,
  Crown,
  Vote,
  Clock,
  TrendingUp,
  Star,
  Cross,
  Briefcase,
  Scale,
  Flag,
  Cpu,
  Eye,
  DollarSign,
  Target,
  BarChart3,
  Heart,
  Leaf,
  Brain,
  Monitor,
  Globe,
  Network,
  Award,
  CheckCircle,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Handshake,
  Microscope,
  Lightbulb,
  ArrowRightLeft,
  Copyright,
  Zap,
  Wifi,
  MessageSquare,
  RefreshCw,
  HelpCircle,
  Atom,
  Info,
  Blocks,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { UnifiedAtomicComponentSelector } from '~/components/atomic/shared/UnifiedAtomicComponentSelector';
import { GOVERNMENT_THEME } from '~/components/atomic/shared/themes';
import type { EffectivenessMetrics } from '~/components/atomic/shared/types';
import { ComponentType } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

// Re-export ComponentType for convenience
export { ComponentType };

// Atomic Government Component Types
export interface AtomicGovernmentComponent {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
  prerequisites: string[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  metadata: {
    complexity: 'Low' | 'Medium' | 'High';
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
}

// Atomic Component Library
export const ATOMIC_COMPONENTS: Partial<Record<ComponentType, AtomicGovernmentComponent>> = {
  // Power Distribution
  [ComponentType.CENTRALIZED_POWER]: {
    id: 'centralized_power',
    type: ComponentType.CENTRALIZED_POWER,
    name: 'Centralized Power Structure',
    description: 'Central government controls most policy decisions and administration',
    effectiveness: 85,
    synergies: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    conflicts: [ComponentType.FEDERAL_SYSTEM, ComponentType.CONSENSUS_PROCESS],
    implementationCost: 100000,
    maintenanceCost: 50000,
    requiredCapacity: 75,
    category: 'general',
    prerequisites: [],
    color: 'blue',
    icon: Settings,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 25,
      technologyRequired: false
    }
  },
  
  [ComponentType.FEDERAL_SYSTEM]: {
    id: 'federal_system',
    type: ComponentType.FEDERAL_SYSTEM,
    name: 'Federal Power Distribution',
    description: 'Power shared between national and regional governments with defined spheres',
    effectiveness: 78,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.CENTRALIZED_POWER, ComponentType.AUTOCRATIC_PROCESS],
    implementationCost: 150000,
    maintenanceCost: 75000,
    requiredCapacity: 85,
    category: 'governance',
    prerequisites: [],
    color: 'blue',
    icon: Building2,
    metadata: {
      complexity: 'High',
      timeToImplement: '24 months',
      staffRequired: 40,
      technologyRequired: true
    }
  },
  
  [ComponentType.CONFEDERATE_SYSTEM]: {
    id: 'confederate_system',
    type: ComponentType.CONFEDERATE_SYSTEM,
    name: 'Confederate System',
    description: 'Loose alliance of autonomous regions with minimal central authority',
    effectiveness: 65,
    synergies: [ComponentType.CONSENSUS_PROCESS, ComponentType.TRADITIONAL_LEGITIMACY],
    conflicts: [ComponentType.CENTRALIZED_POWER, ComponentType.PROFESSIONAL_BUREAUCRACY],
    implementationCost: 80000,
    maintenanceCost: 40000,
    requiredCapacity: 60,
    category: 'governance',
    prerequisites: [],
    color: 'blue',
    icon: Building2,
    metadata: {
      complexity: 'Low',
      timeToImplement: '12 months',
      staffRequired: 15,
      technologyRequired: false
    }
  },
  
  [ComponentType.UNITARY_SYSTEM]: {
    id: 'unitary_system',
    type: ComponentType.UNITARY_SYSTEM,
    name: 'Unitary Government',
    description: 'Single level of government with local administration as extensions',
    effectiveness: 82,
    synergies: [ComponentType.CENTRALIZED_POWER, ComponentType.PROFESSIONAL_BUREAUCRACY],
    conflicts: [ComponentType.FEDERAL_SYSTEM, ComponentType.CONFEDERATE_SYSTEM],
    implementationCost: 90000,
    maintenanceCost: 45000,
    requiredCapacity: 70,
    category: 'governance',
    prerequisites: [],
    color: 'blue',
    icon: Building2,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  // Decision Process
  [ComponentType.DEMOCRATIC_PROCESS]: {
    id: 'democratic_process',
    type: ComponentType.DEMOCRATIC_PROCESS,
    name: 'Democratic Decision Making',
    description: 'Decisions made through elected representatives and majority rule',
    effectiveness: 75,
    synergies: [ComponentType.ELECTORAL_LEGITIMACY, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ADMINISTRATION],
    implementationCost: 120000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: 'process',
    prerequisites: [],
    color: 'green',
    icon: Users,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 12,
      technologyRequired: true
    }
  },
  
  [ComponentType.AUTOCRATIC_PROCESS]: {
    id: 'autocratic_process',
    type: ComponentType.AUTOCRATIC_PROCESS,
    name: 'Autocratic Decision Making',
    description: 'Centralized decision making by a single leader or small group',
    effectiveness: 88,
    synergies: [ComponentType.CENTRALIZED_POWER, ComponentType.CHARISMATIC_LEGITIMACY],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.CONSENSUS_PROCESS],
    implementationCost: 80000,
    maintenanceCost: 40000,
    requiredCapacity: 65,
    category: 'process',
    prerequisites: [],
    color: 'red',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: false
    }
  },
  
  [ComponentType.TECHNOCRATIC_PROCESS]: {
    id: 'technocratic_process',
    type: ComponentType.TECHNOCRATIC_PROCESS,
    name: 'Technocratic Decision Making',
    description: 'Decisions based on expert knowledge and technical competence',
    effectiveness: 85,
    synergies: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.CHARISMATIC_LEGITIMACY, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 140000,
    maintenanceCost: 70000,
    requiredCapacity: 90,
    category: 'process',
    prerequisites: [],
    color: 'purple',
    icon: Settings,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.CONSENSUS_PROCESS]: {
    id: 'consensus_process',
    type: ComponentType.CONSENSUS_PROCESS,
    name: 'Consensus Decision Making',
    description: 'Decisions require broad agreement among stakeholders',
    effectiveness: 70,
    synergies: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CONFEDERATE_SYSTEM],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.CENTRALIZED_POWER],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 75,
    category: 'process',
    prerequisites: [],
    color: 'green',
    icon: Users,
    metadata: {
      complexity: 'Low',
      timeToImplement: '6-12 months',
      staffRequired: 5,
      technologyRequired: false
    }
  },
  
  [ComponentType.OLIGARCHIC_PROCESS]: {
    id: 'oligarchic_process',
    type: ComponentType.OLIGARCHIC_PROCESS,
    name: 'Oligarchic Decision Making',
    description: 'Small group of elites controls decision making processes',
    effectiveness: 80,
    synergies: [ComponentType.ECONOMIC_INCENTIVES, ComponentType.SURVEILLANCE_SYSTEM],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    implementationCost: 90000,
    maintenanceCost: 45000,
    requiredCapacity: 70,
    category: 'process',
    prerequisites: [],
    color: 'orange',
    icon: Crown,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  // Legitimacy Sources
  [ComponentType.ELECTORAL_LEGITIMACY]: {
    id: 'electoral_legitimacy',
    type: ComponentType.ELECTORAL_LEGITIMACY,
    name: 'Electoral Legitimacy',
    description: 'Authority derived from free and fair elections',
    effectiveness: 80,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ADMINISTRATION],
    implementationCost: 110000,
    maintenanceCost: 70000,
    requiredCapacity: 85,
    category: 'legitimacy',
    prerequisites: [],
    color: 'green',
    icon: Vote,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 11,
      technologyRequired: true
    }
  },
  
  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    id: 'traditional_legitimacy',
    type: ComponentType.TRADITIONAL_LEGITIMACY,
    name: 'Traditional Legitimacy',
    description: 'Authority based on historical customs and established traditions',
    effectiveness: 75,
    synergies: [ComponentType.CONSENSUS_PROCESS, ComponentType.RELIGIOUS_LEGITIMACY],
    conflicts: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_LEGITIMACY],
    implementationCost: 70000,
    maintenanceCost: 30000,
    requiredCapacity: 60,
    category: 'legitimacy',
    prerequisites: [],
    color: 'amber',
    icon: Clock,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    id: 'performance_legitimacy',
    type: ComponentType.PERFORMANCE_LEGITIMACY,
    name: 'Performance Legitimacy',
    description: 'Authority based on effective governance and policy outcomes',
    effectiveness: 85,
    synergies: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CHARISMATIC_LEGITIMACY],
    implementationCost: 130000,
    maintenanceCost: 80000,
    requiredCapacity: 90,
    category: 'legitimacy',
    prerequisites: [],
    color: 'blue',
    icon: TrendingUp,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    id: 'charismatic_legitimacy',
    type: ComponentType.CHARISMATIC_LEGITIMACY,
    name: 'Charismatic Legitimacy',
    description: 'Authority based on personal qualities and leadership appeal',
    effectiveness: 82,
    synergies: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.SOCIAL_PRESSURE],
    conflicts: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.INSTITUTIONAL_LEGITIMACY],
    implementationCost: 60000,
    maintenanceCost: 90000,
    requiredCapacity: 70,
    category: 'legitimacy',
    prerequisites: [],
    color: 'purple',
    icon: Star,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    id: 'religious_legitimacy',
    type: ComponentType.RELIGIOUS_LEGITIMACY,
    name: 'Religious Legitimacy',
    description: 'Authority derived from religious or spiritual mandate',
    effectiveness: 78,
    synergies: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.SOCIAL_PRESSURE],
    conflicts: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    implementationCost: 80000,
    maintenanceCost: 40000,
    requiredCapacity: 65,
    category: 'legitimacy',
    prerequisites: [],
    color: 'amber',
    icon: Cross,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  // Institution Components
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    id: 'professional_bureaucracy',
    type: ComponentType.PROFESSIONAL_BUREAUCRACY,
    name: 'Professional Bureaucracy',
    description: 'Merit-based civil service with standardized procedures',
    effectiveness: 88,
    synergies: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.MILITARY_ADMINISTRATION],
    implementationCost: 150000,
    maintenanceCost: 100000,
    requiredCapacity: 95,
    category: 'administration',
    prerequisites: [],
    color: 'blue',
    icon: Briefcase,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.MILITARY_ADMINISTRATION]: {
    id: 'military_administration',
    type: ComponentType.MILITARY_ADMINISTRATION,
    name: 'Military Administration',
    description: 'Government administration controlled by military hierarchy',
    effectiveness: 85,
    synergies: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ENFORCEMENT],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.INDEPENDENT_JUDICIARY],
    implementationCost: 100000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: 'administration',
    prerequisites: [],
    color: 'red',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.INDEPENDENT_JUDICIARY]: {
    id: 'independent_judiciary',
    type: ComponentType.INDEPENDENT_JUDICIARY,
    name: 'Independent Judiciary',
    description: 'Autonomous court system free from political interference',
    effectiveness: 90,
    synergies: [ComponentType.RULE_OF_LAW, ComponentType.ELECTORAL_LEGITIMACY],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ADMINISTRATION],
    implementationCost: 120000,
    maintenanceCost: 80000,
    requiredCapacity: 85,
    category: 'administration',
    prerequisites: [],
    color: 'green',
    icon: Scale,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.PARTISAN_INSTITUTIONS]: {
    id: 'partisan_institutions',
    type: ComponentType.PARTISAN_INSTITUTIONS,
    name: 'Partisan Institutions',
    description: 'Government institutions staffed based on political loyalty',
    effectiveness: 70,
    synergies: [ComponentType.OLIGARCHIC_PROCESS, ComponentType.ECONOMIC_INCENTIVES],
    conflicts: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.INDEPENDENT_JUDICIARY],
    implementationCost: 80000,
    maintenanceCost: 50000,
    requiredCapacity: 65,
    category: 'administration',
    prerequisites: [],
    color: 'orange',
    icon: Flag,
    metadata: {
      complexity: 'Low',
      timeToImplement: '6-12 months',
      staffRequired: 5,
      technologyRequired: false
    }
  },
  
  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    id: 'technocratic_agencies',
    type: ComponentType.TECHNOCRATIC_AGENCIES,
    name: 'Technocratic Agencies',
    description: 'Specialized agencies run by technical experts',
    effectiveness: 92,
    synergies: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_LEGITIMACY],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.PARTISAN_INSTITUTIONS],
    implementationCost: 160000,
    maintenanceCost: 120000,
    requiredCapacity: 95,
    category: 'administration',
    prerequisites: [],
    color: 'purple',
    icon: Cpu,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  // Control Mechanisms
  [ComponentType.RULE_OF_LAW]: {
    id: 'rule_of_law',
    type: ComponentType.RULE_OF_LAW,
    name: 'Rule of Law',
    description: 'Legal framework with consistent application and enforcement',
    effectiveness: 92,
    synergies: [ComponentType.INDEPENDENT_JUDICIARY, ComponentType.PROFESSIONAL_BUREAUCRACY],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ENFORCEMENT],
    implementationCost: 140000,
    maintenanceCost: 90000,
    requiredCapacity: 90,
    category: 'legal',
    prerequisites: [],
    color: 'green',
    icon: Scale,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },
  
  [ComponentType.SURVEILLANCE_SYSTEM]: {
    id: 'surveillance_system',
    type: ComponentType.SURVEILLANCE_SYSTEM,
    name: 'Surveillance System',
    description: 'Monitoring and information gathering apparatus',
    effectiveness: 85,
    synergies: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.OLIGARCHIC_PROCESS],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    implementationCost: 120000,
    maintenanceCost: 80000,
    requiredCapacity: 75,
    category: 'security',
    prerequisites: [],
    color: 'red',
    icon: Eye,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: false
    }
  },
  
  [ComponentType.ECONOMIC_INCENTIVES]: {
    id: 'economic_incentives',
    type: ComponentType.ECONOMIC_INCENTIVES,
    name: 'Economic Incentives',
    description: 'Material rewards and punishments to ensure compliance',
    effectiveness: 80,
    synergies: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.OLIGARCHIC_PROCESS],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.RELIGIOUS_LEGITIMACY],
    implementationCost: 110000,
    maintenanceCost: 70000,
    requiredCapacity: 75,
    category: 'economic',
    prerequisites: [],
    color: 'green',
    icon: DollarSign,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 11,
      technologyRequired: false
    }
  },
  
  [ComponentType.SOCIAL_PRESSURE]: {
    id: 'social_pressure',
    type: ComponentType.SOCIAL_PRESSURE,
    name: 'Social Pressure',
    description: 'Community norms and peer influence for behavioral control',
    effectiveness: 75,
    synergies: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CONSENSUS_PROCESS],
    conflicts: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
    implementationCost: 60000,
    maintenanceCost: 30000,
    requiredCapacity: 55,
    category: 'social',
    prerequisites: [],
    color: 'purple',
    icon: Users,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },
  
  [ComponentType.MILITARY_ENFORCEMENT]: {
    id: 'military_enforcement',
    type: ComponentType.MILITARY_ENFORCEMENT,
    name: 'Military Enforcement',
    description: 'Use of military force to maintain order and compliance',
    effectiveness: 90,
    synergies: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ADMINISTRATION],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 85,
    category: 'security',
    prerequisites: [],
    color: 'red',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  // Economic Governance Components
  [ComponentType.FREE_MARKET_SYSTEM]: {
    id: 'free_market_system',
    type: ComponentType.FREE_MARKET_SYSTEM,
    name: 'Free Market System',
    description: 'Market-driven economy with minimal government intervention',
    effectiveness: 85,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ECONOMIC_INCENTIVES],
    conflicts: [ComponentType.PLANNED_ECONOMY, ComponentType.WELFARE_STATE],
    implementationCost: 80000,
    maintenanceCost: 40000,
    requiredCapacity: 70,
    category: 'economic',
    prerequisites: [],
    color: 'green',
    icon: TrendingUp,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: false
    }
  },

  [ComponentType.PLANNED_ECONOMY]: {
    id: 'planned_economy',
    type: ComponentType.PLANNED_ECONOMY,
    name: 'Planned Economy',
    description: 'Centralized economic planning and resource allocation',
    effectiveness: 75,
    synergies: [ComponentType.CENTRALIZED_POWER, ComponentType.TECHNOCRATIC_PROCESS],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.ECONOMIC_INCENTIVES],
    implementationCost: 120000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: 'economic',
    prerequisites: [],
    color: 'red',
    icon: Target,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 12,
      technologyRequired: true
    }
  },

  [ComponentType.MIXED_ECONOMY]: {
    id: 'mixed_economy',
    type: ComponentType.MIXED_ECONOMY,
    name: 'Mixed Economy',
    description: 'Combination of market forces and government intervention',
    effectiveness: 80,
    synergies: [ComponentType.SOCIAL_MARKET_ECONOMY, ComponentType.DEMOCRATIC_PROCESS],
    conflicts: [ComponentType.PLANNED_ECONOMY, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 90000,
    maintenanceCost: 60000,
    requiredCapacity: 75,
    category: 'economic',
    prerequisites: [],
    color: 'blue',
    icon: BarChart3,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },

  [ComponentType.CORPORATIST_SYSTEM]: {
    id: 'corporatist_system',
    type: ComponentType.CORPORATIST_SYSTEM,
    name: 'Corporatist System',
    description: 'Economic system organized by interest groups and corporations',
    effectiveness: 78,
    synergies: [ComponentType.OLIGARCHIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 95000,
    maintenanceCost: 70000,
    requiredCapacity: 80,
    category: 'economic',
    prerequisites: [],
    color: 'orange',
    icon: Building2,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.SOCIAL_MARKET_ECONOMY]: {
    id: 'social_market_economy',
    type: ComponentType.SOCIAL_MARKET_ECONOMY,
    name: 'Social Market Economy',
    description: 'Market economy with strong social safety nets and regulation',
    effectiveness: 88,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.WELFARE_STATE],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.PLANNED_ECONOMY],
    implementationCost: 110000,
    maintenanceCost: 80000,
    requiredCapacity: 85,
    category: 'economic',
    prerequisites: [],
    color: 'blue',
    icon: Heart,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.STATE_CAPITALISM]: {
    id: 'state_capitalism',
    type: ComponentType.STATE_CAPITALISM,
    name: 'State Capitalism',
    description: 'Capitalist economy with significant state ownership and control',
    effectiveness: 82,
    synergies: [ComponentType.CENTRALIZED_POWER, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.DEMOCRATIC_PROCESS],
    implementationCost: 100000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'economic',
    prerequisites: [],
    color: 'red',
    icon: Building2,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.RESOURCE_BASED_ECONOMY]: {
    id: 'resource_based_economy',
    type: ComponentType.RESOURCE_BASED_ECONOMY,
    name: 'Resource-Based Economy',
    description: 'Economy dependent on natural resource extraction and export',
    effectiveness: 70,
    synergies: [ComponentType.STATE_CAPITALISM, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.KNOWLEDGE_ECONOMY, ComponentType.INNOVATION_ECOSYSTEM],
    implementationCost: 85000,
    maintenanceCost: 60000,
    requiredCapacity: 75,
    category: 'economic',
    prerequisites: [],
    color: 'amber',
    icon: Leaf,
    metadata: {
      complexity: 'Low',
      timeToImplement: '6-12 months',
      staffRequired: 5,
      technologyRequired: false
    }
  },

  [ComponentType.KNOWLEDGE_ECONOMY]: {
    id: 'knowledge_economy',
    type: ComponentType.KNOWLEDGE_ECONOMY,
    name: 'Knowledge Economy',
    description: 'Economy based on knowledge, innovation, and intellectual capital',
    effectiveness: 92,
    synergies: [ComponentType.RESEARCH_AND_DEVELOPMENT, ComponentType.INNOVATION_ECOSYSTEM],
    conflicts: [ComponentType.RESOURCE_BASED_ECONOMY, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 140000,
    maintenanceCost: 120000,
    requiredCapacity: 95,
    category: 'economic',
    prerequisites: [],
    color: 'purple',
    icon: Brain,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  // Administrative Efficiency Components
  [ComponentType.DIGITAL_GOVERNMENT]: {
    id: 'digital_government',
    type: ComponentType.DIGITAL_GOVERNMENT,
    name: 'Digital Government',
    description: 'Government services delivered through digital platforms',
    effectiveness: 88,
    synergies: [ComponentType.E_GOVERNANCE, ComponentType.PERFORMANCE_MANAGEMENT],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.SOCIAL_PRESSURE],
    implementationCost: 130000,
    maintenanceCost: 100000,
    requiredCapacity: 90,
    category: 'technology',
    prerequisites: [],
    color: 'purple',
    icon: Monitor,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.E_GOVERNANCE]: {
    id: 'e_governance',
    type: ComponentType.E_GOVERNANCE,
    name: 'E-Governance',
    description: 'Electronic governance and citizen participation systems',
    effectiveness: 85,
    synergies: [ComponentType.DIGITAL_GOVERNMENT, ComponentType.DEMOCRATIC_PROCESS],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 120000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: 'technology',
    prerequisites: [],
    color: 'blue',
    icon: Globe,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.ADMINISTRATIVE_DECENTRALIZATION]: {
    id: 'administrative_decentralization',
    type: ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    name: 'Administrative Decentralization',
    description: 'Delegation of administrative functions to local levels',
    effectiveness: 82,
    synergies: [ComponentType.FEDERAL_SYSTEM, ComponentType.CONSENSUS_PROCESS],
    conflicts: [ComponentType.CENTRALIZED_POWER, ComponentType.AUTOCRATIC_PROCESS],
    implementationCost: 90000,
    maintenanceCost: 70000,
    requiredCapacity: 80,
    category: 'administration',
    prerequisites: [],
    color: 'green',
    icon: Network,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.MERIT_BASED_SYSTEM]: {
    id: 'merit_based_system',
    type: ComponentType.MERIT_BASED_SYSTEM,
    name: 'Merit-Based System',
    description: 'Government positions filled based on merit and qualifications',
    effectiveness: 90,
    synergies: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.PERFORMANCE_LEGITIMACY],
    conflicts: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 110000,
    maintenanceCost: 85000,
    requiredCapacity: 90,
    category: 'administration',
    prerequisites: [],
    color: 'blue',
    icon: Award,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.PERFORMANCE_MANAGEMENT]: {
    id: 'performance_management',
    type: ComponentType.PERFORMANCE_MANAGEMENT,
    name: 'Performance Management',
    description: 'Systematic monitoring and improvement of government performance',
    effectiveness: 87,
    synergies: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.QUALITY_ASSURANCE],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CHARISMATIC_LEGITIMACY],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 85,
    category: 'administration',
    prerequisites: [],
    color: 'blue',
    icon: BarChart3,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.QUALITY_ASSURANCE]: {
    id: 'quality_assurance',
    type: ComponentType.QUALITY_ASSURANCE,
    name: 'Quality Assurance',
    description: 'Systematic quality control and improvement processes',
    effectiveness: 85,
    synergies: [ComponentType.PERFORMANCE_MANAGEMENT, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 95000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'administration',
    prerequisites: [],
    color: 'green',
    icon: CheckCircle,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.STRATEGIC_PLANNING]: {
    id: 'strategic_planning',
    type: ComponentType.STRATEGIC_PLANNING,
    name: 'Strategic Planning',
    description: 'Long-term strategic planning and policy coordination',
    effectiveness: 88,
    synergies: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_MANAGEMENT],
    conflicts: [ComponentType.CONSENSUS_PROCESS, ComponentType.CHARISMATIC_LEGITIMACY],
    implementationCost: 105000,
    maintenanceCost: 85000,
    requiredCapacity: 85,
    category: 'planning',
    prerequisites: [],
    color: 'purple',
    icon: Target,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.RISK_MANAGEMENT]: {
    id: 'risk_management',
    type: ComponentType.RISK_MANAGEMENT,
    name: 'Risk Management',
    description: 'Systematic identification and mitigation of government risks',
    effectiveness: 83,
    synergies: [ComponentType.STRATEGIC_PLANNING, ComponentType.EMERGENCY_RESPONSE],
    conflicts: [ComponentType.CHARISMATIC_LEGITIMACY, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 90000,
    maintenanceCost: 70000,
    requiredCapacity: 80,
    category: 'planning',
    prerequisites: [],
    color: 'orange',
    icon: AlertTriangle,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  // Social Policy Components
  [ComponentType.WELFARE_STATE]: {
    id: 'welfare_state',
    type: ComponentType.WELFARE_STATE,
    name: 'Welfare State',
    description: 'Comprehensive social welfare and safety net programs',
    effectiveness: 85,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SOCIAL_MARKET_ECONOMY],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.AUTOCRATIC_PROCESS],
    implementationCost: 120000,
    maintenanceCost: 100000,
    requiredCapacity: 85,
    category: 'social',
    prerequisites: [],
    color: 'blue',
    icon: Heart,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.UNIVERSAL_HEALTHCARE]: {
    id: 'universal_healthcare',
    type: ComponentType.UNIVERSAL_HEALTHCARE,
    name: 'Universal Healthcare',
    description: 'Healthcare system providing coverage for all citizens',
    effectiveness: 88,
    synergies: [ComponentType.WELFARE_STATE, ComponentType.SOCIAL_SAFETY_NET],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.ECONOMIC_INCENTIVES],
    implementationCost: 130000,
    maintenanceCost: 110000,
    requiredCapacity: 90,
    category: 'social',
    prerequisites: [],
    color: 'green',
    icon: Heart,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.PUBLIC_EDUCATION]: {
    id: 'public_education',
    type: ComponentType.PUBLIC_EDUCATION,
    name: 'Public Education',
    description: 'Comprehensive public education system',
    effectiveness: 86,
    synergies: [ComponentType.WELFARE_STATE, ComponentType.KNOWLEDGE_ECONOMY],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 115000,
    maintenanceCost: 95000,
    requiredCapacity: 85,
    category: 'social',
    prerequisites: [],
    color: 'blue',
    icon: GraduationCap,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.SOCIAL_SAFETY_NET]: {
    id: 'social_safety_net',
    type: ComponentType.SOCIAL_SAFETY_NET,
    name: 'Social Safety Net',
    description: 'Programs providing basic security and support',
    effectiveness: 84,
    synergies: [ComponentType.WELFARE_STATE, ComponentType.DEMOCRATIC_PROCESS],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.ECONOMIC_INCENTIVES],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 80,
    category: 'social',
    prerequisites: [],
    color: 'green',
    icon: Shield,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.WORKER_PROTECTION]: {
    id: 'worker_protection',
    type: ComponentType.WORKER_PROTECTION,
    name: 'Worker Protection',
    description: 'Labor laws and regulations protecting workers rights',
    effectiveness: 82,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SOCIAL_SAFETY_NET],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.CORPORATIST_SYSTEM],
    implementationCost: 85000,
    maintenanceCost: 70000,
    requiredCapacity: 75,
    category: 'social',
    prerequisites: [],
    color: 'green',
    icon: Shield,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },

  [ComponentType.ENVIRONMENTAL_PROTECTION]: {
    id: 'environmental_protection',
    type: ComponentType.ENVIRONMENTAL_PROTECTION,
    name: 'Environmental Protection',
    description: 'Policies and regulations protecting the environment',
    effectiveness: 80,
    synergies: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.INTERNATIONAL_LAW],
    conflicts: [ComponentType.RESOURCE_BASED_ECONOMY, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 90000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'environment',
    prerequisites: [],
    color: 'green',
    icon: Leaf,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.CULTURAL_PRESERVATION]: {
    id: 'cultural_preservation',
    type: ComponentType.CULTURAL_PRESERVATION,
    name: 'Cultural Preservation',
    description: 'Programs preserving and promoting cultural heritage',
    effectiveness: 75,
    synergies: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.SOCIAL_PRESSURE],
    conflicts: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.INNOVATION_ECOSYSTEM],
    implementationCost: 70000,
    maintenanceCost: 55000,
    requiredCapacity: 70,
    category: 'cultural',
    prerequisites: [],
    color: 'amber',
    icon: BookOpen,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },

  [ComponentType.MINORITY_RIGHTS]: {
    id: 'minority_rights',
    type: ComponentType.MINORITY_RIGHTS,
    name: 'Minority Rights',
    description: 'Protection and promotion of minority group rights',
    effectiveness: 83,
    synergies: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 80000,
    maintenanceCost: 65000,
    requiredCapacity: 75,
    category: 'social',
    prerequisites: [],
    color: 'green',
    icon: Users,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: false
    }
  },

  // International Relations Components
  [ComponentType.MULTILATERAL_DIPLOMACY]: {
    id: 'multilateral_diplomacy',
    type: ComponentType.MULTILATERAL_DIPLOMACY,
    name: 'Multilateral Diplomacy',
    description: 'Diplomatic engagement through international organizations and forums',
    effectiveness: 85,
    synergies: [ComponentType.INTERNATIONAL_LAW, ComponentType.DEMOCRATIC_PROCESS],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ENFORCEMENT],
    implementationCost: 110000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: 'diplomacy',
    prerequisites: [],
    color: 'blue',
    icon: Globe,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.BILATERAL_RELATIONS]: {
    id: 'bilateral_relations',
    type: ComponentType.BILATERAL_RELATIONS,
    name: 'Bilateral Relations',
    description: 'Direct diplomatic relations between two nations',
    effectiveness: 82,
    synergies: [ComponentType.TRADE_AGREEMENTS, ComponentType.DEMOCRATIC_PROCESS],
    conflicts: [ComponentType.REGIONAL_INTEGRATION, ComponentType.MULTILATERAL_DIPLOMACY],
    implementationCost: 90000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'diplomacy',
    prerequisites: [],
    color: 'blue',
    icon: Handshake,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.REGIONAL_INTEGRATION]: {
    id: 'regional_integration',
    type: ComponentType.REGIONAL_INTEGRATION,
    name: 'Regional Integration',
    description: 'Economic and political integration within a region',
    effectiveness: 88,
    synergies: [ComponentType.TRADE_AGREEMENTS, ComponentType.MULTILATERAL_DIPLOMACY],
    conflicts: [ComponentType.BILATERAL_RELATIONS, ComponentType.AUTOCRATIC_PROCESS],
    implementationCost: 120000,
    maintenanceCost: 100000,
    requiredCapacity: 90,
    category: 'diplomacy',
    prerequisites: [],
    color: 'purple',
    icon: Globe,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.INTERNATIONAL_LAW]: {
    id: 'international_law',
    type: ComponentType.INTERNATIONAL_LAW,
    name: 'International Law',
    description: 'Adherence to international legal frameworks and treaties',
    effectiveness: 87,
    synergies: [ComponentType.RULE_OF_LAW, ComponentType.MULTILATERAL_DIPLOMACY],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ENFORCEMENT],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 85,
    category: 'legal',
    prerequisites: [],
    color: 'blue',
    icon: Scale,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.DEVELOPMENT_AID]: {
    id: 'development_aid',
    type: ComponentType.DEVELOPMENT_AID,
    name: 'Development Aid',
    description: 'Foreign assistance programs for economic and social development',
    effectiveness: 80,
    synergies: [ComponentType.MULTILATERAL_DIPLOMACY, ComponentType.WELFARE_STATE],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 95000,
    maintenanceCost: 80000,
    requiredCapacity: 80,
    category: 'diplomacy',
    prerequisites: [],
    color: 'green',
    icon: Heart,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.HUMANITARIAN_INTERVENTION]: {
    id: 'humanitarian_intervention',
    type: ComponentType.HUMANITARIAN_INTERVENTION,
    name: 'Humanitarian Intervention',
    description: 'Military or diplomatic intervention to prevent humanitarian crises',
    effectiveness: 75,
    synergies: [ComponentType.INTERNATIONAL_LAW, ComponentType.MULTILATERAL_DIPLOMACY],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.BILATERAL_RELATIONS],
    implementationCost: 130000,
    maintenanceCost: 110000,
    requiredCapacity: 90,
    category: 'diplomacy',
    prerequisites: [],
    color: 'green',
    icon: Heart,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 13,
      technologyRequired: true
    }
  },

  [ComponentType.TRADE_AGREEMENTS]: {
    id: 'trade_agreements',
    type: ComponentType.TRADE_AGREEMENTS,
    name: 'Trade Agreements',
    description: 'International trade agreements and economic partnerships',
    effectiveness: 85,
    synergies: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.BILATERAL_RELATIONS],
    conflicts: [ComponentType.PLANNED_ECONOMY, ComponentType.RESOURCE_BASED_ECONOMY],
    implementationCost: 85000,
    maintenanceCost: 65000,
    requiredCapacity: 80,
    category: 'economic',
    prerequisites: [],
    color: 'green',
    icon: Handshake,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.SECURITY_ALLIANCES]: {
    id: 'security_alliances',
    type: ComponentType.SECURITY_ALLIANCES,
    name: 'Security Alliances',
    description: 'Military and security cooperation agreements',
    effectiveness: 88,
    synergies: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.BILATERAL_RELATIONS],
    conflicts: [ComponentType.MULTILATERAL_DIPLOMACY, ComponentType.REGIONAL_INTEGRATION],
    implementationCost: 140000,
    maintenanceCost: 120000,
    requiredCapacity: 90,
    category: 'security',
    prerequisites: [],
    color: 'red',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  // Innovation and Development Components
  [ComponentType.RESEARCH_AND_DEVELOPMENT]: {
    id: 'research_and_development',
    type: ComponentType.RESEARCH_AND_DEVELOPMENT,
    name: 'Research and Development',
    description: 'Government investment in scientific research and technological development',
    effectiveness: 90,
    synergies: [ComponentType.KNOWLEDGE_ECONOMY, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.RESOURCE_BASED_ECONOMY],
    implementationCost: 150000,
    maintenanceCost: 130000,
    requiredCapacity: 95,
    category: 'innovation',
    prerequisites: [],
    color: 'purple',
    icon: Microscope,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.INNOVATION_ECOSYSTEM]: {
    id: 'innovation_ecosystem',
    type: ComponentType.INNOVATION_ECOSYSTEM,
    name: 'Innovation Ecosystem',
    description: 'Supportive environment for innovation and entrepreneurship',
    effectiveness: 92,
    synergies: [ComponentType.KNOWLEDGE_ECONOMY, ComponentType.RESEARCH_AND_DEVELOPMENT],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CULTURAL_PRESERVATION],
    implementationCost: 140000,
    maintenanceCost: 120000,
    requiredCapacity: 95,
    category: 'innovation',
    prerequisites: [],
    color: 'purple',
    icon: Lightbulb,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.TECHNOLOGY_TRANSFER]: {
    id: 'technology_transfer',
    type: ComponentType.TECHNOLOGY_TRANSFER,
    name: 'Technology Transfer',
    description: 'Programs facilitating technology sharing and adoption',
    effectiveness: 85,
    synergies: [ComponentType.RESEARCH_AND_DEVELOPMENT, ComponentType.INTERNATIONAL_LAW],
    conflicts: [ComponentType.INTELLECTUAL_PROPERTY, ComponentType.RESOURCE_BASED_ECONOMY],
    implementationCost: 110000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: 'innovation',
    prerequisites: [],
    color: 'blue',
    icon: ArrowRightLeft,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.ENTREPRENEURSHIP_SUPPORT]: {
    id: 'entrepreneurship_support',
    type: ComponentType.ENTREPRENEURSHIP_SUPPORT,
    name: 'Entrepreneurship Support',
    description: 'Programs supporting business creation and development',
    effectiveness: 88,
    synergies: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.INNOVATION_ECOSYSTEM],
    conflicts: [ComponentType.PLANNED_ECONOMY, ComponentType.CORPORATIST_SYSTEM],
    implementationCost: 120000,
    maintenanceCost: 100000,
    requiredCapacity: 85,
    category: 'economic',
    prerequisites: [],
    color: 'green',
    icon: TrendingUp,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.INTELLECTUAL_PROPERTY]: {
    id: 'intellectual_property',
    type: ComponentType.INTELLECTUAL_PROPERTY,
    name: 'Intellectual Property',
    description: 'Legal framework protecting intellectual property rights',
    effectiveness: 83,
    synergies: [ComponentType.KNOWLEDGE_ECONOMY, ComponentType.RULE_OF_LAW],
    conflicts: [ComponentType.TECHNOLOGY_TRANSFER, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 95000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'legal',
    prerequisites: [],
    color: 'blue',
    icon: Copyright,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.STARTUP_INCUBATION]: {
    id: 'startup_incubation',
    type: ComponentType.STARTUP_INCUBATION,
    name: 'Startup Incubation',
    description: 'Programs providing support and resources for new businesses',
    effectiveness: 86,
    synergies: [ComponentType.ENTREPRENEURSHIP_SUPPORT, ComponentType.INNOVATION_ECOSYSTEM],
    conflicts: [ComponentType.PLANNED_ECONOMY, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 115000,
    maintenanceCost: 95000,
    requiredCapacity: 85,
    category: 'innovation',
    prerequisites: [],
    color: 'purple',
    icon: Zap,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.DIGITAL_INFRASTRUCTURE]: {
    id: 'digital_infrastructure',
    type: ComponentType.DIGITAL_INFRASTRUCTURE,
    name: 'Digital Infrastructure',
    description: 'National digital infrastructure and connectivity systems',
    effectiveness: 89,
    synergies: [ComponentType.DIGITAL_GOVERNMENT, ComponentType.KNOWLEDGE_ECONOMY],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.RESOURCE_BASED_ECONOMY],
    implementationCost: 160000,
    maintenanceCost: 140000,
    requiredCapacity: 95,
    category: 'technology',
    prerequisites: [],
    color: 'purple',
    icon: Wifi,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.SMART_CITIES]: {
    id: 'smart_cities',
    type: ComponentType.SMART_CITIES,
    name: 'Smart Cities',
    description: 'Technology-integrated urban development and management',
    effectiveness: 87,
    synergies: [ComponentType.DIGITAL_INFRASTRUCTURE, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CULTURAL_PRESERVATION],
    implementationCost: 180000,
    maintenanceCost: 160000,
    requiredCapacity: 95,
    category: 'technology',
    prerequisites: [],
    color: 'purple',
    icon: Building2,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  // Crisis Management Components
  [ComponentType.EMERGENCY_RESPONSE]: {
    id: 'emergency_response',
    type: ComponentType.EMERGENCY_RESPONSE,
    name: 'Emergency Response',
    description: 'Rapid response systems for emergencies and disasters',
    effectiveness: 90,
    synergies: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.CENTRALIZED_POWER],
    conflicts: [ComponentType.CONSENSUS_PROCESS, ComponentType.ADMINISTRATIVE_DECENTRALIZATION],
    implementationCost: 120000,
    maintenanceCost: 100000,
    requiredCapacity: 90,
    category: 'crisis',
    prerequisites: [],
    color: 'red',
    icon: AlertTriangle,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.DISASTER_PREPAREDNESS]: {
    id: 'disaster_preparedness',
    type: ComponentType.DISASTER_PREPAREDNESS,
    name: 'Disaster Preparedness',
    description: 'Systems and plans for disaster prevention and mitigation',
    effectiveness: 85,
    synergies: [ComponentType.STRATEGIC_PLANNING, ComponentType.RISK_MANAGEMENT],
    conflicts: [ComponentType.CHARISMATIC_LEGITIMACY, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 110000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: 'crisis',
    prerequisites: [],
    color: 'orange',
    icon: AlertTriangle,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.PANDEMIC_MANAGEMENT]: {
    id: 'pandemic_management',
    type: ComponentType.PANDEMIC_MANAGEMENT,
    name: 'Pandemic Management',
    description: 'Public health systems for managing disease outbreaks',
    effectiveness: 88,
    synergies: [ComponentType.UNIVERSAL_HEALTHCARE, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.FREE_MARKET_SYSTEM, ComponentType.ECONOMIC_INCENTIVES],
    implementationCost: 130000,
    maintenanceCost: 110000,
    requiredCapacity: 90,
    category: 'crisis',
    prerequisites: [],
    color: 'red',
    icon: Heart,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.CYBERSECURITY]: {
    id: 'cybersecurity',
    type: ComponentType.CYBERSECURITY,
    name: 'Cybersecurity',
    description: 'Protection of digital infrastructure and information systems',
    effectiveness: 92,
    synergies: [ComponentType.DIGITAL_INFRASTRUCTURE, ComponentType.TECHNOCRATIC_AGENCIES],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.SOCIAL_PRESSURE],
    implementationCost: 140000,
    maintenanceCost: 120000,
    requiredCapacity: 95,
    category: 'security',
    prerequisites: [],
    color: 'purple',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.COUNTER_TERRORISM]: {
    id: 'counter_terrorism',
    type: ComponentType.COUNTER_TERRORISM,
    name: 'Counter-Terrorism',
    description: 'Systems and policies for preventing and combating terrorism',
    effectiveness: 86,
    synergies: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.SURVEILLANCE_SYSTEM],
    conflicts: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
    implementationCost: 125000,
    maintenanceCost: 105000,
    requiredCapacity: 90,
    category: 'security',
    prerequisites: [],
    color: 'red',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  },

  [ComponentType.CRISIS_COMMUNICATION]: {
    id: 'crisis_communication',
    type: ComponentType.CRISIS_COMMUNICATION,
    name: 'Crisis Communication',
    description: 'Systems for effective communication during crises',
    effectiveness: 84,
    synergies: [ComponentType.DIGITAL_GOVERNMENT, ComponentType.EMERGENCY_RESPONSE],
    conflicts: [ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.SOCIAL_PRESSURE],
    implementationCost: 95000,
    maintenanceCost: 75000,
    requiredCapacity: 80,
    category: 'crisis',
    prerequisites: [],
    color: 'blue',
    icon: MessageSquare,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.RECOVERY_PLANNING]: {
    id: 'recovery_planning',
    type: ComponentType.RECOVERY_PLANNING,
    name: 'Recovery Planning',
    description: 'Systems for post-crisis recovery and reconstruction',
    effectiveness: 82,
    synergies: [ComponentType.STRATEGIC_PLANNING, ComponentType.ECONOMIC_INCENTIVES],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.TRADITIONAL_LEGITIMACY],
    implementationCost: 100000,
    maintenanceCost: 80000,
    requiredCapacity: 80,
    category: 'planning',
    prerequisites: [],
    color: 'green',
    icon: RefreshCw,
    metadata: {
      complexity: 'Medium',
      timeToImplement: '18 months',
      staffRequired: 10,
      technologyRequired: true
    }
  },

  [ComponentType.RESILIENCE_BUILDING]: {
    id: 'resilience_building',
    type: ComponentType.RESILIENCE_BUILDING,
    name: 'Resilience Building',
    description: 'Building societal and institutional resilience to shocks',
    effectiveness: 87,
    synergies: [ComponentType.STRATEGIC_PLANNING, ComponentType.SOCIAL_SAFETY_NET],
    conflicts: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.FREE_MARKET_SYSTEM],
    implementationCost: 115000,
    maintenanceCost: 95000,
    requiredCapacity: 85,
    category: 'planning',
    prerequisites: [],
    color: 'green',
    icon: Shield,
    metadata: {
      complexity: 'High',
      timeToImplement: '24-36 months',
      staffRequired: 20,
      technologyRequired: true
    }
  }
};

// Component Category Groupings with Display Names
export const COMPONENT_CATEGORIES = {
  'Power Distribution': [
    ComponentType.CENTRALIZED_POWER,
    ComponentType.FEDERAL_SYSTEM,
    ComponentType.CONFEDERATE_SYSTEM,
    ComponentType.UNITARY_SYSTEM
  ],
  'Decision Process': [
    ComponentType.DEMOCRATIC_PROCESS,
    ComponentType.AUTOCRATIC_PROCESS,
    ComponentType.TECHNOCRATIC_PROCESS,
    ComponentType.CONSENSUS_PROCESS,
    ComponentType.OLIGARCHIC_PROCESS
  ],
  'Legitimacy Sources': [
    ComponentType.ELECTORAL_LEGITIMACY,
    ComponentType.TRADITIONAL_LEGITIMACY,
    ComponentType.PERFORMANCE_LEGITIMACY,
    ComponentType.CHARISMATIC_LEGITIMACY,
    ComponentType.RELIGIOUS_LEGITIMACY,
    ComponentType.INSTITUTIONAL_LEGITIMACY
  ],
  'Institutions': [
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.MILITARY_ADMINISTRATION,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.PARTISAN_INSTITUTIONS,
    ComponentType.TECHNOCRATIC_AGENCIES
  ],
  'Control Mechanisms': [
    ComponentType.RULE_OF_LAW,
    ComponentType.SURVEILLANCE_SYSTEM,
    ComponentType.ECONOMIC_INCENTIVES,
    ComponentType.SOCIAL_PRESSURE,
    ComponentType.MILITARY_ENFORCEMENT
  ],
  'Economic Governance': [
    ComponentType.FREE_MARKET_SYSTEM,
    ComponentType.PLANNED_ECONOMY,
    ComponentType.MIXED_ECONOMY,
    ComponentType.CORPORATIST_SYSTEM,
    ComponentType.SOCIAL_MARKET_ECONOMY,
    ComponentType.STATE_CAPITALISM,
    ComponentType.RESOURCE_BASED_ECONOMY,
    ComponentType.KNOWLEDGE_ECONOMY
  ],
  'Administrative Efficiency': [
    ComponentType.DIGITAL_GOVERNMENT,
    ComponentType.E_GOVERNANCE,
    ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    ComponentType.MERIT_BASED_SYSTEM,
    ComponentType.PERFORMANCE_MANAGEMENT,
    ComponentType.QUALITY_ASSURANCE,
    ComponentType.STRATEGIC_PLANNING,
    ComponentType.RISK_MANAGEMENT
  ],
  'Social Policy': [
    ComponentType.WELFARE_STATE,
    ComponentType.UNIVERSAL_HEALTHCARE,
    ComponentType.PUBLIC_EDUCATION,
    ComponentType.SOCIAL_SAFETY_NET,
    ComponentType.WORKER_PROTECTION,
    ComponentType.ENVIRONMENTAL_PROTECTION,
    ComponentType.CULTURAL_PRESERVATION,
    ComponentType.MINORITY_RIGHTS
  ],
  'International Relations': [
    ComponentType.MULTILATERAL_DIPLOMACY,
    ComponentType.BILATERAL_RELATIONS,
    ComponentType.REGIONAL_INTEGRATION,
    ComponentType.INTERNATIONAL_LAW,
    ComponentType.DEVELOPMENT_AID,
    ComponentType.HUMANITARIAN_INTERVENTION,
    ComponentType.TRADE_AGREEMENTS,
    ComponentType.SECURITY_ALLIANCES
  ],
  'Innovation & Development': [
    ComponentType.RESEARCH_AND_DEVELOPMENT,
    ComponentType.INNOVATION_ECOSYSTEM,
    ComponentType.TECHNOLOGY_TRANSFER,
    ComponentType.ENTREPRENEURSHIP_SUPPORT,
    ComponentType.INTELLECTUAL_PROPERTY,
    ComponentType.STARTUP_INCUBATION,
    ComponentType.DIGITAL_INFRASTRUCTURE,
    ComponentType.SMART_CITIES
  ],
  'Crisis Management': [
    ComponentType.EMERGENCY_RESPONSE,
    ComponentType.DISASTER_PREPAREDNESS,
    ComponentType.PANDEMIC_MANAGEMENT,
    ComponentType.CYBERSECURITY,
    ComponentType.COUNTER_TERRORISM,
    ComponentType.CRISIS_COMMUNICATION,
    ComponentType.RECOVERY_PLANNING,
    ComponentType.RESILIENCE_BUILDING
  ]
};

// ==================== HELPER FUNCTIONS ====================

export function calculateGovernmentEffectiveness(selectedComponents: ComponentType[]): EffectivenessMetrics {
  const components = selectedComponents
    .map(type => ATOMIC_COMPONENTS[type])
    .filter((comp): comp is AtomicGovernmentComponent => comp !== undefined);
  
  const baseEffectiveness = components.reduce((sum, comp) => sum + comp.effectiveness, 0) / (components.length || 1);
  
  let synergyBonus = 0;
  let synergyCount = 0;
  let conflictPenalty = 0;
  let conflictCount = 0;
  
  for (let i = 0; i < selectedComponents.length; i++) {
    for (let j = i + 1; j < selectedComponents.length; j++) {
      const comp1 = selectedComponents[i];
      const comp2 = selectedComponents[j];
      
      const synergy = checkGovernmentSynergy(comp1, comp2);
      if (synergy > 0) {
        synergyBonus += synergy;
        synergyCount++;
      }
      
      if (checkGovernmentConflict(comp1, comp2)) {
        conflictPenalty += 15;
        conflictCount++;
      }
    }
  }
  
  const totalEffectiveness = Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  
  return {
    baseEffectiveness,
    synergyBonus,
    conflictPenalty,
    totalEffectiveness,
    synergyCount,
    conflictCount
  };
}

export function checkGovernmentSynergy(comp1: string, comp2: string): number {
  const component1 = ATOMIC_COMPONENTS[comp1 as ComponentType];
  const component2 = ATOMIC_COMPONENTS[comp2 as ComponentType];
  
  if (!component1 || !component2) return 0;
  
  if (component1.synergies.includes(comp2 as ComponentType)) return 10;
  if (component2.synergies.includes(comp1 as ComponentType)) return 10;
  
  return 0;
}

export function checkGovernmentConflict(comp1: string, comp2: string): boolean {
  const component1 = ATOMIC_COMPONENTS[comp1 as ComponentType];
  const component2 = ATOMIC_COMPONENTS[comp2 as ComponentType];
  
  if (!component1 || !component2) return false;
  
  return component1.conflicts.includes(comp2 as ComponentType) || component2.conflicts.includes(comp1 as ComponentType);
}

// ==================== COMPONENT SELECTOR ====================

interface AtomicComponentSelectorProps {
  selectedComponents: ComponentType[];
  onComponentChange: (components: ComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
}

// Convert AtomicGovernmentComponent to UnifiedAtomicComponent
function convertToUnifiedComponents(components: Partial<Record<ComponentType, AtomicGovernmentComponent>>): Record<string, any> {
  const converted: Record<string, any> = {};

  Object.entries(components).forEach(([key, component]) => {
    if (component) {
      converted[key] = {
        id: component.id,
        name: component.name,
        category: component.category,
        description: component.description,
        effectiveness: component.effectiveness,
        implementationCost: component.implementationCost,
        maintenanceCost: component.maintenanceCost,
        prerequisites: component.prerequisites,
        synergies: component.synergies.map(s => s.toString()),
        conflicts: component.conflicts.map(c => c.toString()),
        metadata: component.metadata,
        icon: component.icon,
        color: component.color
      };
    }
  });

  return converted;
}

// ==================== HELP MODAL ====================

export function AtomicGovernmentHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950"
        >
          <HelpCircle className="h-4 w-4" />
          What are Atomic Components?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Atom className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Atomic Government Components
          </DialogTitle>
          <DialogDescription className="text-base">
            Revolutionary modular governance with 80+ building blocks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <section>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              What are Atomic Components?
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Atomic Components break governance into fundamental building blocks. Instead of choosing
              a pre-defined government type, you assemble a custom structure from modular components.
              This enables unprecedented government customization and experimentation.
            </p>
          </section>

          <div className="bg-purple-50 border border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-purple-900 dark:text-purple-300 font-semibold mb-1">
                  Innovation Hub
                </h4>
                <p className="text-purple-800 dark:text-purple-100/80 text-sm">
                  The Atomic Government system is unique to IxStats and allows political configurations
                  impossible in traditional systems.
                </p>
              </div>
            </div>
          </div>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Core Principles
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg h-fit">
                  <Blocks className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white mb-1">Modularity</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Each component is independent. Mix and match Power Distribution, Decision Process,
                    Legitimacy, Institutions, and Control components freely.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white mb-1">Synergy Effects</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Components interact dynamically. Certain combinations unlock bonuses (+10% effectiveness)
                    while others create conflicts (-15% effectiveness) requiring careful management.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Component Categories
            </h3>
            <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
              The 80+ atomic components are organized into 11 major categories:
            </p>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span><strong>Power Distribution:</strong> Centralized, Federal, Confederate, Unitary</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span><strong>Decision Process:</strong> Democratic, Autocratic, Technocratic, Consensus, Oligarchic</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span><strong>Legitimacy Sources:</strong> Electoral, Traditional, Performance, Charismatic, Religious</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span><strong>Institutions:</strong> Professional Bureaucracy, Military Admin, Independent Judiciary</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span><strong>Economic Governance:</strong> Free Market, Planned Economy, Mixed, Knowledge Economy</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400">•</span>
                <span className="text-slate-500 dark:text-slate-400">...and 6 more categories including Social Policy, International Relations, and Crisis Management</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              How to Use
            </h3>
            <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex gap-2">
                <span className="font-semibold text-purple-600 dark:text-purple-400">1.</span>
                <span>Select 3-10 components to create a functional government</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-purple-600 dark:text-purple-400">2.</span>
                <span>Watch for synergy bonuses (green indicators) and conflicts (red warnings)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-purple-600 dark:text-purple-400">3.</span>
                <span>Check effectiveness score and adjust components for optimal performance</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-purple-600 dark:text-purple-400">4.</span>
                <span>Review implementation costs and prerequisites before finalizing</span>
              </li>
            </ol>
          </section>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <Link
              href="/help/government/atomic"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Read Full Documentation
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <div className="mt-2 flex gap-3">
              <Link
                href="/help/government/components"
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Component Reference
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Link
                href="/help/government/synergy"
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Synergy Guide
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== COMPONENT SELECTOR ====================

export function AtomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 10,
  isReadOnly = false
}: AtomicComponentSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Select Government Components
        </h3>
        <AtomicGovernmentHelp />
      </div>
      <UnifiedAtomicComponentSelector
        components={convertToUnifiedComponents(ATOMIC_COMPONENTS)}
        categories={COMPONENT_CATEGORIES}
        selectedComponents={selectedComponents.map(s => s.toString())}
        onComponentChange={(components) => onComponentChange(components.map(c => c as ComponentType))}
        maxComponents={maxComponents}
        isReadOnly={isReadOnly}
        theme={GOVERNMENT_THEME}
        systemName="Atomic Government Components"
        systemIcon={Settings}
        calculateEffectiveness={(components) => calculateGovernmentEffectiveness(components.map(c => c as ComponentType))}
        checkSynergy={checkGovernmentSynergy}
        checkConflict={checkGovernmentConflict}
      />
    </div>
  );
}