"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  Building2,
  Factory,
  Users,
  TrendingUp,
  Target,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
  Shield,
  DollarSign,
  Globe,
  Zap,
  Leaf,
  Brain,
  Wrench,
  Truck,
  Briefcase,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  Lock,
  Unlock,
  ArrowUpDown,
  BarChart3,
  PieChart,
  Gauge,
  Sparkles,
  Flame,
  Star,
  TrendingDown,
  AlertTriangle,
  XCircle,
  Ban,
  ShieldAlert
} from 'lucide-react';

// Atomic Economic Component Types
export interface AtomicEconomicComponent {
  id: string;
  type: EconomicComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: EconomicComponentType[]; // Internal synergies
  conflicts: EconomicComponentType[]; // Internal conflicts
  governmentSynergies: string[]; // Cross-builder synergies with government components
  governmentConflicts: string[];
  taxImpact: { // How this affects tax system
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: Record<string, number>; // GDP % impact by sector
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: EconomicCategory;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export enum EconomicComponentType {
  // Economic Model Components
  FREE_MARKET_SYSTEM = "FREE_MARKET_SYSTEM",
  MIXED_ECONOMY = "MIXED_ECONOMY",
  STATE_CAPITALISM = "STATE_CAPITALISM",
  PLANNED_ECONOMY = "PLANNED_ECONOMY",
  SOCIAL_MARKET_ECONOMY = "SOCIAL_MARKET_ECONOMY",
  RESOURCE_BASED_ECONOMY = "RESOURCE_BASED_ECONOMY",
  KNOWLEDGE_ECONOMY = "KNOWLEDGE_ECONOMY",
  INNOVATION_ECONOMY = "INNOVATION_ECONOMY",
  
  // Sector Focus Components
  AGRICULTURE_LED = "AGRICULTURE_LED",
  MANUFACTURING_LED = "MANUFACTURING_LED",
  SERVICE_BASED = "SERVICE_BASED",
  TECHNOLOGY_FOCUSED = "TECHNOLOGY_FOCUSED",
  FINANCE_CENTERED = "FINANCE_CENTERED",
  EXPORT_ORIENTED = "EXPORT_ORIENTED",
  DOMESTIC_FOCUSED = "DOMESTIC_FOCUSED",
  TOURISM_BASED = "TOURISM_BASED",
  
  // Labor System Components
  FLEXIBLE_LABOR = "FLEXIBLE_LABOR",
  PROTECTED_WORKERS = "PROTECTED_WORKERS",
  UNION_BASED = "UNION_BASED",
  GIG_ECONOMY = "GIG_ECONOMY",
  PROFESSIONAL_SERVICES = "PROFESSIONAL_SERVICES",
  SKILL_BASED = "SKILL_BASED",
  EDUCATION_FIRST = "EDUCATION_FIRST",
  MERIT_BASED = "MERIT_BASED",
  HIGH_SKILLED_WORKERS = "HIGH_SKILLED_WORKERS",
  EDUCATION_FOCUSED = "EDUCATION_FOCUSED",
  HEALTHCARE_FOCUSED = "HEALTHCARE_FOCUSED",
  VOCATIONAL_TRAINING = "VOCATIONAL_TRAINING",
  
  // Trade Policy Components
  FREE_TRADE = "FREE_TRADE",
  PROTECTIONIST = "PROTECTIONIST",
  BALANCED_TRADE = "BALANCED_TRADE",
  EXPORT_SUBSIDY = "EXPORT_SUBSIDY",
  IMPORT_SUBSTITUTION = "IMPORT_SUBSTITUTION",
  TRADE_BLOC = "TRADE_BLOC",
  BILATERAL_FOCUS = "BILATERAL_FOCUS",
  MULTILATERAL_FOCUS = "MULTILATERAL_FOCUS",
  TRADE_FACILITATION = "TRADE_FACILITATION",
  COMPETITIVE_MARKETS = "COMPETITIVE_MARKETS",
  
  // Innovation Components
  RD_INVESTMENT = "RD_INVESTMENT",
  TECH_TRANSFER = "TECH_TRANSFER",
  STARTUP_ECOSYSTEM = "STARTUP_ECOSYSTEM",
  PATENT_PROTECTION = "PATENT_PROTECTION",
  OPEN_INNOVATION = "OPEN_INNOVATION",
  UNIVERSITY_PARTNERSHIPS = "UNIVERSITY_PARTNERSHIPS",
  VENTURE_CAPITAL = "VENTURE_CAPITAL",
  INTELLECTUAL_PROPERTY = "INTELLECTUAL_PROPERTY",
  RESEARCH_AND_DEVELOPMENT = "RESEARCH_AND_DEVELOPMENT",
  
  // Resource Management Components
  SUSTAINABLE_DEVELOPMENT = "SUSTAINABLE_DEVELOPMENT",
  EXTRACTION_FOCUSED = "EXTRACTION_FOCUSED",
  RENEWABLE_ENERGY = "RENEWABLE_ENERGY",
  CIRCULAR_ECONOMY = "CIRCULAR_ECONOMY",
  LINEAR_ECONOMY = "LINEAR_ECONOMY",
  CONSERVATION_FIRST = "CONSERVATION_FIRST",
  GREEN_TECHNOLOGY = "GREEN_TECHNOLOGY",
  CARBON_NEUTRAL = "CARBON_NEUTRAL",
  CARBON_INTENSIVE = "CARBON_INTENSIVE",
  ECO_FRIENDLY = "ECO_FRIENDLY",
  GREEN_ECONOMY = "GREEN_ECONOMY",

  // Real Estate & Property Components
  REAL_ESTATE_FOCUSED = "REAL_ESTATE_FOCUSED"
}

export enum EconomicCategory {
  ECONOMIC_MODEL = "economicModel",
  SECTOR_FOCUS = "sectorFocus", 
  LABOR_SYSTEM = "laborSystem",
  TRADE_POLICY = "tradePolicy",
  INNOVATION = "innovation",
  RESOURCE_MANAGEMENT = "resourceManagement"
}

// Atomic Component Library
export const ATOMIC_ECONOMIC_COMPONENTS: Partial<Record<EconomicComponentType, AtomicEconomicComponent>> = {
  // Economic Model Components
  [EconomicComponentType.FREE_MARKET_SYSTEM]: {
    id: 'free_market_system',
    type: EconomicComponentType.FREE_MARKET_SYSTEM,
    name: 'Free Market System',
    description: 'Minimal government intervention, market-driven resource allocation',
    effectiveness: 85,
    synergies: [EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.FREE_TRADE, EconomicComponentType.STARTUP_ECOSYSTEM],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.PROTECTIONIST],
    governmentSynergies: ['FREE_MARKET_SYSTEM', 'MINIMAL_GOVERNMENT', 'PRIVATE_SECTOR_LEADERSHIP'],
    governmentConflicts: ['PLANNED_ECONOMY', 'STATE_CAPITALISM', 'CENTRALIZED_POWER'],
    taxImpact: {
      optimalCorporateRate: 15,
      optimalIncomeRate: 25,
      revenueEfficiency: 0.85
    },
    sectorImpact: {
      'services': 1.2,
      'finance': 1.3,
      'technology': 1.4,
      'manufacturing': 1.1,
      'agriculture': 0.9,
      'government': 0.7
    },
    employmentImpact: {
      unemploymentModifier: -0.5,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2
    },
    implementationCost: 50000,
    maintenanceCost: 25000,
    requiredCapacity: 60,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: DollarSign,
    color: 'green'
  },
  
  [EconomicComponentType.MIXED_ECONOMY]: {
    id: 'mixed_economy',
    type: EconomicComponentType.MIXED_ECONOMY,
    name: 'Mixed Economy',
    description: 'Balance of market forces and government intervention',
    effectiveness: 78,
    synergies: [EconomicComponentType.BALANCED_TRADE, EconomicComponentType.SOCIAL_MARKET_ECONOMY, EconomicComponentType.PROTECTED_WORKERS],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.FREE_MARKET_SYSTEM],
    governmentSynergies: ['MIXED_ECONOMY', 'BALANCED_APPROACH', 'SOCIAL_MARKET_ECONOMY'],
    governmentConflicts: ['CENTRALIZED_POWER', 'AUTOCRATIC_PROCESS'],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.78
    },
    sectorImpact: {
      'services': 1.0,
      'manufacturing': 1.1,
      'agriculture': 1.0,
      'government': 1.2,
      'finance': 1.0,
      'technology': 1.1
    },
    employmentImpact: {
      unemploymentModifier: 0.0,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0
    },
    implementationCost: 75000,
    maintenanceCost: 40000,
    requiredCapacity: 70,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: BarChart3,
    color: 'blue'
  },
  
  [EconomicComponentType.STATE_CAPITALISM]: {
    id: 'state_capitalism',
    type: EconomicComponentType.STATE_CAPITALISM,
    name: 'State Capitalism',
    description: 'Government controls strategic sectors while allowing market forces in others',
    effectiveness: 72,
    synergies: [EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.MANUFACTURING_LED, EconomicComponentType.PLANNED_ECONOMY],
    conflicts: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.FREE_TRADE],
    governmentSynergies: ['STATE_CAPITALISM', 'CENTRALIZED_POWER', 'PLANNED_ECONOMY'],
    governmentConflicts: ['FREE_MARKET_SYSTEM', 'DEMOCRATIC_PROCESS'],
    taxImpact: {
      optimalCorporateRate: 28,
      optimalIncomeRate: 35,
      revenueEfficiency: 0.72
    },
    sectorImpact: {
      'manufacturing': 1.3,
      'government': 1.4,
      'utilities': 1.5,
      'finance': 0.8,
      'services': 0.9,
      'technology': 1.1
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.9,
      wageGrowthModifier: 0.8
    },
    implementationCost: 100000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Building2,
    color: 'red'
  },
  
  [EconomicComponentType.PLANNED_ECONOMY]: {
    id: 'planned_economy',
    type: EconomicComponentType.PLANNED_ECONOMY,
    name: 'Planned Economy',
    description: 'Government controls all major economic decisions and resource allocation',
    effectiveness: 65,
    synergies: [EconomicComponentType.STATE_CAPITALISM, EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.IMPORT_SUBSTITUTION],
    conflicts: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.FREE_TRADE],
    governmentSynergies: ['PLANNED_ECONOMY', 'CENTRALIZED_POWER', 'AUTOCRATIC_PROCESS'],
    governmentConflicts: ['FREE_MARKET_SYSTEM', 'DEMOCRATIC_PROCESS'],
    taxImpact: {
      optimalCorporateRate: 35,
      optimalIncomeRate: 40,
      revenueEfficiency: 0.65
    },
    sectorImpact: {
      'government': 1.6,
      'manufacturing': 1.2,
      'utilities': 1.4,
      'agriculture': 1.1,
      'finance': 0.6,
      'services': 0.7,
      'technology': 0.8
    },
    employmentImpact: {
      unemploymentModifier: 1.5,
      participationModifier: 0.8,
      wageGrowthModifier: 0.7
    },
    implementationCost: 150000,
    maintenanceCost: 80000,
    requiredCapacity: 90,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Target,
    color: 'purple'
  },
  
  [EconomicComponentType.SOCIAL_MARKET_ECONOMY]: {
    id: 'social_market_economy',
    type: EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    name: 'Social Market Economy',
    description: 'Market economy with strong social safety nets and worker protections',
    effectiveness: 82,
    synergies: [EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.UNION_BASED, EconomicComponentType.EDUCATION_FIRST],
    conflicts: [EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.GIG_ECONOMY, EconomicComponentType.FREE_MARKET_SYSTEM],
    governmentSynergies: ['SOCIAL_MARKET_ECONOMY', 'WELFARE_STATE', 'WORKER_PROTECTION'],
    governmentConflicts: ['FREE_MARKET_SYSTEM', 'MINIMAL_GOVERNMENT'],
    taxImpact: {
      optimalCorporateRate: 25,
      optimalIncomeRate: 35,
      revenueEfficiency: 0.82
    },
    sectorImpact: {
      'services': 1.1,
      'education': 1.3,
      'healthcare': 1.4,
      'manufacturing': 1.0,
      'finance': 1.0,
      'government': 1.3
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.1,
      wageGrowthModifier: 1.1
    },
    implementationCost: 120000,
    maintenanceCost: 70000,
    requiredCapacity: 85,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Heart,
    color: 'pink'
  },
  
  [EconomicComponentType.KNOWLEDGE_ECONOMY]: {
    id: 'knowledge_economy',
    type: EconomicComponentType.KNOWLEDGE_ECONOMY,
    name: 'Knowledge Economy',
    description: 'Economy driven by knowledge, innovation, and intellectual capital',
    effectiveness: 88,
    synergies: [EconomicComponentType.TECHNOLOGY_FOCUSED, EconomicComponentType.RD_INVESTMENT, EconomicComponentType.UNIVERSITY_PARTNERSHIPS],
    conflicts: [EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.MANUFACTURING_LED],
    governmentSynergies: ['RESEARCH_AND_DEVELOPMENT', 'EDUCATION_SYSTEM', 'INNOVATION_ECOSYSTEM'],
    governmentConflicts: ['TRADITIONAL_LEGITIMACY', 'RESOURCE_BASED_ECONOMY'],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.88
    },
    sectorImpact: {
      'technology': 1.8,
      'professional': 1.6,
      'education': 1.4,
      'finance': 1.2,
      'information': 1.7,
      'manufacturing': 0.7,
      'agriculture': 0.5
    },
    employmentImpact: {
      unemploymentModifier: -1.5,
      participationModifier: 1.3,
      wageGrowthModifier: 1.4
    },
    implementationCost: 200000,
    maintenanceCost: 100000,
    requiredCapacity: 95,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Brain,
    color: 'cyan'
  },
  
  [EconomicComponentType.INNOVATION_ECONOMY]: {
    id: 'innovation_economy',
    type: EconomicComponentType.INNOVATION_ECONOMY,
    name: 'Innovation Economy',
    description: 'Economy focused on continuous innovation and technological advancement',
    effectiveness: 90,
    synergies: [EconomicComponentType.STARTUP_ECOSYSTEM, EconomicComponentType.VENTURE_CAPITAL, EconomicComponentType.PATENT_PROTECTION],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.PROTECTIONIST],
    governmentSynergies: ['RESEARCH_AND_DEVELOPMENT', 'INNOVATION_ECOSYSTEM', 'STARTUP_INCUBATION'],
    governmentConflicts: ['TRADITIONAL_LEGITIMACY', 'PLANNED_ECONOMY'],
    taxImpact: {
      optimalCorporateRate: 16,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.90
    },
    sectorImpact: {
      'technology': 2.0,
      'professional': 1.8,
      'information': 1.9,
      'finance': 1.3,
      'manufacturing': 0.8,
      'agriculture': 0.4
    },
    employmentImpact: {
      unemploymentModifier: -2.0,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6
    },
    implementationCost: 250000,
    maintenanceCost: 125000,
    requiredCapacity: 98,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Lightbulb,
    color: 'yellow'
  },
  
  [EconomicComponentType.RESOURCE_BASED_ECONOMY]: {
    id: 'resource_based_economy',
    type: EconomicComponentType.RESOURCE_BASED_ECONOMY,
    name: 'Resource-Based Economy',
    description: 'Economy dependent on natural resource extraction and export',
    effectiveness: 70,
    synergies: [EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.MANUFACTURING_LED],
    conflicts: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.SERVICE_BASED, EconomicComponentType.SUSTAINABLE_DEVELOPMENT],
    governmentSynergies: ['RESOURCE_BASED_ECONOMY', 'EXTRACTION_FOCUSED', 'EXPORT_ORIENTED'],
    governmentConflicts: ['KNOWLEDGE_ECONOMY', 'INNOVATION_ECOSYSTEM'],
    taxImpact: {
      optimalCorporateRate: 30,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.70
    },
    sectorImpact: {
      'mining': 2.0,
      'manufacturing': 1.2,
      'agriculture': 1.1,
      'utilities': 1.3,
      'services': 0.8,
      'technology': 0.6
    },
    employmentImpact: {
      unemploymentModifier: 1.0,
      participationModifier: 0.9,
      wageGrowthModifier: 0.9
    },
    implementationCost: 80000,
    maintenanceCost: 45000,
    requiredCapacity: 65,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Wrench,
    color: 'orange'
  },
  
  // Sector Focus Components
  [EconomicComponentType.AGRICULTURE_LED]: {
    id: 'agriculture_led',
    type: EconomicComponentType.AGRICULTURE_LED,
    name: 'Agriculture-Led Development',
    description: 'Economy focused on agricultural production and food security',
    effectiveness: 68,
    synergies: [EconomicComponentType.RESOURCE_BASED_ECONOMY, EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.DOMESTIC_FOCUSED],
    conflicts: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.TECHNOLOGY_FOCUSED, EconomicComponentType.FINANCE_CENTERED],
    governmentSynergies: ['AGRICULTURE', 'RURAL_DEVELOPMENT', 'FOOD_SECURITY'],
    governmentConflicts: ['INNOVATION_ECOSYSTEM', 'DIGITAL_GOVERNMENT'],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 22,
      revenueEfficiency: 0.68
    },
    sectorImpact: {
      'agriculture': 2.5,
      'manufacturing': 1.1,
      'services': 0.7,
      'technology': 0.5,
      'finance': 0.6
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.8,
      wageGrowthModifier: 0.7
    },
    implementationCost: 60000,
    maintenanceCost: 35000,
    requiredCapacity: 55,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Leaf,
    color: 'green'
  },
  
  [EconomicComponentType.MANUFACTURING_LED]: {
    id: 'manufacturing_led',
    type: EconomicComponentType.MANUFACTURING_LED,
    name: 'Manufacturing-Led Growth',
    description: 'Economy driven by industrial production and manufacturing',
    effectiveness: 75,
    synergies: [EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.TECHNOLOGY_FOCUSED, EconomicComponentType.SKILL_BASED],
    conflicts: [EconomicComponentType.SERVICE_BASED, EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.TOURISM_BASED],
    governmentSynergies: ['MANUFACTURING', 'INDUSTRIAL_POLICY', 'TECHNOLOGY_TRANSFER'],
    governmentConflicts: ['SERVICE_BASED_ECONOMY', 'TOURISM_FOCUS'],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.75
    },
    sectorImpact: {
      'manufacturing': 2.2,
      'construction': 1.4,
      'utilities': 1.2,
      'services': 0.8,
      'technology': 1.1
    },
    employmentImpact: {
      unemploymentModifier: -0.5,
      participationModifier: 1.1,
      wageGrowthModifier: 1.0
    },
    implementationCost: 100000,
    maintenanceCost: 55000,
    requiredCapacity: 75,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Factory,
    color: 'blue'
  },
  
  [EconomicComponentType.SERVICE_BASED]: {
    id: 'service_based',
    type: EconomicComponentType.SERVICE_BASED,
    name: 'Service-Based Economy',
    description: 'Economy dominated by service sector activities',
    effectiveness: 80,
    synergies: [EconomicComponentType.FINANCE_CENTERED, EconomicComponentType.PROFESSIONAL_SERVICES, EconomicComponentType.KNOWLEDGE_ECONOMY],
    conflicts: [EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.MANUFACTURING_LED],
    governmentSynergies: ['SERVICE_ECONOMY', 'PROFESSIONAL_SERVICES', 'KNOWLEDGE_ECONOMY'],
    governmentConflicts: ['MANUFACTURING_FOCUS', 'RESOURCE_EXTRACTION'],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.80
    },
    sectorImpact: {
      'services': 2.0,
      'finance': 1.6,
      'professional': 1.8,
      'education': 1.3,
      'healthcare': 1.4,
      'manufacturing': 0.6,
      'agriculture': 0.4
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.2,
      wageGrowthModifier: 1.1
    },
    implementationCost: 120000,
    maintenanceCost: 65000,
    requiredCapacity: 80,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Users,
    color: 'purple'
  },
  
  [EconomicComponentType.TECHNOLOGY_FOCUSED]: {
    id: 'technology_focused',
    type: EconomicComponentType.TECHNOLOGY_FOCUSED,
    name: 'Technology-Focused Economy',
    description: 'Economy centered on technology development and digital services',
    effectiveness: 92,
    synergies: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.INNOVATION_ECONOMY, EconomicComponentType.STARTUP_ECOSYSTEM],
    conflicts: [EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.RESOURCE_BASED_ECONOMY],
    governmentSynergies: ['DIGITAL_GOVERNMENT', 'TECHNOLOGY_TRANSFER', 'INNOVATION_ECOSYSTEM'],
    governmentConflicts: ['TRADITIONAL_LEGITIMACY', 'RESOURCE_EXTRACTION'],
    taxImpact: {
      optimalCorporateRate: 15,
      optimalIncomeRate: 25,
      revenueEfficiency: 0.92
    },
    sectorImpact: {
      'technology': 2.5,
      'information': 2.3,
      'professional': 1.9,
      'finance': 1.4,
      'education': 1.6,
      'manufacturing': 0.8,
      'agriculture': 0.3
    },
    employmentImpact: {
      unemploymentModifier: -2.5,
      participationModifier: 1.5,
      wageGrowthModifier: 1.8
    },
    implementationCost: 300000,
    maintenanceCost: 150000,
    requiredCapacity: 95,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Zap,
    color: 'cyan'
  },
  
  [EconomicComponentType.FINANCE_CENTERED]: {
    id: 'finance_centered',
    type: EconomicComponentType.FINANCE_CENTERED,
    name: 'Finance-Centered Economy',
    description: 'Economy focused on financial services and banking',
    effectiveness: 85,
    synergies: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.FREE_TRADE, EconomicComponentType.PROFESSIONAL_SERVICES],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.PROTECTIONIST, EconomicComponentType.AGRICULTURE_LED],
    governmentSynergies: ['FINANCIAL_REGULATION', 'FREE_MARKET_SYSTEM', 'PROFESSIONAL_SERVICES'],
    governmentConflicts: ['PLANNED_ECONOMY', 'CENTRALIZED_POWER'],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.85
    },
    sectorImpact: {
      'finance': 2.8,
      'professional': 1.9,
      'services': 1.4,
      'technology': 1.3,
      'manufacturing': 0.5,
      'agriculture': 0.3
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 90,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: DollarSign,
    color: 'green'
  },
  
  // Labor System Components
  [EconomicComponentType.FLEXIBLE_LABOR]: {
    id: 'flexible_labor',
    type: EconomicComponentType.FLEXIBLE_LABOR,
    name: 'Flexible Labor Market',
    description: 'Labor market with minimal restrictions on hiring and firing',
    effectiveness: 82,
    synergies: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.GIG_ECONOMY, EconomicComponentType.STARTUP_ECOSYSTEM],
    conflicts: [EconomicComponentType.UNION_BASED, EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.SOCIAL_MARKET_ECONOMY],
    governmentSynergies: ['FREE_MARKET_SYSTEM', 'MINIMAL_REGULATION', 'ENTREPRENEURSHIP_SUPPORT'],
    governmentConflicts: ['WORKER_PROTECTION', 'UNION_RIGHTS', 'SOCIAL_SAFETY_NET'],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.82
    },
    sectorImpact: {
      'services': 1.3,
      'technology': 1.4,
      'professional': 1.2,
      'manufacturing': 1.1,
      'government': 0.7
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.2,
      wageGrowthModifier: 1.1
    },
    implementationCost: 40000,
    maintenanceCost: 20000,
    requiredCapacity: 50,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Unlock,
    color: 'green'
  },
  
  [EconomicComponentType.PROTECTED_WORKERS]: {
    id: 'protected_workers',
    type: EconomicComponentType.PROTECTED_WORKERS,
    name: 'Protected Worker Rights',
    description: 'Strong labor protections and worker rights',
    effectiveness: 75,
    synergies: [EconomicComponentType.UNION_BASED, EconomicComponentType.SOCIAL_MARKET_ECONOMY, EconomicComponentType.EDUCATION_FIRST],
    conflicts: [EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.GIG_ECONOMY, EconomicComponentType.FREE_MARKET_SYSTEM],
    governmentSynergies: ['WORKER_PROTECTION', 'SOCIAL_SAFETY_NET', 'UNION_RIGHTS'],
    governmentConflicts: ['FREE_MARKET_SYSTEM', 'MINIMAL_REGULATION'],
    taxImpact: {
      optimalCorporateRate: 26,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.75
    },
    sectorImpact: {
      'manufacturing': 1.2,
      'government': 1.3,
      'education': 1.4,
      'healthcare': 1.3,
      'services': 0.9,
      'technology': 0.8
    },
    employmentImpact: {
      unemploymentModifier: 0.5,
      participationModifier: 0.9,
      wageGrowthModifier: 1.2
    },
    implementationCost: 80000,
    maintenanceCost: 45000,
    requiredCapacity: 70,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Shield,
    color: 'blue'
  },
  
  [EconomicComponentType.GIG_ECONOMY]: {
    id: 'gig_economy',
    type: EconomicComponentType.GIG_ECONOMY,
    name: 'Gig Economy',
    description: 'Economy based on short-term contracts and freelance work',
    effectiveness: 78,
    synergies: [EconomicComponentType.FLEXIBLE_LABOR, EconomicComponentType.TECHNOLOGY_FOCUSED, EconomicComponentType.STARTUP_ECOSYSTEM],
    conflicts: [EconomicComponentType.UNION_BASED, EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.SOCIAL_MARKET_ECONOMY],
    governmentSynergies: ['ENTREPRENEURSHIP_SUPPORT', 'DIGITAL_GOVERNMENT', 'FLEXIBLE_REGULATION'],
    governmentConflicts: ['WORKER_PROTECTION', 'UNION_RIGHTS', 'SOCIAL_SAFETY_NET'],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.78
    },
    sectorImpact: {
      'services': 1.5,
      'technology': 1.6,
      'professional': 1.3,
      'transportation': 1.4,
      'manufacturing': 0.8,
      'government': 0.6
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.3,
      wageGrowthModifier: 0.9
    },
    implementationCost: 60000,
    maintenanceCost: 30000,
    requiredCapacity: 60,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Briefcase,
    color: 'orange'
  },
  
  [EconomicComponentType.EDUCATION_FIRST]: {
    id: 'education_first',
    type: EconomicComponentType.EDUCATION_FIRST,
    name: 'Education-First Strategy',
    description: 'Priority on education and human capital development',
    effectiveness: 88,
    synergies: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.SKILL_BASED, EconomicComponentType.UNIVERSITY_PARTNERSHIPS],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.RESOURCE_BASED_ECONOMY],
    governmentSynergies: ['PUBLIC_EDUCATION', 'RESEARCH_AND_DEVELOPMENT', 'UNIVERSITY_PARTNERSHIPS'],
    governmentConflicts: ['RESOURCE_EXTRACTION', 'TRADITIONAL_ECONOMY'],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.88
    },
    sectorImpact: {
      'education': 2.2,
      'professional': 1.8,
      'technology': 1.7,
      'healthcare': 1.5,
      'manufacturing': 1.0,
      'agriculture': 0.6
    },
    employmentImpact: {
      unemploymentModifier: -1.8,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6
    },
    implementationCost: 200000,
    maintenanceCost: 100000,
    requiredCapacity: 90,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: GraduationCap,
    color: 'purple'
  },
  
  // Trade Policy Components
  [EconomicComponentType.FREE_TRADE]: {
    id: 'free_trade',
    type: EconomicComponentType.FREE_TRADE,
    name: 'Free Trade Policy',
    description: 'Minimal trade barriers and open international markets',
    effectiveness: 85,
    synergies: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.FINANCE_CENTERED],
    conflicts: [EconomicComponentType.PROTECTIONIST, EconomicComponentType.IMPORT_SUBSTITUTION, EconomicComponentType.TRADE_BLOC],
    governmentSynergies: ['FREE_TRADE', 'INTERNATIONAL_LAW', 'MULTILATERAL_DIPLOMACY'],
    governmentConflicts: ['PROTECTIONIST_POLICY', 'ECONOMIC_NATIONALISM'],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.85
    },
    sectorImpact: {
      'manufacturing': 1.4,
      'services': 1.2,
      'finance': 1.3,
      'agriculture': 1.1,
      'technology': 1.3
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.2,
      wageGrowthModifier: 1.3
    },
    implementationCost: 70000,
    maintenanceCost: 35000,
    requiredCapacity: 70,
    category: EconomicCategory.TRADE_POLICY,
    icon: Globe,
    color: 'blue'
  },
  
  [EconomicComponentType.PROTECTIONIST]: {
    id: 'protectionist',
    type: EconomicComponentType.PROTECTIONIST,
    name: 'Protectionist Trade Policy',
    description: 'Trade barriers to protect domestic industries',
    effectiveness: 65,
    synergies: [EconomicComponentType.DOMESTIC_FOCUSED, EconomicComponentType.IMPORT_SUBSTITUTION, EconomicComponentType.MANUFACTURING_LED],
    conflicts: [EconomicComponentType.FREE_TRADE, EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.FINANCE_CENTERED],
    governmentSynergies: ['PROTECTIONIST_POLICY', 'ECONOMIC_NATIONALISM', 'DOMESTIC_INDUSTRY_SUPPORT'],
    governmentConflicts: ['FREE_TRADE', 'INTERNATIONAL_COOPERATION'],
    taxImpact: {
      optimalCorporateRate: 28,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.65
    },
    sectorImpact: {
      'manufacturing': 1.3,
      'agriculture': 1.2,
      'services': 0.9,
      'finance': 0.7,
      'technology': 0.8
    },
    employmentImpact: {
      unemploymentModifier: 1.5,
      participationModifier: 0.9,
      wageGrowthModifier: 0.8
    },
    implementationCost: 90000,
    maintenanceCost: 50000,
    requiredCapacity: 75,
    category: EconomicCategory.TRADE_POLICY,
    icon: Lock,
    color: 'red'
  },
  
  [EconomicComponentType.EXPORT_ORIENTED]: {
    id: 'export_oriented',
    type: EconomicComponentType.EXPORT_ORIENTED,
    name: 'Export-Oriented Growth',
    description: 'Focus on producing goods and services for international markets',
    effectiveness: 80,
    synergies: [EconomicComponentType.FREE_TRADE, EconomicComponentType.MANUFACTURING_LED, EconomicComponentType.TECHNOLOGY_FOCUSED],
    conflicts: [EconomicComponentType.DOMESTIC_FOCUSED, EconomicComponentType.PROTECTIONIST, EconomicComponentType.TOURISM_BASED],
    governmentSynergies: ['EXPORT_PROMOTION', 'TRADE_AGREEMENTS', 'INTERNATIONAL_MARKETING'],
    governmentConflicts: ['PROTECTIONIST_POLICY', 'DOMESTIC_FOCUS'],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.80
    },
    sectorImpact: {
      'manufacturing': 1.6,
      'agriculture': 1.4,
      'services': 1.2,
      'technology': 1.3,
      'finance': 1.1
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.2,
      wageGrowthModifier: 1.2
    },
    implementationCost: 110000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: EconomicCategory.TRADE_POLICY,
    icon: ArrowUpDown,
    color: 'green'
  },
  
  // Innovation Components
  [EconomicComponentType.RD_INVESTMENT]: {
    id: 'rd_investment',
    type: EconomicComponentType.RD_INVESTMENT,
    name: 'R&D Investment Priority',
    description: 'High investment in research and development activities',
    effectiveness: 90,
    synergies: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.INNOVATION_ECONOMY, EconomicComponentType.UNIVERSITY_PARTNERSHIPS],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.RESOURCE_BASED_ECONOMY],
    governmentSynergies: ['RESEARCH_AND_DEVELOPMENT', 'INNOVATION_ECOSYSTEM', 'SCIENTIFIC_RESEARCH'],
    governmentConflicts: ['TRADITIONAL_ECONOMY', 'RESOURCE_EXTRACTION'],
    taxImpact: {
      optimalCorporateRate: 16,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.90
    },
    sectorImpact: {
      'technology': 2.2,
      'professional': 1.8,
      'education': 1.9,
      'manufacturing': 1.3,
      'healthcare': 1.6,
      'agriculture': 0.7
    },
    employmentImpact: {
      unemploymentModifier: -2.0,
      participationModifier: 1.4,
      wageGrowthModifier: 1.7
    },
    implementationCost: 250000,
    maintenanceCost: 125000,
    requiredCapacity: 95,
    category: EconomicCategory.INNOVATION,
    icon: Lightbulb,
    color: 'yellow'
  },
  
  [EconomicComponentType.STARTUP_ECOSYSTEM]: {
    id: 'startup_ecosystem',
    type: EconomicComponentType.STARTUP_ECOSYSTEM,
    name: 'Startup Ecosystem',
    description: 'Supportive environment for new business creation and growth',
    effectiveness: 87,
    synergies: [EconomicComponentType.INNOVATION_ECONOMY, EconomicComponentType.VENTURE_CAPITAL, EconomicComponentType.FLEXIBLE_LABOR],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.PROTECTED_WORKERS, EconomicComponentType.STATE_CAPITALISM],
    governmentSynergies: ['STARTUP_INCUBATION', 'ENTREPRENEURSHIP_SUPPORT', 'INNOVATION_ECOSYSTEM'],
    governmentConflicts: ['PLANNED_ECONOMY', 'CENTRALIZED_CONTROL'],
    taxImpact: {
      optimalCorporateRate: 17,
      optimalIncomeRate: 27,
      revenueEfficiency: 0.87
    },
    sectorImpact: {
      'technology': 2.0,
      'professional': 1.7,
      'finance': 1.5,
      'services': 1.3,
      'manufacturing': 1.1,
      'agriculture': 0.6
    },
    employmentImpact: {
      unemploymentModifier: -1.8,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: EconomicCategory.INNOVATION,
    icon: Zap,
    color: 'cyan'
  },
  
  [EconomicComponentType.UNIVERSITY_PARTNERSHIPS]: {
    id: 'university_partnerships',
    type: EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
    name: 'University-Industry Partnerships',
    description: 'Strong collaboration between universities and industry',
    effectiveness: 86,
    synergies: [EconomicComponentType.EDUCATION_FIRST, EconomicComponentType.RD_INVESTMENT, EconomicComponentType.TECH_TRANSFER],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.RESOURCE_BASED_ECONOMY],
    governmentSynergies: ['UNIVERSITY_PARTNERSHIPS', 'RESEARCH_AND_DEVELOPMENT', 'EDUCATION_SYSTEM'],
    governmentConflicts: ['TRADITIONAL_ECONOMY', 'RESOURCE_EXTRACTION'],
    taxImpact: {
      optimalCorporateRate: 19,
      optimalIncomeRate: 29,
      revenueEfficiency: 0.86
    },
    sectorImpact: {
      'education': 2.0,
      'technology': 1.9,
      'professional': 1.8,
      'healthcare': 1.6,
      'manufacturing': 1.2,
      'agriculture': 0.8
    },
    employmentImpact: {
      unemploymentModifier: -1.6,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5
    },
    implementationCost: 160000,
    maintenanceCost: 80000,
    requiredCapacity: 88,
    category: EconomicCategory.INNOVATION,
    icon: GraduationCap,
    color: 'purple'
  },
  
  // Resource Management Components
  [EconomicComponentType.SUSTAINABLE_DEVELOPMENT]: {
    id: 'sustainable_development',
    type: EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    name: 'Sustainable Development',
    description: 'Development that meets present needs without compromising future generations',
    effectiveness: 83,
    synergies: [EconomicComponentType.RENEWABLE_ENERGY, EconomicComponentType.CIRCULAR_ECONOMY, EconomicComponentType.GREEN_TECHNOLOGY],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.RESOURCE_BASED_ECONOMY, EconomicComponentType.CARBON_INTENSIVE],
    governmentSynergies: ['ENVIRONMENTAL_PROTECTION', 'SUSTAINABLE_DEVELOPMENT', 'GREEN_POLICY'],
    governmentConflicts: ['RESOURCE_EXTRACTION', 'CARBON_INTENSIVE_INDUSTRY'],
    taxImpact: {
      optimalCorporateRate: 23,
      optimalIncomeRate: 31,
      revenueEfficiency: 0.83
    },
    sectorImpact: {
      'renewable_energy': 2.0,
      'technology': 1.4,
      'manufacturing': 1.1,
      'agriculture': 1.2,
      'mining': 0.6,
      'utilities': 1.3
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2
    },
    implementationCost: 140000,
    maintenanceCost: 70000,
    requiredCapacity: 82,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: 'green'
  },
  
  [EconomicComponentType.EXTRACTION_FOCUSED]: {
    id: 'extraction_focused',
    type: EconomicComponentType.EXTRACTION_FOCUSED,
    name: 'Resource Extraction Focus',
    description: 'Economy centered on natural resource extraction and processing',
    effectiveness: 72,
    synergies: [EconomicComponentType.RESOURCE_BASED_ECONOMY, EconomicComponentType.EXPORT_ORIENTED, EconomicComponentType.MANUFACTURING_LED],
    conflicts: [EconomicComponentType.SUSTAINABLE_DEVELOPMENT, EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.GREEN_TECHNOLOGY],
    governmentSynergies: ['RESOURCE_EXTRACTION', 'MINING_INDUSTRY', 'EXPORT_ORIENTED'],
    governmentConflicts: ['ENVIRONMENTAL_PROTECTION', 'SUSTAINABLE_DEVELOPMENT'],
    taxImpact: {
      optimalCorporateRate: 32,
      optimalIncomeRate: 34,
      revenueEfficiency: 0.72
    },
    sectorImpact: {
      'mining': 2.5,
      'manufacturing': 1.3,
      'utilities': 1.4,
      'agriculture': 1.0,
      'technology': 0.6,
      'services': 0.7
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.9,
      wageGrowthModifier: 0.9
    },
    implementationCost: 95000,
    maintenanceCost: 55000,
    requiredCapacity: 70,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Wrench,
    color: 'orange'
  },
  
  [EconomicComponentType.RENEWABLE_ENERGY]: {
    id: 'renewable_energy',
    type: EconomicComponentType.RENEWABLE_ENERGY,
    name: 'Renewable Energy Transition',
    description: 'Focus on renewable energy sources and clean technology',
    effectiveness: 85,
    synergies: [EconomicComponentType.SUSTAINABLE_DEVELOPMENT, EconomicComponentType.GREEN_TECHNOLOGY, EconomicComponentType.CIRCULAR_ECONOMY],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.RESOURCE_BASED_ECONOMY, EconomicComponentType.CARBON_INTENSIVE],
    governmentSynergies: ['RENEWABLE_ENERGY', 'ENVIRONMENTAL_PROTECTION', 'GREEN_TECHNOLOGY'],
    governmentConflicts: ['FOSSIL_FUEL_INDUSTRY', 'CARBON_INTENSIVE_POLICY'],
    taxImpact: {
      optimalCorporateRate: 21,
      optimalIncomeRate: 29,
      revenueEfficiency: 0.85
    },
    sectorImpact: {
      'renewable_energy': 2.8,
      'technology': 1.6,
      'manufacturing': 1.4,
      'utilities': 1.7,
      'mining': 0.4,
      'services': 1.1
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.2,
      wageGrowthModifier: 1.3
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: 'green'
  },
  
  [EconomicComponentType.CIRCULAR_ECONOMY]: {
    id: 'circular_economy',
    type: EconomicComponentType.CIRCULAR_ECONOMY,
    name: 'Circular Economy',
    description: 'Economy focused on reducing waste and reusing resources',
    effectiveness: 84,
    synergies: [EconomicComponentType.SUSTAINABLE_DEVELOPMENT, EconomicComponentType.GREEN_TECHNOLOGY, EconomicComponentType.RENEWABLE_ENERGY],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.RESOURCE_BASED_ECONOMY, EconomicComponentType.LINEAR_ECONOMY],
    governmentSynergies: ['CIRCULAR_ECONOMY', 'WASTE_REDUCTION', 'RESOURCE_EFFICIENCY'],
    governmentConflicts: ['LINEAR_ECONOMY', 'WASTE_GENERATION'],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.84
    },
    sectorImpact: {
      'manufacturing': 1.5,
      'technology': 1.6,
      'utilities': 1.4,
      'services': 1.2,
      'mining': 0.5,
      'agriculture': 1.3
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2
    },
    implementationCost: 150000,
    maintenanceCost: 75000,
    requiredCapacity: 83,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: 'green'
  }
};

