"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Zap, 
  Shield, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Info
} from 'lucide-react';
import { ComponentType } from '@prisma/client';
import { cn } from '~/lib/utils';

// Component categories for organization
export const ATOMIC_COMPONENT_CATEGORIES = {
  POWER_DISTRIBUTION: {
    id: 'POWER_DISTRIBUTION',
    name: 'Power Distribution',
    description: 'How power is distributed across the government',
    icon: Settings,
    color: 'blue',
    components: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.CONFEDERATE_SYSTEM,
      ComponentType.UNITARY_SYSTEM
    ]
  },
  DECISION_PROCESS: {
    id: 'DECISION_PROCESS',
    name: 'Decision Process',
    description: 'How decisions are made in the government',
    icon: Users,
    color: 'green',
    components: [
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.AUTOCRATIC_PROCESS,
      ComponentType.TECHNOCRATIC_PROCESS,
      ComponentType.CONSENSUS_PROCESS,
      ComponentType.OLIGARCHIC_PROCESS
    ]
  },
  LEGITIMACY_SOURCES: {
    id: 'LEGITIMACY_SOURCES',
    name: 'Legitimacy Sources',
    description: 'What gives the government legitimacy',
    icon: Shield,
    color: 'purple',
    components: [
      ComponentType.ELECTORAL_LEGITIMACY,
      ComponentType.TRADITIONAL_LEGITIMACY,
      ComponentType.PERFORMANCE_LEGITIMACY,
      ComponentType.CHARISMATIC_LEGITIMACY,
      ComponentType.RELIGIOUS_LEGITIMACY
    ]
  },
  INSTITUTION_TYPES: {
    id: 'INSTITUTION_TYPES',
    name: 'Institution Types',
    description: 'Types of government institutions',
    icon: Zap,
    color: 'orange',
    components: [
      ComponentType.PROFESSIONAL_BUREAUCRACY,
      ComponentType.MILITARY_ADMINISTRATION,
      ComponentType.INDEPENDENT_JUDICIARY,
      ComponentType.PARTISAN_INSTITUTIONS,
      ComponentType.TECHNOCRATIC_AGENCIES
    ]
  },
  CONTROL_MECHANISMS: {
    id: 'CONTROL_MECHANISMS',
    name: 'Control Mechanisms',
    description: 'How the government maintains control',
    icon: AlertTriangle,
    color: 'red',
    components: [
      ComponentType.RULE_OF_LAW,
      ComponentType.SURVEILLANCE_SYSTEM,
      ComponentType.ECONOMIC_INCENTIVES,
      ComponentType.SOCIAL_PRESSURE,
      ComponentType.MILITARY_ENFORCEMENT
    ]
  }
} as const;

