/**
 * Unified Intelligence Hook
 *
 * Centralized state management and data fetching for the intelligence dashboard.
 * Integrates all intelligence systems with real-time updates and computed analytics.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { IntelligenceWebSocketClient } from '~/lib/websocket/intelligence-websocket-client';

// ===== TYPES =====

export type IntelligenceTab =
  | 'overview'
  | 'meetings'
  | 'policies'
  | 'communications'
  | 'diplomatic-ops'
  | 'intelligence-feed'
  | 'analytics';

export type ClassificationLevel = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
export type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type CategoryFilter = 'all' | 'economic' | 'ECONOMIC' | 'crisis' | 'CRISIS' | 'diplomatic' | 'DIPLOMATIC' | 'security' | 'SECURITY' | 'technology' | 'environment';

export interface FilterState {
  classification: ClassificationLevel | 'all';
  priority: PriorityLevel | 'all';
  category: CategoryFilter;
  dateRange: 'today' | 'week' | 'month' | 'all';
  searchQuery: string;
}

export interface PaginationState {
  offset: number;
  limit: number;
}

export interface IntelligenceMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  unreadBriefings: number;
  activeMeetings: number;
  pendingDecisions: number;
  activeRecommendations: number;
  overallHealth: number;
  lastUpdated: Date;
}

export interface UseUnifiedIntelligenceOptions {
  countryId: string;
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseUnifiedIntelligenceReturn {
  // State
  activeTab: IntelligenceTab;
  filters: FilterState;
  pagination: PaginationState;

  // Data
  overview: ReturnType<typeof api.unifiedIntelligence.getOverview.useQuery>['data'];
  quickActions: ReturnType<typeof api.unifiedIntelligence.getQuickActions.useQuery>['data'];
  intelligenceFeed: ReturnType<typeof api.unifiedIntelligence.getIntelligenceFeed.useQuery>['data'];
  analytics: ReturnType<typeof api.unifiedIntelligence.getAnalytics.useQuery>['data'];
  diplomaticChannels: ReturnType<typeof api.unifiedIntelligence.getDiplomaticChannels.useQuery>['data'];

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;

  // WebSocket state
  wsConnected: boolean;

  // Computed values
  metrics: IntelligenceMetrics | null;
  hasUnreadContent: boolean;

  // Actions
  setActiveTab: (tab: IntelligenceTab) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  executeQuickAction: (actionId: string, parameters?: Record<string, any>) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  archiveAlert: (alertId: string) => Promise<void>;
  executeRecommendation: (recommendationId: string) => Promise<void>;
  sendSecureMessage: (messageData: any) => Promise<void>;
  refreshAll: () => Promise<void>;
  resetFilters: () => void;
}

// ===== DEFAULT VALUES =====

const DEFAULT_FILTERS: FilterState = {
  classification: 'all',
  priority: 'all',
  category: 'all',
  dateRange: 'week',
  searchQuery: ''
};

const DEFAULT_PAGINATION: PaginationState = {
  offset: 0,
  limit: 20
};

// ===== HOOK =====

export function useUnifiedIntelligence({
  countryId,
  userId,
  autoRefresh = false,
  refreshInterval = 30000 // 30 seconds
}: UseUnifiedIntelligenceOptions): UseUnifiedIntelligenceReturn {
  // Local state
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('overview');
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);
  const [pagination, setPaginationState] = useState<PaginationState>(DEFAULT_PAGINATION);

  // WebSocket state
  const [wsClient, setWsClient] = useState<IntelligenceWebSocketClient | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Data fetching with tRPC
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isFetching: overviewRefreshing
  } = api.unifiedIntelligence.getOverview.useQuery(
    { countryId },
    {
      enabled: !!countryId,
      refetchInterval: autoRefresh ? refreshInterval : false
    }
  );

  const {
    data: quickActions,
    isLoading: actionsLoading,
    refetch: refetchActions,
    isFetching: actionsRefreshing
  } = api.unifiedIntelligence.getQuickActions.useQuery(
    { countryId },
    {
      enabled: !!countryId,
      refetchInterval: autoRefresh ? refreshInterval : false
    }
  );

  const {
    data: intelligenceFeed,
    isLoading: feedLoading,
    refetch: refetchFeed,
    isFetching: feedRefreshing
  } = api.unifiedIntelligence.getIntelligenceFeed.useQuery(
    {
      countryId,
      category: filters.category !== 'all' ? filters.category : undefined,
      priority: filters.priority !== 'all' ? (filters.priority as any) : undefined,
      limit: pagination.limit,
      offset: pagination.offset
    },
    {
      enabled: !!countryId,
      refetchInterval: autoRefresh ? refreshInterval : false
    }
  );

  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
    isFetching: analyticsRefreshing
  } = api.unifiedIntelligence.getAnalytics.useQuery(
    { countryId, timeframe: '30d' },
    {
      enabled: !!countryId && activeTab === 'analytics',
      refetchInterval: autoRefresh ? refreshInterval * 2 : false // Less frequent for analytics
    }
  );

  const {
    data: diplomaticChannels,
    isLoading: channelsLoading,
    refetch: refetchChannels,
    isFetching: channelsRefreshing
  } = api.unifiedIntelligence.getDiplomaticChannels.useQuery(
    {
      countryId,
      clearanceLevel: filters.classification !== 'all' ? filters.classification : 'PUBLIC'
    },
    {
      enabled: !!countryId && activeTab === 'communications',
      refetchInterval: autoRefresh ? refreshInterval : false
    }
  );

  // Mutations
  const executeActionMutation = api.unifiedIntelligence.executeAction.useMutation({
    onSuccess: (result) => {
      toast.success('Action Executed', {
        description: `${result.message} - ${result.effect}`
      });
      void refetchOverview();
      void refetchActions();
    },
    onError: (error) => {
      toast.error('Action Failed', {
        description: error.message
      });
    }
  });

  const acknowledgeAlertMutation = api.unifiedIntelligence.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success('Alert Acknowledged');
      void refetchOverview();
    },
    onError: (error) => {
      toast.error('Failed to acknowledge alert', { description: error.message });
    }
  });

  const archiveAlertMutation = api.unifiedIntelligence.archiveAlert.useMutation({
    onSuccess: () => {
      toast.success('Alert archived');
      void refetchOverview();
    },
    onError: (error) => {
      toast.error('Failed to archive alert', { description: error.message });
    }
  });

  const sendMessageMutation = api.unifiedIntelligence.sendSecureMessage.useMutation({
    onSuccess: (result) => {
      toast.success('Message Sent', {
        description: `Secure message sent to ${result.recipientCount} recipient(s)`
      });
      void refetchChannels();
    },
    onError: (error) => {
      toast.error('Message Failed', {
        description: error.message
      });
    }
  });

  // Computed metrics
  const metrics = useMemo<IntelligenceMetrics | null>(() => {
    if (!overview) return null;

    return {
      totalAlerts: overview.alerts?.total || 0,
      criticalAlerts: overview.alerts?.critical || 0,
      unreadBriefings: overview.briefings?.items?.filter((b: any) => !b.isRead).length || 0,
      activeMeetings: overview.activity?.recentMeetings || 0,
      pendingDecisions: overview.activity?.pendingDecisions || 0,
      activeRecommendations: quickActions?.actions?.filter((a: any) => !a.isImplemented).length || 0,
      overallHealth: overview.vitality
        ? Math.round((
            (overview.vitality.economic || 0) +
            (overview.vitality.social || 0) +
            (overview.vitality.diplomatic || 0) +
            (overview.vitality.governance || 0)
          ) / 4)
        : 0,
      lastUpdated: overview.lastUpdated ? new Date(overview.lastUpdated) : new Date()
    };
  }, [overview, quickActions]);

  const hasUnreadContent = useMemo(() => {
    return (metrics?.criticalAlerts || 0) > 0 || (metrics?.unreadBriefings || 0) > 0;
  }, [metrics]);

  const isLoading = useMemo(() => {
    return overviewLoading || actionsLoading || feedLoading || analyticsLoading || channelsLoading;
  }, [overviewLoading, actionsLoading, feedLoading, analyticsLoading, channelsLoading]);

  const isRefreshing = useMemo(() => {
    return overviewRefreshing || actionsRefreshing || feedRefreshing || analyticsRefreshing || channelsRefreshing;
  }, [overviewRefreshing, actionsRefreshing, feedRefreshing, analyticsRefreshing, channelsRefreshing]);

  // Action handlers
  const executeQuickAction = useCallback(async (actionId: string, parameters?: Record<string, any>) => {
    await executeActionMutation.mutateAsync({
      countryId,
      actionType: actionId as any,
      parameters: parameters || {}
    });
  }, [countryId, executeActionMutation]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await acknowledgeAlertMutation.mutateAsync({ alertId });
      await refetchFeed();
    } catch (error) {
      console.error('[useUnifiedIntelligence] Failed to acknowledge alert:', error);
    }
  }, [acknowledgeAlertMutation, refetchFeed]);

  const archiveAlert = useCallback(async (alertId: string) => {
    try {
      await archiveAlertMutation.mutateAsync({ alertId });
      await Promise.all([refetchOverview(), refetchFeed()]);
    } catch (error) {
      console.error('[useUnifiedIntelligence] Failed to archive alert:', error);
    }
  }, [archiveAlertMutation, refetchOverview, refetchFeed]);

  const executeRecommendation = useCallback(async (recommendationId: string) => {
    await executeQuickAction(`recommendation_${recommendationId}`, {
      recommendationId
    });
  }, [executeQuickAction]);

  const sendSecureMessage = useCallback(async (messageData: any) => {
    await sendMessageMutation.mutateAsync(messageData);
  }, [sendMessageMutation]);

  const refreshAll = useCallback(async () => {
    toast.info('Refreshing Intelligence', { description: 'Updating all intelligence data...' });
    await Promise.all([
      refetchOverview(),
      refetchActions(),
      refetchFeed(),
      refetchAnalytics(),
      refetchChannels()
    ]);
    toast.success('Intelligence Updated', { description: 'All data has been refreshed' });
  }, [refetchOverview, refetchActions, refetchFeed, refetchAnalytics, refetchChannels]);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    // Reset pagination when filters change
    setPaginationState(DEFAULT_PAGINATION);
  }, []);

  const setPagination = useCallback((newPagination: Partial<PaginationState>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setPaginationState(DEFAULT_PAGINATION);
  }, []);

  // Stabilize callbacks with useCallback to prevent WebSocket re-initialization
  const stableRefetchOverview = useCallback(() => {
    void refetchOverview();
  }, [refetchOverview]);

  const stableRefetchFeed = useCallback(() => {
    void refetchFeed();
  }, [refetchFeed]);

  const stableRefreshAll = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      stableRefreshAll();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, stableRefreshAll]);

  // WebSocket initialization and real-time updates
  useEffect(() => {
    if (!countryId || !userId) return;

    // Check if WebSocket should be enabled based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true';
    
    if (!isProduction && !websocketEnabled) {
      console.log('[useUnifiedIntelligence] WebSocket disabled in development mode');
      return;
    }

    console.log('[useUnifiedIntelligence] Initializing WebSocket connection for country:', countryId);

    const client = new IntelligenceWebSocketClient({
      countryId,
      autoReconnect: true,
      onUpdate: (update) => {
        console.log('[useUnifiedIntelligence] Received WebSocket update:', update.type, update);
        // Trigger refetch of overview and intelligence feed on updates
        stableRefetchOverview();
        stableRefetchFeed();
      },
      onAlert: (alert) => {
        console.log('[useUnifiedIntelligence] Received WebSocket alert:', alert);
        // Show toast notification for alerts
        toast.warning(alert.title, {
          description: alert.description || 'New intelligence alert received'
        });
        // Refresh data to show new alert
        stableRefetchOverview();
      },
      onConnect: () => {
        console.log('[useUnifiedIntelligence] WebSocket connected');
        setWsConnected(true);
      },
      onDisconnect: () => {
        console.log('[useUnifiedIntelligence] WebSocket disconnected');
        setWsConnected(false);
      },
      onError: (error) => {
        console.error('[useUnifiedIntelligence] WebSocket error:', error);
      }
    });

    client.connect(userId, countryId).catch((error) => {
      console.error('[useUnifiedIntelligence] Failed to connect WebSocket:', error);
    });

    setWsClient(client);

    return () => {
      console.log('[useUnifiedIntelligence] Cleaning up WebSocket connection');
      client.disconnect();
    };
  }, [countryId, userId, stableRefetchOverview, stableRefetchFeed]);

  return {
    // State
    activeTab,
    filters,
    pagination,

    // Data
    overview,
    quickActions,
    intelligenceFeed,
    analytics,
    diplomaticChannels,

    // Loading states
    isLoading,
    isRefreshing,

    // WebSocket state
    wsConnected,

    // Computed values
    metrics,
    hasUnreadContent,

    // Actions
    setActiveTab,
    setFilters,
    setPagination,
    executeQuickAction,
    acknowledgeAlert,
    archiveAlert,
    executeRecommendation,
    sendSecureMessage,
    refreshAll,
    resetFilters
  };
}

/**
 * Lightweight hook for dashboard widgets that only need overview data
 */
export function useIntelligenceOverview(countryId: string) {
  const { data, isLoading, refetch } = api.unifiedIntelligence.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  return {
    overview: data,
    isLoading,
    refresh: refetch
  };
}

/**
 * Hook specifically for quick actions functionality
 */
export function useQuickActions(countryId: string) {
  const { data, isLoading, refetch } = api.unifiedIntelligence.getQuickActions.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const executeMutation = api.unifiedIntelligence.executeAction.useMutation({
    onSuccess: () => {
      void refetch();
    }
  });

  const execute = useCallback(async (actionType: string, parameters?: Record<string, any>) => {
    await executeMutation.mutateAsync({
      countryId,
      actionType: actionType as any,
      parameters: parameters || {}
    });
  }, [countryId, executeMutation]);

  return {
    actions: data?.actions || [],
    context: data?.context,
    isLoading,
    execute,
    isExecuting: executeMutation.isPending
  };
}