// Component Categories
export const COMPONENT_CATEGORIES = {
  economicModel: {
    name: 'Economic Model',
    description: 'Fundamental economic system and philosophy',
    icon: BarChart3,
    components: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.RESOURCE_BASED_ECONOMY
    ]
  },
  sectorFocus: {
    name: 'Sector Focus',
    description: 'Primary economic sectors and specializations',
    icon: Factory,
    components: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.TOURISM_BASED
    ]
  },
  laborSystem: {
    name: 'Labor System',
    description: 'Labor market structure and worker rights',
    icon: Users,
    components: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.GIG_ECONOMY,
      EconomicComponentType.PROFESSIONAL_SERVICES,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.EDUCATION_FIRST,
      EconomicComponentType.MERIT_BASED
    ]
  },
  tradePolicy: {
    name: 'Trade Policy',
    description: 'International trade and commerce approach',
    icon: Globe,
    components: [
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.EXPORT_SUBSIDY,
      EconomicComponentType.IMPORT_SUBSTITUTION,
      EconomicComponentType.TRADE_BLOC,
      EconomicComponentType.BILATERAL_FOCUS,
      EconomicComponentType.MULTILATERAL_FOCUS
    ]
  },
  innovation: {
    name: 'Innovation',
    description: 'Research, development, and innovation ecosystem',
    icon: Lightbulb,
    components: [
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.TECH_TRANSFER,
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.PATENT_PROTECTION,
      EconomicComponentType.OPEN_INNOVATION,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
      EconomicComponentType.VENTURE_CAPITAL,
      EconomicComponentType.INTELLECTUAL_PROPERTY
    ]
  },
  resourceManagement: {
    name: 'Resource Management',
    description: 'Natural resource use and environmental approach',
    icon: Leaf,
    components: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.ECO_FRIENDLY
    ]
  }
};

