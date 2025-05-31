// src/context/ixstats-context.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { IxTime } from "~/lib/ixtime";
import { useTheme } from "~/context/theme-context";

export type TimeResolutionType = 'quarterly' | 'annual';
export type ChartResolutionType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

interface IxStatsContextType {
  // Current time state
  currentIxTime: number;
  targetIxTime: number;
  setTargetIxTime: (time: number) => void;
  
  // Forecast settings
  forecastYears: number;
  setForecastYears: (years: number) => void;
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;

  // Chart display settings
  timeResolution: TimeResolutionType;
  setTimeResolution: (resolution: TimeResolutionType) => void;
  showDensity: boolean;
  setShowDensity: (show: boolean) => void;
  
  // Data refresh settings
  autoRefresh: boolean;
  setAutoRefresh: (refresh: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  
  // Bot sync settings
  botSyncEnabled: boolean;
  setBotSyncEnabled: (enabled: boolean) => void;
  botSyncStatus: 'connected' | 'disconnected' | 'syncing';
  
  // Time helpers
  isTimeTravel: boolean;
  resetToPresent: () => void;
  formatGameYear: (timestamp: number) => string;
  
  // Theme related
  chartColors: {
    population: string;
    gdp: string;
    density: string;
    forecast: string;
    grid: string;
    axis: string;
    text: string;
    referenceLines: {
      present: string;
      epoch: string;
    }
  };
  
  // Manual refresh trigger
  triggerRefresh: () => void;
}

const IxStatsContext = createContext<IxStatsContextType | undefined>(undefined);

interface IxStatsProviderProps {
  children: ReactNode;
  initialSyncWithBot?: boolean;
  defaultRefreshInterval?: number;
}

export const IxStatsProvider: React.FC<IxStatsProviderProps> = ({
  children,
  initialSyncWithBot = true,
  defaultRefreshInterval = 30000, // 30 seconds
}) => {
  const { theme } = useTheme();
  
  // Time state
  const [currentIxTime, setCurrentIxTime] = useState(() => IxTime.getCurrentIxTime());
  const [targetIxTime, setTargetIxTime] = useState(() => IxTime.getCurrentIxTime());
  
  // Forecast settings
  const [forecastYears, setForecastYears] = useState(0);
  const [showForecast, setShowForecast] = useState(true);
  
  // Chart display settings
  const [timeResolution, setTimeResolution] = useState<TimeResolutionType>('annual');
  const [showDensity, setShowDensity] = useState(false);
  
  // Data refresh settings
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(defaultRefreshInterval);
  
  // Bot sync settings
  const [botSyncEnabled, setBotSyncEnabled] = useState(initialSyncWithBot);
  const [botSyncStatus, setBotSyncStatus] = useState<'connected' | 'disconnected' | 'syncing'>('disconnected');
  
  // Time-related derived values
  const isTimeTravel = targetIxTime !== currentIxTime;
  
  // Chart colors based on theme
  const chartColors = {
    population: theme === 'dark' ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-1))',
    gdp: theme === 'dark' ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-2))',
    density: theme === 'dark' ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-4))',
    forecast: theme === 'dark' ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-3))',
    grid: theme === 'dark' ? 'hsl(var(--border))' : 'hsl(var(--border))',
    axis: theme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))',
    text: theme === 'dark' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
    referenceLines: {
      present: theme === 'dark' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.6)', // blue
      epoch: theme === 'dark' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.6)', // amber
    }
  };

  // Reset to present time
  const resetToPresent = useCallback(() => {
    setTargetIxTime(IxTime.getCurrentIxTime());
  }, []);
  
  // Format year display based on timestamp
  const formatGameYear = useCallback((timestamp: number): string => {
    const gameYear = IxTime.getCurrentGameYear(timestamp);
    
    if (timeResolution === 'quarterly') {
      const date = new Date(timestamp);
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${gameYear}-Q${quarter}`;
    }
    
    return gameYear.toString();
  }, [timeResolution]);
  
  // Manual refresh trigger
  const triggerRefresh = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Sync with Discord bot
  useEffect(() => {
    if (!botSyncEnabled) return;
    
    const syncWithBot = async () => {
      setBotSyncStatus('syncing');
      try {
        const result = await IxTime.syncWithBot();
        if (result.success) {
          setCurrentIxTime(IxTime.getCurrentIxTime());
          setBotSyncStatus('connected');
          console.log('[IxStats] Synced with Discord bot:', result.data);
        } else {
          console.warn('[IxStats] Failed to sync with Discord bot:', result.message);
          setBotSyncStatus('disconnected');
        }
      } catch (error) {
        console.error('[IxStats] Error syncing with Discord bot:', error);
        setBotSyncStatus('disconnected');
      }
    };
    
    // Initial sync
    void syncWithBot();
    
    // Set up regular sync interval (every minute)
    const syncInterval = setInterval(syncWithBot, 60000);
    
    return () => clearInterval(syncInterval);
  }, [botSyncEnabled]);
  
  // Regular time updates
  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentIxTime(IxTime.getCurrentIxTime());
    }, 1000);
    
    // Data refresh based on configured interval
    let refreshIntervalId: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      refreshIntervalId = setInterval(triggerRefresh, refreshInterval);
    }
    
    return () => {
      clearInterval(timeInterval);
      if (refreshIntervalId) clearInterval(refreshIntervalId);
    };
  }, [autoRefresh, refreshInterval, triggerRefresh]);

  const value: IxStatsContextType = {
    currentIxTime,
    targetIxTime,
    setTargetIxTime,
    forecastYears,
    setForecastYears,
    showForecast,
    setShowForecast,
    timeResolution,
    setTimeResolution,
    showDensity,
    setShowDensity,
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    botSyncEnabled,
    setBotSyncEnabled,
    botSyncStatus,
    isTimeTravel,
    resetToPresent,
    formatGameYear,
    chartColors,
    triggerRefresh,
  };

  return (
    <IxStatsContext.Provider value={value}>
      {children}
    </IxStatsContext.Provider>
  );
};

export const useIxStats = (): IxStatsContextType => {
  const context = useContext(IxStatsContext);
  if (context === undefined) {
    throw new Error('useIxStats must be used within an IxStatsProvider');
  }
  return context;
};