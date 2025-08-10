"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { api } from "~/trpc/react";
import { IxTime } from '~/lib/ixtime';
import { useGlobalNotifications, DataNotificationGenerators } from './GlobalNotificationSystem';

// Real-time data service configuration
const UPDATE_INTERVALS = {
  FAST: 30000,      // 30 seconds - critical data
  NORMAL: 60000,    // 1 minute - standard data
  SLOW: 300000,     // 5 minutes - less critical data
} as const;

interface RealTimeDataServiceProps {
  countryId: string;
  isActive: boolean;
  updateInterval?: keyof typeof UPDATE_INTERVALS;
  onDataUpdate?: (data: any) => void;
}

interface DataSnapshot {
  timestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  economicTier: string;
  populationTier: string;
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

export function RealTimeDataService({ 
  countryId, 
  isActive, 
  updateInterval = 'NORMAL',
  onDataUpdate 
}: RealTimeDataServiceProps) {
  const { addNotification } = useGlobalNotifications();
  const lastSnapshotRef = useRef<DataSnapshot | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoadRef = useRef(true);

  // Stable timestamp to prevent infinite queries
  const stableTimestamp = useRef(IxTime.getCurrentIxTime());
  
  // TRPC query for getting real-time country data
  const { 
    data: countryData, 
    refetch: refetchCountry,
    isLoading 
  } = api.countries.getByIdAtTime.useQuery(
    { id: countryId, timestamp: stableTimestamp.current },
    { 
      enabled: isActive && !!countryId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    }
  );

  // Data change detection and notification system
  const analyzeDataChanges = useCallback((current: DataSnapshot, previous: DataSnapshot) => {
    const changes = [];
    const SIGNIFICANT_THRESHOLD = 0.05; // 5% change threshold
    const CRITICAL_THRESHOLD = 0.10; // 10% change threshold

    // Population changes
    const popChange = (current.population - previous.population) / previous.population;
    if (Math.abs(popChange) > SIGNIFICANT_THRESHOLD) {
      const notification = DataNotificationGenerators.demographicUpdate({
        population: current.population,
        change: current.population - previous.population,
        growthRate: popChange,
      });
      
      addNotification({
        ...notification,
        priority: Math.abs(popChange) > CRITICAL_THRESHOLD ? 'high' : 'medium',
        autoRemove: true,
        removeAfter: 45000, // 45 seconds
      });
      changes.push('population');
    }

    // GDP per capita changes
    const gdpPcChange = (current.gdpPerCapita - previous.gdpPerCapita) / previous.gdpPerCapita;
    if (Math.abs(gdpPcChange) > SIGNIFICANT_THRESHOLD) {
      const notification = DataNotificationGenerators.economicAlert({
        metric: 'GDP per Capita',
        value: current.gdpPerCapita,
        change: gdpPcChange * 100,
        threshold: SIGNIFICANT_THRESHOLD * 100,
      });
      
      addNotification({
        ...notification,
        priority: Math.abs(gdpPcChange) > CRITICAL_THRESHOLD ? 'critical' : 'high',
        autoRemove: true,
        removeAfter: 60000, // 1 minute
        actions: [{
          id: 'view-details',
          label: 'View Details',
          type: 'primary' as const,
          onClick: () => {
            // Navigate to economic details or open modal
            console.log('Navigate to economic details');
          }
        }]
      });
      changes.push('gdpPerCapita');
    }

    // Economic tier changes
    if (current.economicTier !== previous.economicTier) {
      addNotification({
        type: 'success',
        category: 'achievement',
        title: 'Economic Tier Change!',
        message: `Your nation has ${getTierDirection(previous.economicTier, current.economicTier)} from ${previous.economicTier} to ${current.economicTier}`,
        source: 'Economic Intelligence',
        actionable: false,
        priority: 'high',
        autoRemove: false, // Keep tier changes visible
        actions: [{
          id: 'celebrate',
          label: 'Celebrate',
          type: 'primary' as const,
          onClick: () => {
            // Trigger celebration animation or effect
            console.log('Tier change celebration');
          }
        }]
      });
      changes.push('economicTier');
    }

    // Vitality score changes (combined metric)
    const vitalityChange = current.economicVitality - previous.economicVitality;
    if (Math.abs(vitalityChange) > 5) { // 5 point change in vitality
      addNotification({
        type: vitalityChange > 0 ? 'success' : 'warning',
        category: 'economic',
        title: 'National Vitality Update',
        message: `Economic vitality ${vitalityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(vitalityChange).toFixed(1)} points to ${current.economicVitality.toFixed(1)}`,
        source: 'Vitality Monitor',
        actionable: true,
        priority: Math.abs(vitalityChange) > 10 ? 'high' : 'medium',
        autoRemove: true,
        removeAfter: 30000,
      });
      changes.push('vitality');
    }

    return changes;
  }, [addNotification]);

  // Create data snapshot from country data
  const createSnapshot = useCallback((data: any): DataSnapshot => ({
    timestamp: IxTime.getCurrentIxTime(),
    population: data.currentPopulation || 0,
    gdpPerCapita: data.currentGdpPerCapita || 0,
    totalGdp: data.currentTotalGdp || 0,
    economicTier: data.economicTier || 'Unknown',
    populationTier: data.populationTier || 'Unknown',
    economicVitality: data.economicVitality || 0,
    populationWellbeing: data.populationWellbeing || 0,
    diplomaticStanding: data.diplomaticStanding || 0,
    governmentalEfficiency: data.governmentalEfficiency || 0,
  }), []);

  // Main data processing function
  const processDataUpdate = useCallback((newData: any) => {
    if (!newData) return;

    const currentSnapshot = createSnapshot(newData);
    
    // Compare with previous snapshot if available
    if (lastSnapshotRef.current && !isFirstLoadRef.current) {
      const changes = analyzeDataChanges(currentSnapshot, lastSnapshotRef.current);
      
      if (changes.length > 0) {
        console.log(`[RealTimeDataService] Detected changes in: ${changes.join(', ')}`);
        
        // Generate system status notification for multiple changes
        if (changes.length > 2) {
          addNotification({
            type: 'info',
            category: 'system',
            title: 'Multiple Data Updates',
            message: `${changes.length} national metrics have been updated`,
            source: 'Data Monitor',
            actionable: false,
            priority: 'low',
            autoRemove: true,
            removeAfter: 20000,
          });
        }
      }
    }

    // Update refs
    lastSnapshotRef.current = currentSnapshot;
    isFirstLoadRef.current = false;

    // Call external callback
    onDataUpdate?.(newData);
  }, [createSnapshot, analyzeDataChanges, addNotification, onDataUpdate]);

  // Real-time update polling - DISABLED to prevent infinite loops
  const startPolling = useCallback(() => {
    console.log(`[RealTimeDataService] Polling disabled to prevent infinite loops for country ${countryId}`);
    // DISABLED: Real-time polling that was causing infinite loops
    // The useDataSync hook in MyCountryDataWrapper handles data updates instead
  }, [countryId]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[RealTimeDataService] Stopped polling');
    }
  }, []);

  // Process data when it updates
  useEffect(() => {
    if (countryData && !isLoading) {
      processDataUpdate(countryData);
    }
  }, [countryData, isLoading, processDataUpdate]);

  // Start/stop polling based on active state - DISABLED
  useEffect(() => {
    // DISABLED: Polling that was causing infinite loops
    // Data updates are now handled by useDataSync hook
    console.log('[RealTimeDataService] Service active but polling disabled:', isActive && !!countryId);
  }, [isActive, countryId]);

  // IxTime integration - DISABLED to prevent infinite loops
  useEffect(() => {
    // DISABLED: Time checking that was triggering constant refetches
    // This will be handled by the useDataSync hook instead
    console.log('[RealTimeDataService] IxTime monitoring disabled to prevent loops');
  }, [isActive]);

  // Component cleanup
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // This component doesn't render anything visible
  return null;
}

// Helper function to determine tier progression direction
function getTierDirection(oldTier: string, newTier: string): string {
  const tierOrder = ['Impoverished', 'Developing', 'Emerging', 'Developed', 'Advanced', 'Elite'];
  const oldIndex = tierOrder.indexOf(oldTier);
  const newIndex = tierOrder.indexOf(newTier);
  
  if (newIndex > oldIndex) return 'advanced';
  if (newIndex < oldIndex) return 'declined';
  return 'changed';
}

// Hook for easy integration
export function useRealTimeData(countryId: string, options: {
  enabled?: boolean;
  updateInterval?: keyof typeof UPDATE_INTERVALS;
  onDataUpdate?: (data: any) => void;
} = {}) {
  const { enabled = true, updateInterval = 'NORMAL', onDataUpdate } = options;

  return (
    <RealTimeDataService
      countryId={countryId}
      isActive={enabled}
      updateInterval={updateInterval}
      onDataUpdate={onDataUpdate}
    />
  );
}

export default RealTimeDataService;