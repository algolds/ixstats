"use client";

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
import { useUnifiedNotifications, useDataNotifications } from '~/hooks/useUnifiedNotifications';
import { UnifiedLayout } from './UnifiedLayout';
import { useExecutiveNotifications } from '~/contexts/ExecutiveNotificationContext';
import { PublicMyCountryPage } from '../public-page';
import { ExecutiveDashboard } from '../executive-dashboard';

// Mock data generator (moved from main page)
function generateMockQuickActions() {
  return [
    {
      id: 'tax-policy',
      title: 'Adjust Corporate Tax Rate',
      description: 'Review and potentially modify corporate taxation to stimulate investment',
      icon: TrendingUp,
      category: 'policy' as const,
      urgency: 'high' as const,
      estimatedTime: '2 hours',
      impact: '+2% GDP growth',
      enabled: true,
    },
    {
      id: 'diplomatic-mission',
      title: 'Approve Diplomatic Mission',
      description: 'Authorize new embassy establishment in strategic trade partner nation',
      icon: Globe,
      category: 'diplomatic' as const,
      urgency: 'medium' as const,
      estimatedTime: '30 minutes',
      impact: 'Enhanced relations',
      enabled: true,
    },
    {
      id: 'emergency-response',
      title: 'Emergency Response Protocol',
      description: 'Activate disaster response measures for recent natural events',
      icon: Shield,
      category: 'emergency' as const,
      urgency: 'critical' as const,
      estimatedTime: '15 minutes',
      impact: 'Immediate relief',
      enabled: true,
    },
    {
      id: 'budget-allocation',
      title: 'Healthcare Budget Reallocation',
      description: 'Approve additional funding for rural healthcare expansion',
      icon: Users,
      category: 'budget' as const,
      urgency: 'medium' as const,
      estimatedTime: '1 hour',
      impact: '+10% healthcare access',
      enabled: true,
    },
  ];
}

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
  
  // Unified notification system
  const { createNotification } = useUnifiedNotifications();
  const { createEconomicAlert, createAchievementNotification } = useDataNotifications();
  
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

  // Use synced data if available, fallback to original country data
  const enhancedCountryData = syncedCountryData || country;
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
              quickActions={generateMockQuickActions()}
              currentIxTime={currentIxTime}
              timeAcceleration={timeAcceleration}
              onActionClick={onActionClick}
              onFocusAreaClick={onFocusAreaClick}
              onSettingsClick={onSettingsClick}
            />
          ) : (
            <PublicMyCountryPage
              country={enhancedCountryData}
              achievements={achievements}
              milestones={milestones}
              rankings={rankings}
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