/**
 * AtomicBuilderStateManager - Centralized state management for atomic component selection
 * Phase 2: Atomic Components Native Builder Experience
 */

import { ComponentType } from '@prisma/client';

export interface AtomicBuilderState {
  selectedComponents: ComponentType[];
  effectivenessScore: number;
  synergies: SynergyRule[];
  conflicts: ConflictRule[];
  economicImpact: AtomicEconomicModifiers;
  traditionalStructure: GeneratedStructure;
  builderMode: BuilderMode;
}

export interface SynergyRule {
  id: string;
  components: ComponentType[];
  type: 'effectiveness_boost' | 'cost_reduction' | 'special_ability';
  modifier: number;
  description: string;
}

export interface ConflictRule {
  id: string;
  components: ComponentType[];
  penalty: number;
  description: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface AtomicEconomicModifiers {
  gdpImpact: {
    current: number;
    projected1Year: number;
    projected3Years: number;
    confidence: number;
  };
  taxEfficiency: {
    currentMultiplier: number;
    projectedRevenue: number;
    complianceRate: number;
  };
  stabilityIndex: {
    current: number;
    trend: 'improving' | 'stable' | 'declining';
    factors: StabilityFactor[];
  };
  internationalStanding: {
    tradeBonus: number;
    investmentAttractiveness: number;
    diplomaticWeight: number;
  };
}

export interface StabilityFactor {
  factor: string;
  impact: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface GeneratedStructure {
  governmentType: string;
  departments: string[];
  executiveStructure: string[];
  legislativeStructure: string[];
  judicialStructure: string[];
  budgetAllocations: Record<string, number>;
}

export type BuilderMode = 'atomic' | 'traditional' | 'hybrid';

// Synergy definitions based on component combinations
export const SYNERGY_RULES: SynergyRule[] = [
  {
    id: 'tech_professional',
    components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    type: 'effectiveness_boost',
    modifier: 1.25,
    description: 'Technocratic decisions combined with professional implementation create superior policy outcomes'
  },
  {
    id: 'rule_judiciary',
    components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
    type: 'effectiveness_boost',
    modifier: 1.20,
    description: 'Strong legal framework with independent courts maximizes institutional credibility'
  },
  {
    id: 'democratic_electoral',
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    type: 'effectiveness_boost',
    modifier: 1.15,
    description: 'Democratic processes backed by electoral mandate enhance legitimacy'
  },
  {
    id: 'federal_democratic',
    components: [ComponentType.FEDERAL_SYSTEM, ComponentType.DEMOCRATIC_PROCESS],
    type: 'effectiveness_boost',
    modifier: 1.18,
    description: 'Federal structure enables better democratic representation and local autonomy'
  },
  {
    id: 'performance_tech',
    components: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.TECHNOCRATIC_AGENCIES],
    type: 'effectiveness_boost',
    modifier: 1.22,
    description: 'Performance-based legitimacy with technical expertise delivers exceptional results'
  }
];

// Conflict definitions - components that work poorly together
export const CONFLICT_RULES: ConflictRule[] = [
  {
    id: 'surveillance_democratic',
    components: [ComponentType.SURVEILLANCE_SYSTEM, ComponentType.DEMOCRATIC_PROCESS],
    penalty: 0.15,
    description: 'Extensive surveillance undermines democratic participation and civil liberties',
    severity: 'major'
  },
  {
    id: 'autocratic_electoral',
    components: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    penalty: 0.20,
    description: 'Autocratic decision-making contradicts electoral mandate principles',
    severity: 'critical'
  },
  {
    id: 'military_civilian',
    components: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.INDEPENDENT_JUDICIARY],
    penalty: 0.12,
    description: 'Military control of administration can undermine judicial independence',
    severity: 'major'
  },
  {
    id: 'centralized_federal',
    components: [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM],
    penalty: 0.10,
    description: 'Centralized power structure conflicts with federal power-sharing principles',
    severity: 'minor'
  }
];