// Component Selection Interface
interface AtomicEconomicComponentSelectorProps {
  selectedComponents: EconomicComponentType[];
  onComponentChange: (components: EconomicComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
  governmentComponents?: string[]; // Government atomic components for cross-builder synergies
}

export function AtomicEconomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 12,
  isReadOnly = false,
  governmentComponents = []
}: AtomicEconomicComponentSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof COMPONENT_CATEGORIES>('economicModel');
  const [expandedSynergies, setExpandedSynergies] = useState<Set<string>>(new Set());
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  const calculateSynergies = (components: EconomicComponentType[], govComponents: string[] = []) => {
    let synergyScore = 0;
    let conflictScore = 0;
    let synergyCount = 0;
    let conflictCount = 0;

    // Internal economic component synergies and conflicts
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          const component2 = ATOMIC_ECONOMIC_COMPONENTS[comp2];

          if (component1?.synergies.includes(comp2)) {
            synergyScore += 10;
            synergyCount++;
          }
          if (component1?.conflicts.includes(comp2)) {
            conflictScore += 10;
            conflictCount++;
          }
        }
      });

      // Cross-builder synergies with government components
      const economicComp = ATOMIC_ECONOMIC_COMPONENTS[comp1];
      if (economicComp && govComponents.length > 0) {
        govComponents.forEach(govComp => {
          if (economicComp.governmentSynergies?.includes(govComp)) {
            synergyScore += 15; // Cross-builder synergies worth more
            synergyCount++;
          }
          if (economicComp.governmentConflicts?.includes(govComp)) {
            conflictScore += 15; // Cross-builder conflicts penalize more
            conflictCount++;
          }
        });
      }
    });

    return { synergyScore, conflictScore, synergyCount, conflictCount };
  };
  
  const toggleComponent = (componentType: EconomicComponentType) => {
    if (isReadOnly) return;

    if (selectedComponents.includes(componentType)) {
      onComponentChange(selectedComponents.filter(c => c !== componentType));
    } else if (selectedComponents.length < maxComponents) {
      onComponentChange([...selectedComponents, componentType]);
    }
  };

  const { synergyScore, conflictScore, synergyCount, conflictCount } = calculateSynergies(selectedComponents, governmentComponents);
  const effectivenessScore = selectedComponents.reduce(
    (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
  ) / selectedComponents.length || 0;

  return (
    <div className="space-y-6">
      {/* Effectiveness Summary */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-br from-white/60 to-white/40 dark:from-slate-800/60 dark:to-slate-800/40 backdrop-blur-sm border border-white/30 dark:border-slate-700/30 rounded-xl shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <Gauge className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold bg-gradient-to-br from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
            {effectivenessScore.toFixed(0)}%
          </div>
          <div className="text-sm font-semibold text-muted-foreground">Effectiveness</div>
        </div>
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
            +{synergyCount}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">Synergies</div>
          <div className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">{synergyScore} pts bonus</div>
        </div>
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold bg-gradient-to-br from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
            {conflictCount > 0 ? '-' : ''}{conflictCount}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">Conflicts</div>
          <div className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">{conflictScore} pts penalty</div>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as keyof typeof COMPONENT_CATEGORIES)}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {Object.entries(COMPONENT_CATEGORIES).map(([key, category]) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              <category.icon className="h-4 w-4 mr-1" />
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(COMPONENT_CATEGORIES).map(([key, category]) => (
          <TabsContent key={key} value={key} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {category.components.map(componentType => {
                const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
                if (!component) return null;
                
                const isSelected = selectedComponents.includes(componentType);
                const canSelect = !isSelected && selectedComponents.length < maxComponents;
                
                return (
                  <Card 
                    key={componentType}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : canSelect 
                          ? 'hover:ring-2 hover:ring-gray-300' 
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => toggleComponent(componentType)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg bg-${component.color}-100 dark:bg-${component.color}-900/20`}>
                          <component.icon className={`h-5 w-5 text-${component.color}-600 dark:text-${component.color}-400`} />
                        </div>
                        <Badge variant={isSelected ? "default" : "secondary"}>
                          {component.effectiveness}%
                        </Badge>
                      </div>
                      <CardTitle className="text-sm">{component.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground mb-3">
                        {component.description}
                      </p>
                      
                      {/* Synergies */}
                      {component.synergies.length > 0 && (
                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1">
                            {(expandedSynergies.has(componentType) ? component.synergies : component.synergies.slice(0, 2)).map(synergy => {
                              const synergyActive = selectedComponents.includes(synergy);
                              const synergyName = ATOMIC_ECONOMIC_COMPONENTS[synergy]?.name ||
                                synergy.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                              return (
                                <Badge
                                  key={synergy}
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-5 ${
                                    synergyActive
                                      ? 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-300'
                                      : 'border-green-500/20 text-green-600/80 dark:text-green-400/80'
                                  }`}
                                >
                                  {synergyActive && '★ '}
                                  {synergyName}
                                </Badge>
                              );
                            })}
                            {component.synergies.length > 2 && !expandedSynergies.has(componentType) && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-5 border-green-500/20 text-green-600/70 dark:text-green-400/70 cursor-pointer hover:bg-green-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSynergies(prev => new Set([...prev, componentType]));
                                }}
                              >
                                +{component.synergies.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conflicts */}
                      {component.conflicts.length > 0 && (
                        <div>
                          <div className="flex flex-wrap gap-1">
                            {(expandedConflicts.has(componentType) ? component.conflicts : component.conflicts.slice(0, 2)).map(conflict => {
                              const conflictActive = selectedComponents.includes(conflict);
                              const conflictName = ATOMIC_ECONOMIC_COMPONENTS[conflict]?.name ||
                                conflict.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                              return (
                                <Badge
                                  key={conflict}
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-5 ${
                                    conflictActive
                                      ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300'
                                      : 'border-red-500/20 text-red-600/80 dark:text-red-400/80'
                                  }`}
                                >
                                  {conflictActive && '⚠ '}
                                  {conflictName}
                                </Badge>
                              );
                            })}
                            {component.conflicts.length > 2 && !expandedConflicts.has(componentType) && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-5 border-red-500/20 text-red-600/70 dark:text-red-400/70 cursor-pointer hover:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedConflicts(prev => new Set([...prev, componentType]));
                                }}
                              >
                                +{component.conflicts.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
