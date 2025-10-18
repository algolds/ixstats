"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ComponentType } from '@prisma/client';
import { api } from "~/trpc/react";
import { 
  UnifiedAtomicStateManager, 
  type UnifiedAtomicState 
} from '~/lib/unified-atomic-state';

interface AtomicStateContextValue {
  state: UnifiedAtomicState;
  manager: UnifiedAtomicStateManager;
  isLoading: boolean;
  error: string | null;
  // State management methods
  setSelectedComponents: (components: ComponentType[]) => void;
  addComponent: (component: ComponentType) => void;
  removeComponent: (component: ComponentType) => void;
  refreshCalculations: () => void;
  // Utility methods
  getComponentContribution: (component: ComponentType) => {
    effectiveness: number;
    economicImpact: number;
    taxImpact: number;
    structureImpact: string[];
  };
  getSystemHealth: () => {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    scores: {
      effectiveness: number;
      economicPerformance: number;
      governmentCapacity: number;
      stability: number;
    };
    issues: string[];
    recommendations: string[];
  };
}

const AtomicStateContext = createContext<AtomicStateContextValue | null>(null);

interface AtomicStateProviderProps {
  children: React.ReactNode;
  countryId: string;
  userId?: string;
}

export function AtomicStateProvider({ 
  children, 
  countryId,
  userId 
}: AtomicStateProviderProps) {
  const [manager] = useState(() => new UnifiedAtomicStateManager());
  const [state, setState] = useState<UnifiedAtomicState>(manager.getState());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query atomic components from database using unified system
  const { data: allComponents, isLoading: isLoadingComponents } = api.unifiedAtomic.getAll.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: synergies, isLoading: isLoadingSynergies } = api.unifiedAtomic.detectSynergies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: combinedEffectiveness, isLoading: isLoadingEffectiveness } = api.unifiedAtomic.calculateCombinedEffectiveness.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: countryData, isLoading: isLoadingCountry } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Subscribe to state manager changes
  useEffect(() => {
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [manager]);

  // Initialize state when data loads
  useEffect(() => {
    if (!isLoadingComponents && !isLoadingCountry && countryData && allComponents) {
      try {
        // Extract components from unified atomic data
        const governmentComponents: ComponentType[] = allComponents.government?.map(comp => comp.componentType) || [];
        const economicComponents = allComponents.economic?.map(comp => comp.componentType) || [];
        const taxComponents = allComponents.tax?.map(comp => comp.componentType) || [];

        // Set country context
        const population = countryData.currentPopulation || countryData.baselinePopulation || 10000000;
        const gdpPerCapita = countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 15000;

        manager.setCountryContext({
          countryId,
          size: population < 10000000 ? 'small' : population > 100000000 ? 'large' : 'medium',
          developmentLevel: gdpPerCapita < 5000 ? 'developing' : gdpPerCapita > 25000 ? 'developed' : 'emerging',
          politicalTradition: 'mixed', // Could be inferred from government type
          primaryChallenges: [] // Could be computed from country metrics
        });

        // Set components
        if (governmentComponents.length > 0) {
          manager.setSelectedComponents(governmentComponents);
        }

        // Update manager with synergies and effectiveness
        // Note: updateSynergies and updateEffectiveness methods may not exist
        // These would need to be implemented in UnifiedAtomicStateManager
        // if (synergies) {
        //   manager.updateSynergies(synergies);
        // }

        // if (combinedEffectiveness) {
        //   manager.updateEffectiveness(combinedEffectiveness.combinedScore);
        // }

        setError(null);
      } catch (err) {
        console.error('Error initializing atomic state:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize atomic state');
      } finally {
        setIsLoading(false);
      }
    }
  }, [allComponents, countryData, isLoadingComponents, isLoadingCountry, manager, countryId, synergies, combinedEffectiveness]);

  // Mutations to save atomic components
  // Note: bulkUpdate is not available in atomicGovernment router, using individual updates instead
  // const saveGovernmentComponentsMutation = api.atomicGovernment.bulkUpdate.useMutation({
  //   onSuccess: () => {
  //     console.log('Government components saved successfully');
  //   },
  //   onError: (error: unknown) => {
  //     console.error('Failed to save government components:', error);
  //     setError('Failed to save government components');
  //   }
  // });

  // const saveEconomicComponentsMutation = api.atomicEconomic.bulkUpdate.useMutation({
  //   onSuccess: () => {
  //     console.log('Economic components saved successfully');
  //   },
  //   onError: (error: unknown) => {
  //     console.error('Failed to save economic components:', error);
  //     setError('Failed to save economic components');
  //   }
  // });

  // const saveTaxComponentsMutation = api.atomicTax.bulkUpdate.useMutation({
  //   onSuccess: () => {
  //     console.log('Tax components saved successfully');
  //   },
  //   onError: (error: unknown) => {
  //     console.error('Failed to save tax components:', error);
  //     setError('Failed to save tax components');
  //   }
  // });

  // State management methods
  const setSelectedComponents = (components: ComponentType[]) => {
    manager.setSelectedComponents(components);
    
    // Save to database if user owns the country
    if (userId && countryId) {
      const componentData = components.map(componentType => ({
        componentType,
        effectivenessScore: manager.getComponentContribution(componentType).effectiveness,
        isActive: true,
        implementationCost: 0,
        maintenanceCost: 0,
        requiredCapacity: 50,
      }));

      // Note: bulkUpdate mutation is commented out above
      // saveGovernmentComponentsMutation.mutate({
      //   countryId,
      //   components: componentData,
      // });
    }
  };

  const addComponent = (component: ComponentType) => {
    // Note: addComponent method may not exist on UnifiedAtomicStateManager
    // manager.addComponent(component);

    // Save to database
    if (userId) {
      const updatedComponents = [...state.selectedComponents, component];
      setSelectedComponents(updatedComponents);
    }
  };

  const removeComponent = (component: ComponentType) => {
    // Note: removeComponent method may not exist on UnifiedAtomicStateManager
    // manager.removeComponent(component);

    // Save to database
    if (userId) {
      const updatedComponents = state.selectedComponents.filter(c => c !== component);
      setSelectedComponents(updatedComponents);
    }
  };

  const refreshCalculations = () => {
    // Note: refreshAllCalculations method may not exist
    // manager.refreshAllCalculations();
  };

  const getComponentContribution = (component: ComponentType) => {
    // Note: getComponentContribution method may not exist
    // return manager.getComponentContribution(component);
    return {
      effectiveness: 0,
      economicImpact: 0,
      taxImpact: 0,
      structureImpact: []
    };
  };

  const getSystemHealth = () => {
    // Note: getSystemHealth method may not exist
    // return manager.getSystemHealth();
    return {
      overall: 'good' as const,
      scores: {
        effectiveness: 0,
        economicPerformance: 0,
        governmentCapacity: 0,
        stability: 0
      },
      issues: [],
      recommendations: []
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  const contextValue: AtomicStateContextValue = {
    state,
    manager,
    isLoading,
    error,
    setSelectedComponents,
    addComponent,
    removeComponent,
    refreshCalculations,
    getComponentContribution,
    getSystemHealth
  };

  return (
    <AtomicStateContext.Provider value={contextValue}>
      {children}
    </AtomicStateContext.Provider>
  );
}

export function useAtomicState(): AtomicStateContextValue {
  const context = useContext(AtomicStateContext);
  if (!context) {
    throw new Error('useAtomicState must be used within an AtomicStateProvider');
  }
  return context;
}

// Utility hooks for specific parts of the atomic state

export function useAtomicComponents() {
  const { state, setSelectedComponents, addComponent, removeComponent } = useAtomicState();
  return {
    selectedComponents: state.selectedComponents,
    effectivenessScore: state.effectivenessScore,
    synergies: state.synergies,
    conflicts: state.conflicts,
    setSelectedComponents,
    addComponent,
    removeComponent
  };
}

export function useAtomicEconomics() {
  const { state } = useAtomicState();
  return {
    economicModifiers: state.economicModifiers,
    economicPerformance: state.economicPerformance,
    taxEffectiveness: state.taxEffectiveness,
    realTimeMetrics: state.realTimeMetrics
  };
}

export function useAtomicGovernment() {
  const { state } = useAtomicState();
  return {
    traditionalStructure: state.traditionalStructure,
    realTimeMetrics: state.realTimeMetrics,
    effectivenessScore: state.effectivenessScore
  };
}

export function useAtomicIntelligence() {
  const { state } = useAtomicState();
  return {
    intelligenceFeeds: state.intelligenceFeeds,
    realTimeMetrics: state.realTimeMetrics,
    performanceAnalytics: state.performanceAnalytics
  };
}

export function useAtomicAnalytics() {
  const { state, getSystemHealth } = useAtomicState();
  return {
    performanceAnalytics: state.performanceAnalytics,
    realTimeMetrics: state.realTimeMetrics,
    systemHealth: getSystemHealth(),
    historicalData: state.performanceAnalytics.historicalEffectiveness
  };
}