export class AtomicBuilderStateManager {
  private state: AtomicBuilderState;
  private listeners: ((state: AtomicBuilderState) => void)[] = [];

  constructor(initialState?: Partial<AtomicBuilderState>) {
    this.state = {
      selectedComponents: [],
      effectivenessScore: 0,
      synergies: [],
      conflicts: [],
      economicImpact: this.getDefaultEconomicImpact(),
      traditionalStructure: this.getDefaultStructure(),
      builderMode: 'atomic',
      ...initialState
    };
  }

  // Subscribe to state changes
  subscribe(listener: (state: AtomicBuilderState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get current state
  getState(): AtomicBuilderState {
    return { ...this.state };
  }

  // Update selected components and recalculate all derived values
  setSelectedComponents(components: ComponentType[]) {
    this.state.selectedComponents = components;
    this.recalculateState();
    this.notifyListeners();
  }

  // Add a component
  addComponent(component: ComponentType) {
    if (!this.state.selectedComponents.includes(component)) {
      this.setSelectedComponents([...this.state.selectedComponents, component]);
    }
  }

  // Remove a component
  removeComponent(component: ComponentType) {
    this.setSelectedComponents(
      this.state.selectedComponents.filter(c => c !== component)
    );
  }

  // Set builder mode
  setBuilderMode(mode: BuilderMode) {
    this.state.builderMode = mode;
    this.notifyListeners();
  }

  // Recalculate all derived state values
  private recalculateState() {
    this.state.effectivenessScore = this.calculateEffectiveness();
    this.state.synergies = this.detectSynergies();
    this.state.conflicts = this.detectConflicts();
    this.state.economicImpact = this.calculateEconomicImpact();
    this.state.traditionalStructure = this.generateTraditionalStructure();
  }

  // Calculate overall effectiveness score
  private calculateEffectiveness(): number {
    const { selectedComponents } = this.state;
    
    if (selectedComponents.length === 0) return 0;

    // Base effectiveness (average of component effectiveness)
    const componentInfo = this.getComponentInfo();
    let baseEffectiveness = selectedComponents.reduce((sum, comp) => {
      return sum + (componentInfo[comp]?.effectiveness || 50);
    }, 0) / selectedComponents.length;

    // Apply synergy bonuses
    const synergies = this.detectSynergies();
    let synergyBonus = synergies.reduce((sum, synergy) => {
      return sum + (synergy.modifier - 1) * 100;
    }, 0);

    // Apply conflict penalties
    const conflicts = this.detectConflicts();
    let conflictPenalty = conflicts.reduce((sum, conflict) => {
      return sum + conflict.penalty * 100;
    }, 0);

    // Calculate final score (0-100 scale)
    let finalScore = baseEffectiveness + synergyBonus - conflictPenalty;
    return Math.max(0, Math.min(100, finalScore));
  }

  // Detect active synergies
  private detectSynergies(): SynergyRule[] {
    const { selectedComponents } = this.state;
    
    return SYNERGY_RULES.filter(synergy => {
      return synergy.components.every(comp => selectedComponents.includes(comp));
    });
  }

  // Detect active conflicts
  private detectConflicts(): ConflictRule[] {
    const { selectedComponents } = this.state;
    
    return CONFLICT_RULES.filter(conflict => {
      return conflict.components.every(comp => selectedComponents.includes(comp));
    });
  }

  // Calculate economic impact based on selected components
  private calculateEconomicImpact(): AtomicEconomicModifiers {
    const { selectedComponents, effectivenessScore } = this.state;
    
    // Base multiplier from effectiveness
    const effectivenessMultiplier = effectivenessScore / 100;
    
    // Calculate GDP impact
    let gdpImpactBase = 1.0 + (effectivenessMultiplier * 0.3); // Up to 30% GDP boost
    
    // Tax efficiency calculation
    let taxEfficiencyBase = 1.0 + (effectivenessMultiplier * 0.4); // Up to 40% tax efficiency
    
    // Stability calculation
    let stabilityBase = effectivenessScore;
    
    // Component-specific bonuses
    if (selectedComponents.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      gdpImpactBase += 0.1;
      taxEfficiencyBase += 0.15;
    }
    
    if (selectedComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      taxEfficiencyBase += 0.2;
      stabilityBase += 10;
    }
    
    if (selectedComponents.includes(ComponentType.RULE_OF_LAW)) {
      stabilityBase += 15;
      gdpImpactBase += 0.05;
    }

    return {
      gdpImpact: {
        current: gdpImpactBase,
        projected1Year: gdpImpactBase * 1.1,
        projected3Years: gdpImpactBase * 1.3,
        confidence: Math.min(95, effectivenessScore + 10)
      },
      taxEfficiency: {
        currentMultiplier: taxEfficiencyBase,
        projectedRevenue: taxEfficiencyBase * 100000, // Base revenue
        complianceRate: Math.min(95, effectivenessScore + 5)
      },
      stabilityIndex: {
        current: stabilityBase,
        trend: stabilityBase > 75 ? 'improving' : stabilityBase > 50 ? 'stable' : 'declining',
        factors: this.calculateStabilityFactors()
      },
      internationalStanding: {
        tradeBonus: effectivenessMultiplier * 0.2,
        investmentAttractiveness: effectivenessMultiplier * 0.25,
        diplomaticWeight: effectivenessMultiplier * 0.15
      }
    };
  }

  // Calculate stability factors
  private calculateStabilityFactors(): StabilityFactor[] {
    const { selectedComponents } = this.state;
    const factors: StabilityFactor[] = [];

    if (selectedComponents.includes(ComponentType.RULE_OF_LAW)) {
      factors.push({
        factor: 'Legal Framework',
        impact: 15,
        trend: 'improving'
      });
    }

    if (selectedComponents.includes(ComponentType.DEMOCRATIC_PROCESS)) {
      factors.push({
        factor: 'Democratic Legitimacy',
        impact: 12,
        trend: 'stable'
      });
    }

    if (selectedComponents.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
      factors.push({
        factor: 'Social Control',
        impact: 8,
        trend: 'stable'
      });
    }

    return factors;
  }

  // Generate traditional government structure from atomic components
  private generateTraditionalStructure(): GeneratedStructure {
    const { selectedComponents } = this.state;
    
    const structure: GeneratedStructure = {
      governmentType: this.inferGovernmentType(selectedComponents),
      departments: this.generateDepartments(selectedComponents),
      executiveStructure: this.generateExecutive(selectedComponents),
      legislativeStructure: this.generateLegislative(selectedComponents),
      judicialStructure: this.generateJudicial(selectedComponents),
      budgetAllocations: this.generateBudgetBreakdown(selectedComponents)
    };

    return structure;
  }

  private inferGovernmentType(components: ComponentType[]): string {
    if (components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
      if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
        return 'Federal Democracy';
      }
      return 'Parliamentary Democracy';
    }
    
    if (components.includes(ComponentType.AUTOCRATIC_PROCESS)) {
      return 'Autocratic Republic';
    }
    
    if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      return 'Technocratic State';
    }
    
    return 'Mixed Government';
  }

