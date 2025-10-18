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
  Crown, 
  Users, 
  Scale, 
  Building2, 
  Zap, 
  Target, 
  Plus, 
  Minus,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
  TrendingUp,
  Shield
} from 'lucide-react';

// Atomic Government Component Types
export interface AtomicGovernmentComponent {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: string[];
  conflicts: string[];
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
}

export enum ComponentType {
  // Power Distribution Components
  CENTRALIZED_POWER = "CENTRALIZED_POWER",
  FEDERAL_SYSTEM = "FEDERAL_SYSTEM",
  CONFEDERATE_SYSTEM = "CONFEDERATE_SYSTEM",
  UNITARY_SYSTEM = "UNITARY_SYSTEM",
  
  // Decision Process Components
  DEMOCRATIC_PROCESS = "DEMOCRATIC_PROCESS",
  AUTOCRATIC_PROCESS = "AUTOCRATIC_PROCESS",
  TECHNOCRATIC_PROCESS = "TECHNOCRATIC_PROCESS",
  CONSENSUS_PROCESS = "CONSENSUS_PROCESS",
  OLIGARCHIC_PROCESS = "OLIGARCHIC_PROCESS",
  
  // Legitimacy Source Components
  ELECTORAL_LEGITIMACY = "ELECTORAL_LEGITIMACY",
  TRADITIONAL_LEGITIMACY = "TRADITIONAL_LEGITIMACY",
  PERFORMANCE_LEGITIMACY = "PERFORMANCE_LEGITIMACY",
  CHARISMATIC_LEGITIMACY = "CHARISMATIC_LEGITIMACY",
  RELIGIOUS_LEGITIMACY = "RELIGIOUS_LEGITIMACY",
  INSTITUTIONAL_LEGITIMACY = "INSTITUTIONAL_LEGITIMACY",
  
  // Institution Components
  PROFESSIONAL_BUREAUCRACY = "PROFESSIONAL_BUREAUCRACY",
  MILITARY_ADMINISTRATION = "MILITARY_ADMINISTRATION",
  INDEPENDENT_JUDICIARY = "INDEPENDENT_JUDICIARY",
  PARTISAN_INSTITUTIONS = "PARTISAN_INSTITUTIONS",
  TECHNOCRATIC_AGENCIES = "TECHNOCRATIC_AGENCIES",
  
  // Control Mechanism Components
  RULE_OF_LAW = "RULE_OF_LAW",
  SURVEILLANCE_SYSTEM = "SURVEILLANCE_SYSTEM",
  ECONOMIC_INCENTIVES = "ECONOMIC_INCENTIVES",
  SOCIAL_PRESSURE = "SOCIAL_PRESSURE",
  MILITARY_ENFORCEMENT = "MILITARY_ENFORCEMENT",
  
  // Economic Governance Components
  FREE_MARKET_SYSTEM = "FREE_MARKET_SYSTEM",
  PLANNED_ECONOMY = "PLANNED_ECONOMY",
  MIXED_ECONOMY = "MIXED_ECONOMY",
  CORPORATIST_SYSTEM = "CORPORATIST_SYSTEM",
  SOCIAL_MARKET_ECONOMY = "SOCIAL_MARKET_ECONOMY",
  STATE_CAPITALISM = "STATE_CAPITALISM",
  RESOURCE_BASED_ECONOMY = "RESOURCE_BASED_ECONOMY",
  KNOWLEDGE_ECONOMY = "KNOWLEDGE_ECONOMY",
  
  // Administrative Efficiency Components
  DIGITAL_GOVERNMENT = "DIGITAL_GOVERNMENT",
  E_GOVERNANCE = "E_GOVERNANCE",
  ADMINISTRATIVE_DECENTRALIZATION = "ADMINISTRATIVE_DECENTRALIZATION",
  MERIT_BASED_SYSTEM = "MERIT_BASED_SYSTEM",
  PERFORMANCE_MANAGEMENT = "PERFORMANCE_MANAGEMENT",
  QUALITY_ASSURANCE = "QUALITY_ASSURANCE",
  STRATEGIC_PLANNING = "STRATEGIC_PLANNING",
  RISK_MANAGEMENT = "RISK_MANAGEMENT",
  