// Component display information
export const ATOMIC_COMPONENT_INFO: Record<ComponentType, {
  name: string;
  description: string;
  effectiveness: number;
  pros: string[];
  cons: string[];
}> = {
  [ComponentType.CENTRALIZED_POWER]: {
    name: 'Centralized Power',
    description: 'Power concentrated in central government',
    effectiveness: 75,
    pros: ['Fast decision making', 'Clear accountability', 'Efficient tax collection'],
    cons: ['Potential for abuse', 'Less local autonomy', 'Single point of failure']
  },
  [ComponentType.FEDERAL_SYSTEM]: {
    name: 'Federal System',
    description: 'Power shared between central and regional governments',
    effectiveness: 70,
    pros: ['Local autonomy', 'Democratic representation', 'Balanced power'],
    cons: ['Slower decisions', 'Coordination challenges', 'Complex taxation']
  },
  [ComponentType.CONFEDERATE_SYSTEM]: {
    name: 'Confederate System',
    description: 'Loose alliance of largely autonomous regions',
    effectiveness: 60,
    pros: ['Maximum local autonomy', 'Cultural preservation', 'Flexible governance'],
    cons: ['Weak central authority', 'Coordination difficulties', 'Potential fragmentation']
  },
  [ComponentType.UNITARY_SYSTEM]: {
    name: 'Unitary System',
    description: 'Single central government with delegated local administration',
    effectiveness: 72,
    pros: ['Clear hierarchy', 'Consistent policies', 'Efficient administration'],
    cons: ['Limited local variation', 'Potential centralization issues', 'Distance from citizens']
  },
  [ComponentType.DEMOCRATIC_PROCESS]: {
    name: 'Democratic Process',
    description: 'Decisions made through democratic participation',
    effectiveness: 68,
    pros: ['High legitimacy', 'Public participation', 'Peaceful transitions'],
    cons: ['Slower decisions', 'Potential gridlock', 'Populist pressure']
  },
  [ComponentType.AUTOCRATIC_PROCESS]: {
    name: 'Autocratic Process',
    description: 'Decisions made by single authority or small group',
    effectiveness: 75,
    pros: ['Fast decisions', 'Clear direction', 'Crisis response'],
    cons: ['Low legitimacy', 'Potential abuse', 'Succession issues']
  },
  [ComponentType.TECHNOCRATIC_PROCESS]: {
    name: 'Technocratic Process',
    description: 'Decisions made by technical experts',
    effectiveness: 85,
    pros: ['Evidence-based policy', 'High competence', 'Economic efficiency'],
    cons: ['Democratic deficit', 'Elitist perception', 'Limited flexibility']
  },
  [ComponentType.CONSENSUS_PROCESS]: {
    name: 'Consensus Process',
    description: 'Decisions made through broad agreement',
    effectiveness: 60,
    pros: ['High buy-in', 'Stable policies', 'Inclusive governance'],
    cons: ['Very slow decisions', 'Status quo bias', 'Lowest common denominator']
  },
  [ComponentType.OLIGARCHIC_PROCESS]: {
    name: 'Oligarchic Process',
    description: 'Decisions made by elite group',
    effectiveness: 70,
    pros: ['Coordinated leadership', 'Expertise concentration', 'Stable governance'],
    cons: ['Limited legitimacy', 'Potential corruption', 'Elite capture']
  },
  [ComponentType.ELECTORAL_LEGITIMACY]: {
    name: 'Electoral Legitimacy',
    description: 'Authority derived from elections',
    effectiveness: 65,
    pros: ['Democratic mandate', 'Regular renewal', 'Public accountability'],
    cons: ['Campaign pressures', 'Short-term thinking', 'Electoral manipulation']
  },
  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    name: 'Traditional Legitimacy',
    description: 'Authority based on historical precedent',
    effectiveness: 70,
    pros: ['Cultural stability', 'Predictable succession', 'Deep roots'],
    cons: ['Resistance to change', 'Potential outdated practices', 'Hereditary issues']
  },
  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    name: 'Performance Legitimacy',
    description: 'Authority based on delivering results',
    effectiveness: 80,
    pros: ['Incentivizes competence', 'Results-oriented', 'Pragmatic governance'],
    cons: ['Pressure for short-term wins', 'Economic dependency', 'Crisis vulnerability']
  },
  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    name: 'Charismatic Legitimacy',
    description: 'Authority based on leader\'s personal appeal',
    effectiveness: 75,
    pros: ['Strong leadership', 'Crisis mobilization', 'National unity'],
    cons: ['Personality dependency', 'Succession crisis', 'Potential authoritarianism']
  },
  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    name: 'Religious Legitimacy',
    description: 'Authority derived from religious doctrine',
    effectiveness: 72,
    pros: ['Deep cultural roots', 'Moral authority', 'Social cohesion'],
    cons: ['Religious minorities excluded', 'Theocratic tendency', 'Resistance to change']
  },
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    name: 'Professional Bureaucracy',
    description: 'Merit-based civil service system',
    effectiveness: 85,
    pros: ['High competence', 'Institutional memory', 'Policy continuity'],
    cons: ['Potential rigidity', 'Democratic accountability issues', 'Elite bias']
  },
  [ComponentType.MILITARY_ADMINISTRATION]: {
    name: 'Military Administration',
    description: 'Military officers in key administrative roles',
    effectiveness: 78,
    pros: ['Discipline and order', 'Crisis management', 'Clear hierarchy'],
    cons: ['Democratic deficit', 'Civilian control issues', 'Militaristic culture']
  },
  [ComponentType.INDEPENDENT_JUDICIARY]: {
    name: 'Independent Judiciary',
    description: 'Courts independent from executive control',
    effectiveness: 80,
    pros: ['Rule of law', 'Check on power', 'Legal predictability'],
    cons: ['Potential judicial activism', 'Slow justice', 'Elite profession']
  },
  [ComponentType.PARTISAN_INSTITUTIONS]: {
    name: 'Partisan Institutions',
    description: 'Key positions filled by party loyalists',
    effectiveness: 65,
    pros: ['Policy coordination', 'Democratic accountability', 'Clear mandate'],
    cons: ['Competence questions', 'Corruption potential', 'Policy discontinuity']
  },
  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    name: 'Technocratic Agencies',
    description: 'Specialized agencies led by technical experts',
    effectiveness: 82,
    pros: ['Technical expertise', 'Evidence-based policy', 'Innovation'],
    cons: ['Democratic accountability', 'Complexity', 'Coordination challenges']
  },
  [ComponentType.RULE_OF_LAW]: {
    name: 'Rule of Law',
    description: 'All actors subject to publicly disclosed legal codes',
    effectiveness: 85,
    pros: ['Legal predictability', 'Equal treatment', 'Investment security'],
    cons: ['Rigid procedures', 'Legal complexity', 'Potential for legal gridlock']
  },
  [ComponentType.SURVEILLANCE_SYSTEM]: {
    name: 'Surveillance System',
    description: 'Government monitoring of citizens and organizations',
    effectiveness: 78,
    pros: ['Crime prevention', 'Tax compliance', 'Security'],
    cons: ['Privacy concerns', 'Potential abuse', 'Chilling effect on dissent']
  },
  [ComponentType.ECONOMIC_INCENTIVES]: {
    name: 'Economic Incentives',
    description: 'Using economic rewards and penalties for compliance',
    effectiveness: 73,
    pros: ['Market-friendly', 'Voluntary compliance', 'Flexible approach'],
    cons: ['Inequality effects', 'Market distortions', 'Limited to economic actors']
  },
  [ComponentType.SOCIAL_PRESSURE]: {
    name: 'Social Pressure',
    description: 'Using social norms and peer pressure for compliance',
    effectiveness: 68,
    pros: ['Low cost', 'Cultural integration', 'Community enforcement'],
    cons: ['Cultural dependency', 'Potential discrimination', 'Limited effectiveness']
  },
  [ComponentType.MILITARY_ENFORCEMENT]: {
    name: 'Military Enforcement',
    description: 'Using military force to ensure compliance',
    effectiveness: 80,
    pros: ['Ultimate deterrent', 'Crisis response', 'Clear authority'],
    cons: ['Democratic risks', 'Legitimacy costs', 'Potential for abuse']
  }
};

