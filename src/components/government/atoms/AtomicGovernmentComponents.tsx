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
  MILITARY_ENFORCEMENT = "MILITARY_ENFORCEMENT"
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
    ComponentType.RELIGIOUS_LEGITIMACY
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
          <span className="text-sm font-medium">
            Components Selected: {selectedComponents.length} / {maxComponents}
          </span>
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(selectedComponents.length / maxComponents) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as keyof typeof COMPONENT_CATEGORIES)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="powerDistribution" className="text-xs">Power</TabsTrigger>
            <TabsTrigger value="decisionProcess" className="text-xs">Decisions</TabsTrigger>
            <TabsTrigger value="legitimacySources" className="text-xs">Legitimacy</TabsTrigger>
            <TabsTrigger value="institutions" className="text-xs">Institutions</TabsTrigger>
            <TabsTrigger value="controlMechanisms" className="text-xs">Control</TabsTrigger>
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
                          ? 'border-blue-500 bg-blue-50' 
                          : hasConflict && !isSelected
                            ? 'border-red-200 bg-red-50 opacity-60'
                            : hasSynergy && !isSelected
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                      } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={() => toggleComponent(componentType)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{component?.name}</h4>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {component?.effectiveness}%
                          </Badge>
                          {isSelected && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {hasConflict && !isSelected && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {hasSynergy && !isSelected && <TrendingUp className="h-4 w-4 text-green-500" />}
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-3">
                        {component?.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs">
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
            <h4 className="font-semibold">Selected Components</h4>
            <div className="flex flex-wrap gap-2">
              {selectedComponents.map(componentType => (
                <Badge 
                  key={componentType} 
                  variant="default" 
                  className="flex items-center gap-1"
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
                    (sum, comp) => sum + (ATOMIC_COMPONENTS[comp]?.implementationCost || 0), 0
                  ) / 1000)}k
                </div>
                <div className="text-sm text-muted-foreground">
                  Implementation Cost
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