"use client";

/**
 * MyCountryDataWrapper - Central data orchestration component for MyCountry system
 * 
 * This component serves as the main data coordination layer, integrating:
 * - Real-time data synchronization
 * - Unified notification management 
 * - Executive vs public mode switching
 * - Cross-system state management
 * 
 * Key responsibilities:
 * - Coordinate between useDataSync hook and RealTimeDataService
 * - Route notifications to appropriate systems (executive/global)
 * - Manage view mode transitions and data filtering
 * - Provide unified data interface to child components
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Globe, 
  Shield, 
  Users 
} from 'lucide-react';
import { RealTimeDataService } from './RealTimeDataService';
import { useDataSync } from '../hooks/useDataSync';
import { useUnifiedNotifications } from '~/hooks/useUnifiedNotifications';
import { UnifiedLayout } from './UnifiedLayout';
import { useExecutiveNotifications, type ExecutiveNotification } from '~/contexts/ExecutiveNotificationContext';
import { useIntelligenceWebSocket } from '~/hooks/useIntelligenceWebSocket';
import { PublicMyCountryPage } from '../public-page';
import { ExecutiveDashboard } from '../executive-dashboard';
import { api } from "~/trpc/react";
import { standardize } from '~/lib/interface-standardizer';
import { ensureCountryData } from '~/lib/type-guards';
import { adaptExecutiveToQuick } from '~/lib/transformers/interface-adapters';

// Executive actions now come from real API - no mock data needed

interface MyCountryDataWrapperProps {
  user: any;
  userProfile: any;
  country: any;
  isOwner: boolean;
  currentIxTime: number;
  timeAcceleration: number;
  achievements: any[];
  milestones: any[];
  rankings: any[];
  intelligenceFeed: any[];
  flagUrl?: string | null;
  viewMode: 'public' | 'executive';
  onModeToggle: (mode: 'public' | 'executive') => void;
  onActionClick: (actionId: string) => void;
  onFocusAreaClick: (areaId: string) => void;
  onSettingsClick: () => void;
  onPrivateAccess: () => void;
}

export function MyCountryDataWrapper({
  user,
  userProfile,
  country,
  isOwner,
  currentIxTime,
  timeAcceleration,
  achievements,
  milestones,
  rankings,
  intelligenceFeed,
  flagUrl,
  viewMode,
  onModeToggle,
  onActionClick,
  onFocusAreaClick,
  onSettingsClick,
  onPrivateAccess,
}: MyCountryDataWrapperProps) {
  
  // Executive notifications integration
  const { setNotifications, setExecutiveMode } = useExecutiveNotifications();
  
  // Unified notification system - using global notifications
  const { createNotification } = useUnifiedNotifications();
  
  // Real-time intelligence WebSocket integration
  const {
    connected: wsConnected,
    authenticated: wsAuthenticated,
    latestUpdate,
    latestAlert,
    updateCount,
    alertCount
  } = useIntelligenceWebSocket({
    countryId: country?.id,
    subscribeToGlobal: viewMode === 'executive',
    subscribeToAlerts: true,
    onUpdate: (update) => {
      console.log('Real-time intelligence update:', update);
      // Handle real-time intelligence updates
      if (update.severity === 'critical' || update.priority === 'urgent') {
        createNotification({
          source: 'system',
          title: update.title,
          message: update.description || '',
          type: update.severity === 'critical' ? 'error' : 'warning',
          category: 'system',
          priority: update.severity === 'critical' ? 'critical' : 'high',
          severity: 'important',
          context: {} as any,
          triggers: [],
          deliveryMethod: 'toast',
          actionable: false
        });
      }
    },
    onAlert: (alert) => {
      console.log('Real-time intelligence alert:', alert);
      // Handle critical alerts
      createNotification({
        source: 'intelligence',
        title: `🚨 ${alert.title}`,
        message: alert.description || '',
        type: 'error',
        category: 'crisis',
        priority: 'critical',
        severity: 'urgent',
        context: {} as any,
        triggers: [],
        deliveryMethod: 'modal',
        actionable: true,
        actions: [
          { 
            id: `action-${alert.id}`,
            label: 'View Details',
            type: 'primary',
            onClick: () => console.log('View alert details:', alert.id)
          }
        ]
      });
      
      // Update executive notifications for alerts
      if (viewMode === 'executive') {
        const newNotification: ExecutiveNotification = {
          id: alert.id,
          type: alert.severity === 'critical' ? 'alert' : 'update',
          severity: alert.severity as 'critical' | 'high' | 'medium' | 'low',
          title: alert.title,
          description: (alert as any).message || alert.description || '',
          category: 'security',
          timestamp: Date.now(),
          actionable: (alert as any).actionRequired || false,
          read: false,
          source: 'intelligence'
        };
        // Note: Would need to access current notifications to properly update
        // For now, just set a single notification as the setter expects a full array
        setNotifications([newNotification]);
      }
    },
    onConnect: () => {
      console.log('Intelligence WebSocket connected');
      createNotification({
        source: 'system',
        title: '🔗 Real-time Intelligence Connected',
        message: 'Live intelligence updates are now active',
        type: 'success',
        category: 'system',
        priority: 'medium',
        severity: 'informational',
        context: {} as any,
        triggers: [],
        deliveryMethod: 'toast',
        actionable: false
      });
    },
    onDisconnect: () => {
      console.log('Intelligence WebSocket disconnected');
      createNotification({
        source: 'system',
        title: '⚠️ Real-time Intelligence Disconnected',
        message: 'Attempting to reconnect...',
        type: 'warning',
        category: 'system',
        priority: 'high',
        severity: 'important',
        context: {} as any,
        triggers: [],
        deliveryMethod: 'toast',
        actionable: false
      });
    }
  });
  
  // Real API call for executive actions
  const { data: executiveActions = [] } = api.mycountry.getExecutiveActions.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId && isOwner && viewMode === 'executive' }
  );
  
  // Executive action execution mutation
  const executeActionMutation = api.mycountry.executeAction.useMutation({
    onSuccess: (result) => {
      console.log('[Executive Action] Success:', result.message);
      // Add success notification
      createNotification({
        source: 'system',
        type: 'success',
        category: 'governance',
        title: 'Action Executed',
        message: result.message,
        priority: 'medium',
        severity: 'informational',
        context: {} as any,
        triggers: [],
        deliveryMethod: 'toast',
        actionable: false
      });
    },
    onError: (error) => {
      console.error('[Executive Action] Error:', error.message);
      // Add error notification
      createNotification({
        source: 'system',
        type: 'error',
        category: 'system',
        title: 'Action Failed',
        message: error.message,
        priority: 'high',
        severity: 'important',
        context: {} as any,
        triggers: [],
        deliveryMethod: 'toast',
        actionable: false
      });
    }
  });
  
  // Data notification helpers
  const createEconomicAlert = async (data: { metric: string; value: number; change: number; threshold?: number }) => {
    const notification = {
      source: 'system' as const,
      type: 'alert' as const,
      category: 'economic' as const,
      title: `Economic Alert: ${data.metric}`,
      message: `${data.metric} has changed by ${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}% to ${data.value.toLocaleString()}`,
      priority: Math.abs(data.change) > 5 ? 'high' as const : 'medium' as const,
      severity: 'important' as const,
      actionable: true,
      context: {} as any,
      triggers: [],
      deliveryMethod: 'toast' as const
    };
    return createNotification(notification);
  };
  
  // Set executive mode and notifications based on view mode
  React.useEffect(() => {
    console.log('[MyCountryDataWrapper] Setting executive mode:', viewMode === 'executive');
    
    setExecutiveMode(viewMode === 'executive');
    if (viewMode === 'executive' && intelligenceFeed && intelligenceFeed.length > 0) {
      const processedNotifications = intelligenceFeed.map(item => ({
        ...item,
        read: false // Mark all as unread initially
      }));
      setNotifications(processedNotifications);
    } else if (viewMode !== 'executive') {
      // Clear executive notifications when not in executive mode
      setNotifications([]);
    }
  }, [viewMode, intelligenceFeed?.length]); // Only depend on length to prevent infinite loops
  
  // Real-time data sync integration - simplified to prevent infinite loops
  const { 
    data: syncedCountryData, 
    isLoading: dataSyncLoading,
    syncState,
    isConnected,
    forceRefresh,
    forceUpdateStats 
  } = useDataSync(userProfile?.countryId || '', {
    enabled: !!userProfile?.countryId && !!user,
    pollInterval: viewMode === 'executive' ? 60000 : 120000, // Executive mode gets faster updates
    notificationsEnabled: false, // Use unified system instead
    onDataChange: async (data, changes) => {
      if (changes.length > 0) {
        console.log(`[MyCountry] Data changed: ${changes.join(', ')}`);
        
        // Generate unified notifications for data changes
        for (const change of changes) {
          await handleDataChangeNotification(change, data, country);
        }
      }
    },
    onStatusChange: (status) => {
      console.log(`[MyCountry] Sync status: ${status}`);
    }
  });

  // Handle data change notifications through unified system
  const handleDataChangeNotification = async (change: string, newData: any, oldData: any) => {
    try {
      switch (change) {
        case 'gdpPerCapita':
          if (oldData && newData.currentGdpPerCapita !== oldData.currentGdpPerCapita) {
            const changePercent = ((newData.currentGdpPerCapita - oldData.currentGdpPerCapita) / oldData.currentGdpPerCapita) * 100;
            await createEconomicAlert({
              metric: 'GDP per Capita',
              value: newData.currentGdpPerCapita,
              change: changePercent,
              threshold: 5, // 5% threshold
            });
          }
          break;
          
        case 'economicTier':
          if (oldData && newData.economicTier !== oldData.economicTier) {
            const isImprovement = getTierRank(newData.economicTier) > getTierRank(oldData.economicTier);
            await createNotification({
              source: 'system',
              title: `Economic Tier ${isImprovement ? 'Advancement' : 'Change'}!`,
              message: `Your nation has moved from ${oldData.economicTier} to ${newData.economicTier}`,
              category: 'achievement',
              type: 'success',
              priority: 'high',
              severity: 'important',
              context: {} as any,
              triggers: [{
                type: 'threshold',
                source: 'economic-tier-system',
                data: { oldTier: oldData.economicTier, newTier: newData.economicTier },
                confidence: 1.0,
              }],
              deliveryMethod: 'dynamic-island',
              actionable: true,
              actions: [{
                id: 'celebrate-tier',
                label: 'View Achievement',
                type: 'primary',
                onClick: () => {
                  window.location.href = '/mycountry/achievements';
                }
              }],
            });
          }
          break;
      }
    } catch (error) {
      console.error('[MyCountryDataWrapper] Failed to create notification:', error);
    }
  };

  // Helper function to rank economic tiers
  const getTierRank = (tier: string): number => {
    const ranks = {
      'Impoverished': 1,
      'Developing': 2,
      'Emerging': 3,
      'Developed': 4,
      'Advanced': 5,
      'Elite': 6,
    };
    return ranks[tier as keyof typeof ranks] || 0;
  };

  // Use synced data if available, fallback to original country data with type safety
  const rawCountryData = syncedCountryData || country;
  const enhancedCountryData = ensureCountryData(rawCountryData);
  const isLoading = dataSyncLoading;

  return (
    <>
      {/* Real-time data sync service with unified notifications */}
      {enhancedCountryData && (
        <RealTimeDataService
          countryId={enhancedCountryData.id}
          isActive={!!user && isConnected}
          updateInterval={viewMode === 'executive' ? 'FAST' : 'NORMAL'}
          onDataUpdate={undefined}
        />
      )}
      
      <UnifiedLayout
        country={enhancedCountryData}
        viewMode={viewMode}
        isOwner={isOwner}
        onModeToggle={onModeToggle}
        currentIxTime={currentIxTime}
        timeAcceleration={timeAcceleration}
        achievements={achievements}
        milestones={milestones}
        rankings={rankings}
        intelligenceFeed={intelligenceFeed}
        flagUrl={flagUrl}
        syncState={syncState}
        onForceRefresh={forceRefresh}
        onForceUpdateStats={forceUpdateStats}
      >
        {/* Content based on view mode */}
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {viewMode === 'executive' && isOwner ? (
            <ExecutiveDashboard
              country={enhancedCountryData}
              intelligenceFeed={intelligenceFeed}
              quickActions={executiveActions.map(adaptExecutiveToQuick)}
              currentIxTime={currentIxTime}
              timeAcceleration={timeAcceleration}
              onActionClick={(actionId: string) => {
                // Execute the action via API
                executeActionMutation.mutate({
                  countryId: userProfile?.countryId || '',
                  actionId: actionId,
                  parameters: {}
                });
                // Also call the original handler for any additional logic
                onActionClick(actionId);
              }}
              onFocusAreaClick={onFocusAreaClick}
              onSettingsClick={onSettingsClick}
            />
          ) : (
            <PublicMyCountryPage
              country={enhancedCountryData}
              achievements={achievements}
              milestones={milestones}
              rankings={rankings}
              intelligenceFeed={intelligenceFeed}
              isOwner={isOwner}
              onPrivateAccess={onPrivateAccess}
            />
          )}
        </motion.div>

        {/* Page title effect */}
        {typeof window !== 'undefined' && enhancedCountryData && (
          <script
            dangerouslySetInnerHTML={{
              __html: `document.title = "${viewMode === 'executive' ? 'Executive Command' : 'MyCountry'}: ${enhancedCountryData.name} - IxStats";`
            }}
          />
        )}
      </UnifiedLayout>
    </>
  );
}

export default MyCountryDataWrapper;