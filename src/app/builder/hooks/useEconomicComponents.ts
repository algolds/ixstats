/**
 * Economic Components State Management Hook.
 *
 * Manages economic atomic component selections and database persistence:
 * - Component selection and validation
 * - Database CRUD operations via tRPC
 * - Real-time effectiveness calculations
 * - Cross-builder synergy detection
 */

import { useState, useEffect, useMemo } from 'react';
import { EconomicComponentType } from '@prisma/client';
import { api } from '~/trpc/react';

export interface UseEconomicComponentsProps {
  countryId?: string;
  initialComponents?: EconomicComponentType[];
}

export function useEconomicComponents({
  countryId,
  initialComponents = []
}: UseEconomicComponentsProps) {
  // State
  const [selectedComponents, setSelectedComponents] = useState<EconomicComponentType[]>(initialComponents);
  const [isLoading, setIsLoading] = useState(false);

  // tRPC queries and mutations
  const getComponentsQuery = api.atomicEconomic.getComponents.useQuery(
    { countryId: countryId || '' },
    { enabled: !!countryId }
  );

  const getEffectivenessQuery = api.atomicEconomic.getEffectiveness.useQuery(
    { countryId: countryId || '' },
    { enabled: !!countryId }
  );

  const bulkUpdateMutation = api.atomicEconomic.bulkUpdate.useMutation();
  const createComponentMutation = api.atomicEconomic.createComponent.useMutation();
  const updateComponentMutation = api.atomicEconomic.updateComponent.useMutation();
  const removeComponentMutation = api.atomicEconomic.removeComponent.useMutation();

  // Load components from database on mount
  useEffect(() => {
    if (getComponentsQuery.data && getComponentsQuery.data.length > 0) {
      const activeComponents = getComponentsQuery.data
        .filter(comp => comp.isActive)
        .map(comp => comp.componentType);
      setSelectedComponents(activeComponents);
    }
  }, [getComponentsQuery.data]);

  // Save components to database
  const saveComponents = async (components: EconomicComponentType[]) => {
    if (!countryId) return;

    setIsLoading(true);
    try {
      const componentData = components.map(componentType => ({
        componentType,
        effectivenessScore: 50, // Default effectiveness
        isActive: true,
        implementationCost: 0,
        maintenanceCost: 0,
        requiredCapacity: 50,
      }));

      await bulkUpdateMutation.mutateAsync({
        countryId,
        components: componentData,
      });

      setSelectedComponents(components);
    } catch (error) {
      console.error('Failed to save economic components:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a single component
  const addComponent = async (componentType: EconomicComponentType) => {
    if (!countryId) return;

    setIsLoading(true);
    try {
      await createComponentMutation.mutateAsync({
        countryId,
        componentType,
        effectivenessScore: 50,
        implementationCost: 0,
        maintenanceCost: 0,
        requiredCapacity: 50,
      });

      setSelectedComponents(prev => [...prev, componentType]);
    } catch (error) {
      console.error('Failed to add economic component:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a single component
  const removeComponent = async (componentType: EconomicComponentType) => {
    if (!countryId) return;

    setIsLoading(true);
    try {
      // Find the component ID
      const component = getComponentsQuery.data?.find(comp => comp.componentType === componentType);
      if (component) {
        await removeComponentMutation.mutateAsync({ id: component.id });
      }

      setSelectedComponents(prev => prev.filter(comp => comp !== componentType));
    } catch (error) {
      console.error('Failed to remove economic component:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle component selection
  const toggleComponent = async (componentType: EconomicComponentType) => {
    if (selectedComponents.includes(componentType)) {
      await removeComponent(componentType);
    } else {
      await addComponent(componentType);
    }
  };

  // Update component effectiveness
  const updateEffectiveness = async (componentType: EconomicComponentType, effectivenessScore: number) => {
    if (!countryId) return;

    setIsLoading(true);
    try {
      const component = getComponentsQuery.data?.find(comp => comp.componentType === componentType);
      if (component) {
        await updateComponentMutation.mutateAsync({
          id: component.id,
          effectivenessScore,
        });
      }
    } catch (error) {
      console.error('Failed to update component effectiveness:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Computed values
  const effectiveness = getEffectivenessQuery.data;
  const components = getComponentsQuery.data || [];
  const activeComponents = components.filter(comp => comp.isActive);

  return {
    // State
    selectedComponents,
    isLoading,
    components,
    activeComponents,
    effectiveness,

    // Actions
    saveComponents,
    addComponent,
    removeComponent,
    toggleComponent,
    updateEffectiveness,

    // Status
    isSaving: bulkUpdateMutation.isPending,
    isCreating: createComponentMutation.isPending,
    isUpdating: updateComponentMutation.isPending,
    isRemoving: removeComponentMutation.isPending,
  };
}