  // Social Policy Components
  WELFARE_STATE = "WELFARE_STATE",
  UNIVERSAL_HEALTHCARE = "UNIVERSAL_HEALTHCARE",
  PUBLIC_EDUCATION = "PUBLIC_EDUCATION",
  SOCIAL_SAFETY_NET = "SOCIAL_SAFETY_NET",
  WORKER_PROTECTION = "WORKER_PROTECTION",
  ENVIRONMENTAL_PROTECTION = "ENVIRONMENTAL_PROTECTION",
  CULTURAL_PRESERVATION = "CULTURAL_PRESERVATION",
  MINORITY_RIGHTS = "MINORITY_RIGHTS",
  
  // International Relations Components
  MULTILATERAL_DIPLOMACY = "MULTILATERAL_DIPLOMACY",
  BILATERAL_RELATIONS = "BILATERAL_RELATIONS",
  REGIONAL_INTEGRATION = "REGIONAL_INTEGRATION",
  INTERNATIONAL_LAW = "INTERNATIONAL_LAW",
  DEVELOPMENT_AID = "DEVELOPMENT_AID",
  HUMANITARIAN_INTERVENTION = "HUMANITARIAN_INTERVENTION",
  TRADE_AGREEMENTS = "TRADE_AGREEMENTS",
  SECURITY_ALLIANCES = "SECURITY_ALLIANCES",
  
  // Innovation and Development Components
  RESEARCH_AND_DEVELOPMENT = "RESEARCH_AND_DEVELOPMENT",
  INNOVATION_ECOSYSTEM = "INNOVATION_ECOSYSTEM",
  TECHNOLOGY_TRANSFER = "TECHNOLOGY_TRANSFER",
  ENTREPRENEURSHIP_SUPPORT = "ENTREPRENEURSHIP_SUPPORT",
  INTELLECTUAL_PROPERTY = "INTELLECTUAL_PROPERTY",
  STARTUP_INCUBATION = "STARTUP_INCUBATION",
  DIGITAL_INFRASTRUCTURE = "DIGITAL_INFRASTRUCTURE",
  SMART_CITIES = "SMART_CITIES",
  
  // Crisis Management Components
  EMERGENCY_RESPONSE = "EMERGENCY_RESPONSE",
  DISASTER_PREPAREDNESS = "DISASTER_PREPAREDNESS",
  PANDEMIC_MANAGEMENT = "PANDEMIC_MANAGEMENT",
  CYBERSECURITY = "CYBERSECURITY",
  COUNTER_TERRORISM = "COUNTER_TERRORISM",
  CRISIS_COMMUNICATION = "CRISIS_COMMUNICATION",
  RECOVERY_PLANNING = "RECOVERY_PLANNING",
  RESILIENCE_BUILDING = "RESILIENCE_BUILDING",

  // Governance Quality Components
  ANTI_CORRUPTION = "ANTI_CORRUPTION",
  TRANSPARENCY_INITIATIVE = "TRANSPARENCY_INITIATIVE",