interface AtomicComponentSelectorProps {
  selectedComponents: ComponentType[];
  onComponentChange: (components: ComponentType[]) => void;
  className?: string;
}

export function AtomicComponentSelector({
  selectedComponents,
  onComponentChange,
  className
}: AtomicComponentSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('POWER_DISTRIBUTION');
  const [showInfo, setShowInfo] = useState<ComponentType | null>(null);

  // Calculate overall effectiveness
  const overallEffectiveness = useMemo(() => {
    if (selectedComponents.length === 0) return 0;
    
    const totalEffectiveness = selectedComponents.reduce((sum, component) => {
      return sum + (ATOMIC_COMPONENT_INFO[component]?.effectiveness || 0);
    }, 0);
    
    return Math.round(totalEffectiveness / selectedComponents.length);
  }, [selectedComponents]);

  const handleComponentToggle = (component: ComponentType) => {
    if (selectedComponents.includes(component)) {
      onComponentChange(selectedComponents.filter(c => c !== component));
    } else {
      onComponentChange([...selectedComponents, component]);
    }
  };

  const activeCategoryData = Object.values(ATOMIC_COMPONENT_CATEGORIES).find(
    cat => cat.id === activeCategory
  );

  return (
    <div className={cn("atomic-component-selector space-y-6", className)}>
      {/* Header with effectiveness display */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Atomic Government Components
          </h2>
          <p className="text-muted-foreground mt-1">
            Select components that define your government structure
          </p>
        </div>
        
        {selectedComponents.length > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              {overallEffectiveness}%
            </div>
            <div className="text-sm text-muted-foreground">
              Overall Effectiveness
            </div>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex space-x-2 border-b">
        {Object.values(ATOMIC_COMPONENT_CATEGORIES).map((category) => {
          const Icon = category.icon;
          const selectedCount = selectedComponents.filter(comp =>
            category.components.includes(comp)
          ).length;
          
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-colors",
                "border-b-2",
                activeCategory === category.id
                  ? "bg-primary/10 border-primary text-primary"
                  : "hover:bg-muted border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{category.name}</span>
              {selectedCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category description */}
      {activeCategoryData && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <h3 className="font-semibold text-foreground">{activeCategoryData.name}</h3>
          <p className="text-muted-foreground mt-1">{activeCategoryData.description}</p>
        </div>
      )}

      {/* Component cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeCategoryData?.components.map((component) => {
          const info = ATOMIC_COMPONENT_INFO[component];
          const isSelected = selectedComponents.includes(component);
          
          return (
            <motion.div
              key={component}
              layout
              className={cn(
                "p-4 border rounded-lg cursor-pointer transition-all",
                "hover:shadow-md",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => handleComponentToggle(component)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-foreground">{info.name}</h4>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {info.description}
                  </p>
                  
                  {/* Effectiveness bar */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs text-muted-foreground">Effectiveness:</span>
                    <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all"
                        style={{ width: `${info.effectiveness}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {info.effectiveness}%
                    </span>
                  </div>
                </div>
                
                <button
                  className="ml-2 p-1 hover:bg-muted rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(showInfo === component ? null : component);
                  }}
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Expanded info */}
              <AnimatePresence>
                {showInfo === component && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 pt-3 border-t space-y-2"
                  >
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-1">
                        Advantages:
                      </div>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                        {info.pros.map((pro, idx) => (
                          <li key={idx}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1">
                        Disadvantages:
                      </div>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                        {info.cons.map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Selected components summary */}
      {selectedComponents.length > 0 && (
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">
              Selected Components ({selectedComponents.length})
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {selectedComponents.map((component) => {
              const info = ATOMIC_COMPONENT_INFO[component];
              return (
                <span
                  key={component}
                  className="inline-flex items-center px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                >
                  {info.name}
                </span>
              );
            })}
          </div>
          
          <div className="mt-3 text-sm text-muted-foreground">
            This combination will create a government with {overallEffectiveness}% effectiveness.
            {overallEffectiveness >= 80 && " This is a highly effective configuration!"}
            {overallEffectiveness >= 60 && overallEffectiveness < 80 && " This is a moderately effective configuration."}
            {overallEffectiveness < 60 && " Consider adding more effective components."}
          </div>
        </div>
      )}
    </div>
  );
}