  private generateDepartments(components: ComponentType[]): string[] {
    const departments: string[] = ['Ministry of Interior', 'Ministry of Finance'];
    
    if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      departments.push('Civil Service Commission', 'Administrative Excellence Department');
    }
    
    if (components.includes(ComponentType.TECHNOCRATIC_AGENCIES)) {
      departments.push('Strategic Planning Agency', 'Policy Analysis Bureau');
    }
    
    if (components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
      departments.push('Judicial Services Commission');
    }
    
    return departments;
  }

  private generateExecutive(components: ComponentType[]): string[] {
    const structure = ['Prime Minister', 'Cabinet'];
    
    if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      structure.push('Technical Advisory Council');
    }
    
    return structure;
  }

  private generateLegislative(components: ComponentType[]): string[] {
    const structure = ['National Assembly'];
    
    if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
      structure.push('Senate', 'Regional Assemblies');
    }
    
    return structure;
  }

  private generateJudicial(components: ComponentType[]): string[] {
    const structure = ['Supreme Court'];
    
    if (components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
      structure.push('Constitutional Court', 'Administrative Courts');
    }
    
    return structure;
  }

  private generateBudgetBreakdown(components: ComponentType[]): Record<string, number> {
    const budget: Record<string, number> = {
      administration: 20,
      defense: 15,
      education: 20,
      healthcare: 20,
      infrastructure: 15,
      other: 10
    };
    
    if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      budget.administration += 5;
      budget.other -= 5;
    }
    
    if (components.includes(ComponentType.MILITARY_ADMINISTRATION)) {
      budget.defense += 10;
      budget.education -= 5;
      budget.other -= 5;
    }
    
    return budget;
  }

  private getComponentInfo() {
    // This would typically import from the component info file
    // For now, return basic effectiveness values
    const info: Record<ComponentType, { effectiveness: number }> = {
      [ComponentType.CENTRALIZED_POWER]: { effectiveness: 75 },
      [ComponentType.FEDERAL_SYSTEM]: { effectiveness: 70 },
      [ComponentType.CONFEDERATE_SYSTEM]: { effectiveness: 60 },
      [ComponentType.UNITARY_SYSTEM]: { effectiveness: 72 },
      [ComponentType.DEMOCRATIC_PROCESS]: { effectiveness: 68 },
      [ComponentType.AUTOCRATIC_PROCESS]: { effectiveness: 75 },
      [ComponentType.TECHNOCRATIC_PROCESS]: { effectiveness: 85 },
      [ComponentType.CONSENSUS_PROCESS]: { effectiveness: 60 },
      [ComponentType.OLIGARCHIC_PROCESS]: { effectiveness: 70 },
      [ComponentType.ELECTORAL_LEGITIMACY]: { effectiveness: 65 },
      [ComponentType.TRADITIONAL_LEGITIMACY]: { effectiveness: 70 },
      [ComponentType.PERFORMANCE_LEGITIMACY]: { effectiveness: 80 },
      [ComponentType.CHARISMATIC_LEGITIMACY]: { effectiveness: 75 },
      [ComponentType.RELIGIOUS_LEGITIMACY]: { effectiveness: 72 },
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: { effectiveness: 85 },
      [ComponentType.MILITARY_ADMINISTRATION]: { effectiveness: 78 },
      [ComponentType.INDEPENDENT_JUDICIARY]: { effectiveness: 80 },
      [ComponentType.PARTISAN_INSTITUTIONS]: { effectiveness: 65 },
      [ComponentType.TECHNOCRATIC_AGENCIES]: { effectiveness: 82 },
      [ComponentType.RULE_OF_LAW]: { effectiveness: 85 },
      [ComponentType.SURVEILLANCE_SYSTEM]: { effectiveness: 78 },
      [ComponentType.ECONOMIC_INCENTIVES]: { effectiveness: 73 },
      [ComponentType.SOCIAL_PRESSURE]: { effectiveness: 68 },
      [ComponentType.MILITARY_ENFORCEMENT]: { effectiveness: 80 }
    };
    
    return info;
  }

  private getDefaultEconomicImpact(): AtomicEconomicModifiers {
    return {
      gdpImpact: {
        current: 1.0,
        projected1Year: 1.0,
        projected3Years: 1.0,
        confidence: 50
      },
      taxEfficiency: {
        currentMultiplier: 1.0,
        projectedRevenue: 100000,
        complianceRate: 70
      },
      stabilityIndex: {
        current: 50,
        trend: 'stable',
        factors: []
      },
      internationalStanding: {
        tradeBonus: 0,
        investmentAttractiveness: 0,
        diplomaticWeight: 0
      }
    };
  }

  private getDefaultStructure(): GeneratedStructure {
    return {
      governmentType: 'Basic Government',
      departments: [],
      executiveStructure: [],
      legislativeStructure: [],
      judicialStructure: [],
      budgetAllocations: {}
    };
  }
}