  // Additional Government Systems (from Prisma schema)
  MINIMAL_GOVERNMENT = "MINIMAL_GOVERNMENT",
  PRIVATE_SECTOR_LEADERSHIP = "PRIVATE_SECTOR_LEADERSHIP",
  SOCIAL_DEMOCRACY = "SOCIAL_DEMOCRACY",
  COMPREHENSIVE_WELFARE = "COMPREHENSIVE_WELFARE",
  PUBLIC_SECTOR_LEADERSHIP = "PUBLIC_SECTOR_LEADERSHIP",
  ENVIRONMENTAL_FOCUS = "ENVIRONMENTAL_FOCUS",
  ECONOMIC_PLANNING = "ECONOMIC_PLANNING",
  DEVELOPMENTAL_STATE = "DEVELOPMENTAL_STATE",
  MERITOCRATIC_SYSTEM = "MERITOCRATIC_SYSTEM",
  REGIONAL_DEVELOPMENT = "REGIONAL_DEVELOPMENT"
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
    requiredCapacity: 75
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
    requiredCapacity: 85
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
    requiredCapacity: 60
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
    requiredCapacity: 70
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
    requiredCapacity: 80
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
    requiredCapacity: 65
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
    requiredCapacity: 90
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
    requiredCapacity: 75
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
    requiredCapacity: 70
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
    requiredCapacity: 85
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
    requiredCapacity: 60
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
    requiredCapacity: 90
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
    requiredCapacity: 70
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
    requiredCapacity: 65
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
    requiredCapacity: 95
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
    requiredCapacity: 80
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
    requiredCapacity: 85
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
    requiredCapacity: 65
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
    requiredCapacity: 95
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
    requiredCapacity: 90
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
    requiredCapacity: 75
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
    requiredCapacity: 75
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
    requiredCapacity: 55
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
    requiredCapacity: 85
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
    requiredCapacity: 70
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
    requiredCapacity: 85
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
    requiredCapacity: 75
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
    requiredCapacity: 80
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 75
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
    requiredCapacity: 95
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
    requiredCapacity: 90
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 90
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 85
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
    requiredCapacity: 90
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 75
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
    requiredCapacity: 80
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
    requiredCapacity: 70
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
    requiredCapacity: 75
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 90
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 90
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
    requiredCapacity: 80
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
    requiredCapacity: 90
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
    requiredCapacity: 95
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
    requiredCapacity: 95
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
    requiredCapacity: 85
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
    requiredCapacity: 85
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
    requiredCapacity: 80
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
    requiredCapacity: 85
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
    requiredCapacity: 95
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
    requiredCapacity: 95
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
    requiredCapacity: 90
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
    requiredCapacity: 85
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
    requiredCapacity: 90
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
    requiredCapacity: 95
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
    requiredCapacity: 90
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
    requiredCapacity: 80
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
    requiredCapacity: 80
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
    requiredCapacity: 85
  }
};

