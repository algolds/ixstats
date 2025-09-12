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

  // Query atomic components from database
  const { data: governmentData, isLoading: isLoadingGovernment } = api.government.getByCountryId.useQuery(
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
    if (!isLoadingGovernment && !isLoadingCountry && countryData) {
      try {
        // Extract components from government data
        const components: ComponentType[] = [];
        
        // If government data exists, extract atomic components
        if ((governmentData as any)?.atomicComponents) {
          (governmentData as any).atomicComponents.forEach((comp: any) => {
            if (comp.componentType && comp.isActive) {
              components.push(comp.componentType);
            }
          });
        }

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
        if (components.length > 0) {
          manager.setSelectedComponents(components);
        }

        setError(null);
      } catch (err) {
        console.error('Error initializing atomic state:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize atomic state');
      } finally {
        setIsLoading(false);
      }
    }
  }, [governmentData, countryData, isLoadingGovernment, isLoadingCountry, manager, countryId]);

  // Mutation to save atomic components
  const saveComponentsMutation = (api.government as any).updateAtomicComponents.useMutation({
    onSuccess: () => {
      console.log('Atomic components saved successfully');
    },
    onError: (error: unknown) => {
      console.error('Failed to save atomic components:', error);
      setError('Failed to save atomic components');
    }
  });

  // State management methods
  const setSelectedComponents = (components: ComponentType[]) => {
    manager.setSelectedComponents(components);
    
    // Save to database if user owns the country
    if (userId && governmentData && saveComponentsMutation) {
      saveComponentsMutation.mutate({
        countryId,
        components: components.map(componentType => ({
          componentType,
          isActive: true,
          effectivenessScore: manager.getComponentContribution(componentType).effectiveness,
          implementationDate: new Date()
        }))
      });
    }
  };

  const addComponent = (component: ComponentType) => {
    manager.addComponent(component);
    
    // Save to database
    if (userId && governmentData) {
      const updatedComponents = [...state.selectedComponents, component];
      setSelectedComponents(updatedComponents);
    }
  };

  const removeComponent = (component: ComponentType) => {
    manager.removeComponent(component);
    
    // Save to database
    if (userId && governmentData) {
      const updatedComponents = state.selectedComponents.filter(c => c !== component);
      setSelectedComponents(updatedComponents);
    }
  };

  const refreshCalculations = () => {
    manager.refreshAllCalculations();
  };

  const getComponentContribution = (component: ComponentType) => {
    return manager.getComponentContribution(component);
  };

  const getSystemHealth = () => {
    return manager.getSystemHealth();
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