// Component Category Groupings
export const COMPONENT_CATEGORIES = {
  powerDistribution: [
    ComponentType.CENTRALIZED_POWER,
    ComponentType.FEDERAL_SYSTEM,
    ComponentType.CONFEDERATE_SYSTEM,
    ComponentType.UNITARY_SYSTEM
  ],
  decisionProcess: [
    ComponentType.DEMOCRATIC_PROCESS,
    ComponentType.AUTOCRATIC_PROCESS,
    ComponentType.TECHNOCRATIC_PROCESS,
    ComponentType.CONSENSUS_PROCESS,
    ComponentType.OLIGARCHIC_PROCESS
  ],
  legitimacySources: [
    ComponentType.ELECTORAL_LEGITIMACY,
    ComponentType.TRADITIONAL_LEGITIMACY,
    ComponentType.PERFORMANCE_LEGITIMACY,
    ComponentType.CHARISMATIC_LEGITIMACY,
    ComponentType.RELIGIOUS_LEGITIMACY,
    ComponentType.INSTITUTIONAL_LEGITIMACY
  ],
  institutions: [
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.MILITARY_ADMINISTRATION,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.PARTISAN_INSTITUTIONS,
    ComponentType.TECHNOCRATIC_AGENCIES
  ],
  controlMechanisms: [
    ComponentType.RULE_OF_LAW,
    ComponentType.SURVEILLANCE_SYSTEM,
    ComponentType.ECONOMIC_INCENTIVES,
    ComponentType.SOCIAL_PRESSURE,
    ComponentType.MILITARY_ENFORCEMENT
  ],
  economicGovernance: [
    ComponentType.FREE_MARKET_SYSTEM,
    ComponentType.PLANNED_ECONOMY,
    ComponentType.MIXED_ECONOMY,
    ComponentType.CORPORATIST_SYSTEM,
    ComponentType.SOCIAL_MARKET_ECONOMY,
    ComponentType.STATE_CAPITALISM,
    ComponentType.RESOURCE_BASED_ECONOMY,
    ComponentType.KNOWLEDGE_ECONOMY
  ],
  administrativeEfficiency: [
    ComponentType.DIGITAL_GOVERNMENT,
    ComponentType.E_GOVERNANCE,
    ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    ComponentType.MERIT_BASED_SYSTEM,
    ComponentType.PERFORMANCE_MANAGEMENT,
    ComponentType.QUALITY_ASSURANCE,
    ComponentType.STRATEGIC_PLANNING,
    ComponentType.RISK_MANAGEMENT
  ],
  socialPolicy: [
    ComponentType.WELFARE_STATE,
    ComponentType.UNIVERSAL_HEALTHCARE,
    ComponentType.PUBLIC_EDUCATION,
    ComponentType.SOCIAL_SAFETY_NET,
    ComponentType.WORKER_PROTECTION,
    ComponentType.ENVIRONMENTAL_PROTECTION,
    ComponentType.CULTURAL_PRESERVATION,
    ComponentType.MINORITY_RIGHTS
  ],
  internationalRelations: [
    ComponentType.MULTILATERAL_DIPLOMACY,
    ComponentType.BILATERAL_RELATIONS,
    ComponentType.REGIONAL_INTEGRATION,
    ComponentType.INTERNATIONAL_LAW,
    ComponentType.DEVELOPMENT_AID,
    ComponentType.HUMANITARIAN_INTERVENTION,
    ComponentType.TRADE_AGREEMENTS,
    ComponentType.SECURITY_ALLIANCES
  ],
  innovationAndDevelopment: [
    ComponentType.RESEARCH_AND_DEVELOPMENT,
    ComponentType.INNOVATION_ECOSYSTEM,
    ComponentType.TECHNOLOGY_TRANSFER,
    ComponentType.ENTREPRENEURSHIP_SUPPORT,
    ComponentType.INTELLECTUAL_PROPERTY,
    ComponentType.STARTUP_INCUBATION,
    ComponentType.DIGITAL_INFRASTRUCTURE,
    ComponentType.SMART_CITIES
  ],
  crisisManagement: [
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

interface AtomicComponentSelectorProps {
  selectedComponents: ComponentType[];
  onComponentChange: (components: ComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
}

export function AtomicComponentSelector({ 
  selectedComponents, 
  onComponentChange, 
  maxComponents = 10,
  isReadOnly = false 
}: AtomicComponentSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof COMPONENT_CATEGORIES>('powerDistribution');
  
  const calculateSynergies = (components: ComponentType[]) => {
    let synergyScore = 0;
    let conflictScore = 0;
    
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_COMPONENTS[comp1];
          const component2 = ATOMIC_COMPONENTS[comp2];
          
          if (component1?.synergies.includes(comp2)) synergyScore += 10;
          if (component1?.conflicts.includes(comp2)) conflictScore += 10;
        }
      });
    });
    
    return { synergyScore, conflictScore };
  };
  
  const toggleComponent = (componentType: ComponentType) => {
    if (isReadOnly) return;
    
    if (selectedComponents.includes(componentType)) {
      onComponentChange(selectedComponents.filter(c => c !== componentType));
    } else if (selectedComponents.length < maxComponents) {
      onComponentChange([...selectedComponents, componentType]);
    }
  };
  
  const { synergyScore, conflictScore } = calculateSynergies(selectedComponents);
  const effectivenessScore = selectedComponents.reduce(
    (sum, comp) => sum + (ATOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
  ) / selectedComponents.length || 0;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Atomic Government Components</CardTitle>
              <p className="text-sm text-muted-foreground">
                Build your government using atomic components that interact and create emergent complexity
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{effectivenessScore.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Effectiveness</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">+{synergyScore}</div>
              <div className="text-xs text-muted-foreground">Synergies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">-{conflictScore}</div>
              <div className="text-xs text-muted-foreground">Conflicts</div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Component Selection Progress */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium text-foreground">
            Components Selected: {selectedComponents.length} / {maxComponents}
          </span>
          <div className="w-32 bg-muted-foreground/20 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${maxComponents > 0 ? Math.min(100, (selectedComponents.length / maxComponents) * 100) : 0}%` }}
            />
          </div>
        </div>
        
        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as keyof typeof COMPONENT_CATEGORIES)}>
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-11 bg-muted/50 overflow-x-auto">
            <TabsTrigger value="powerDistribution" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Power</TabsTrigger>
            <TabsTrigger value="decisionProcess" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Decisions</TabsTrigger>
            <TabsTrigger value="legitimacySources" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Legitimacy</TabsTrigger>
            <TabsTrigger value="institutions" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Institutions</TabsTrigger>
            <TabsTrigger value="controlMechanisms" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Control</TabsTrigger>
            <TabsTrigger value="economicGovernance" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Economic</TabsTrigger>
            <TabsTrigger value="administrativeEfficiency" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Admin</TabsTrigger>
            <TabsTrigger value="socialPolicy" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Social</TabsTrigger>
            <TabsTrigger value="internationalRelations" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">International</TabsTrigger>
            <TabsTrigger value="innovationAndDevelopment" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Innovation</TabsTrigger>
            <TabsTrigger value="crisisManagement" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">Crisis</TabsTrigger>
          </TabsList>
          
          {Object.entries(COMPONENT_CATEGORIES).map(([categoryKey, components]) => (
            <TabsContent key={categoryKey} value={categoryKey} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {components.map(componentType => {
                  const component = ATOMIC_COMPONENTS[componentType];
                  const isSelected = selectedComponents.includes(componentType);
                  const hasConflict = selectedComponents.some(selected => 
                    component?.conflicts.includes(selected) || ATOMIC_COMPONENTS[selected]?.conflicts.includes(componentType)
                  );
                  const hasSynergy = selectedComponents.some(selected => 
                    component?.synergies.includes(selected) || ATOMIC_COMPONENTS[selected]?.synergies.includes(componentType)
                  );
                  
                  return (
                    <div
                      key={componentType}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                          : hasConflict && !isSelected
                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 opacity-60'
                            : hasSynergy && !isSelected
                              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                              : 'border-border hover:border-foreground/30'
                      } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={() => toggleComponent(componentType)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm text-foreground">{component?.name}</h4>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {component?.effectiveness}%
                          </Badge>
                          {isSelected && <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
                          {hasConflict && !isSelected && <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />}
                          {hasSynergy && !isSelected && <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mb-3">
                        {component?.description}
                      </p>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>Cost: ${((component?.implementationCost || 0) / 1000).toFixed(0)}k</span>
                          <span>Capacity: {component?.requiredCapacity}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Selected Components Summary */}
        {selectedComponents.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Selected Components</h4>
            <div className="flex flex-wrap gap-2">
              {selectedComponents.map(componentType => (
                <Badge
                  key={componentType}
                  variant="default"
                  className="flex items-center gap-1 bg-primary text-primary-foreground"
                >
                  {ATOMIC_COMPONENTS[componentType]?.name}
                  {!isReadOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComponent(componentType);
                      }}
                      className="ml-1 hover:bg-red-500 rounded-full p-0.5"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            
            {/* System Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold">
                  {effectivenessScore.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  System Effectiveness
                </div>
              </div>
              
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  synergyScore - conflictScore > 0 ? 'text-green-600' : 
                  synergyScore - conflictScore < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {synergyScore - conflictScore > 0 ? '+' : ''}{synergyScore - conflictScore}
                </div>
                <div className="text-sm text-muted-foreground">
                  Net Synergy
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold">
                  ${Math.round(selectedComponents.reduce(
                    (sum, comp) => sum + (ATOMIC_COMPONENTS[comp]?.maintenanceCost || 0), 0
                  ) / 1000)}k
                </div>
                <div className="text-sm text-muted-foreground">
                  Annual Cost
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* System Recommendations */}
        {selectedComponents.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">System Analysis:</p>
                <ul className="text-sm space-y-1">
                  {synergyScore > conflictScore && (
                    <li className="text-green-700">✓ Strong component synergies detected - system should be highly effective</li>
                  )}
                  {conflictScore > synergyScore && (
                    <li className="text-red-700">⚠ Component conflicts detected - may reduce system effectiveness</li>
                  )}
                  {effectivenessScore > 85 && (
                    <li className="text-green-700">✓ High effectiveness components selected</li>
                  )}
                  {effectivenessScore < 70 && (
                    <li className="text-yellow-700">⚠ Consider adding higher effectiveness components</li>
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}