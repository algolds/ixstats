"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Database, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Users,
  DollarSign,
  Zap,
  RefreshCw,
  Pause,
  Play,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { IxTime } from '~/lib/ixtime';
import { useGlobalNotifications } from './GlobalNotificationSystem';
import { getDatabaseIntegrationService } from '../services/DatabaseIntegrationService';
import { useDataSync } from '../hooks/useDataSync';

interface DataMonitoringCenterProps {
  countryId: string;
  isVisible: boolean;
  onClose?: () => void;
  className?: string;
}

interface MetricTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: number;
}

interface SystemMetrics {
  activeConnections: number;
  dataStreams: number;
  lastUpdate: number;
  updateFrequency: number;
  errors: number;
  uptime: number;
}

export function DataMonitoringCenter({ 
  countryId, 
  isVisible, 
  onClose, 
  className = '' 
}: DataMonitoringCenterProps) {
  const { addNotification } = useGlobalNotifications();
  const dbService = getDatabaseIntegrationService();
  
  // State for monitoring data
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    activeConnections: 0,
    dataStreams: 0,
    lastUpdate: 0,
    updateFrequency: 0,
    errors: 0,
    uptime: 0,
  });
  
  const [metricTrends, setMetricTrends] = useState<MetricTrend[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamIdRef = useRef<string | null>(null);

  // Use the data sync hook for real-time updates
  const { 
    syncState, 
    isConnected, 
    forceRefresh,
    data: countryData 
  } = useDataSync(countryId, {
    enabled: isVisible && isMonitoring,
    pollInterval: 15000, // Fast updates for monitoring
    notificationsEnabled: false, // We'll handle notifications here
    onDataChange: handleDataChange,
    onStatusChange: handleStatusChange,
  });

  // Handle data changes and update trends
  function handleDataChange(newData: any, changes: string[]) {
    if (changes.length === 0) return;

    const timestamp = Date.now();
    const newTrends: MetricTrend[] = [];

    // Process each change into a trend
    changes.forEach(change => {
      let current = 0, previous = 0, metric = '';

      switch (change) {
        case 'population':
          current = newData.currentPopulation || 0;
          previous = current; // TODO: Get previous value from cache
          metric = 'Population';
          break;
        case 'gdpPerCapita':
          current = newData.currentGdpPerCapita || 0;
          previous = current;
          metric = 'GDP per Capita';
          break;
        case 'totalGdp':
          current = newData.currentTotalGdp || 0;
          previous = current;
          metric = 'Total GDP';
          break;
        case 'economicVitality':
          current = newData.economicVitality || 0;
          previous = current;
          metric = 'Economic Vitality';
          break;
      }

      if (metric) {
        const changeValue = current - previous;
        const changePercent = previous > 0 ? (changeValue / previous) * 100 : 0;
        
        newTrends.push({
          metric,
          current,
          previous,
          change: changeValue,
          changePercent,
          trend: changeValue > 0 ? 'up' : changeValue < 0 ? 'down' : 'stable',
          timestamp,
        });
      }
    });

    if (newTrends.length > 0) {
      setMetricTrends(prev => [...newTrends, ...prev].slice(0, 20)); // Keep last 20 trends
      
      // Generate monitoring notification
      addNotification({
        type: 'info',
        category: 'system',
        title: 'Data Monitor Alert',
        message: `${newTrends.length} metrics updated for ${newData.name}`,
        source: 'Data Monitor',
        actionable: false,
        priority: 'low',
        autoRemove: true,
        removeAfter: 15000,
      });
    }
  }

  // Handle sync status changes
  function handleStatusChange(status: string) {
    console.log(`[DataMonitoringCenter] Sync status changed: ${status}`);
    
    if (status === 'error') {
      addNotification({
        type: 'warning',
        category: 'system',
        title: 'Monitoring Alert',
        message: 'Data sync encountered an error - monitoring may be affected',
        source: 'Data Monitor',
        actionable: true,
        priority: 'medium',
        autoRemove: false,
        actions: [{
          id: 'retry',
          label: 'Retry Connection',
          type: 'primary' as const,
          onClick: () => forceRefresh(),
        }]
      });
    }
  }

  // Update system metrics
  const updateSystemMetrics = useCallback(() => {
    const dbStatus = dbService.getConnectionStatus();
    const currentTime = Date.now();
    
    setSystemMetrics(prev => ({
      activeConnections: dbStatus.isConnected ? 1 : 0,
      dataStreams: dbStatus.activeStreams,
      lastUpdate: Math.max(dbStatus.lastUpdate, syncState?.lastUpdate || 0),
      updateFrequency: currentTime - (prev.lastUpdate || currentTime),
      errors: syncState?.errors.length || 0,
      uptime: currentTime - (streamIdRef.current ? 0 : currentTime),
    }));
  }, [dbService, syncState]);

  // Auto-refresh system metrics
  useEffect(() => {
    if (autoRefresh && isVisible) {
      updateIntervalRef.current = setInterval(updateSystemMetrics, 5000);
    } else if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [autoRefresh, isVisible, updateSystemMetrics]);

  // Create database stream when component mounts
  useEffect(() => {
    if (isVisible && countryId && !streamIdRef.current) {
      const streamId = dbService.createStream(countryId, ['*']);
      streamIdRef.current = streamId;

      // Add listener for database events
      dbService.addListener(streamId, (event: any) => {
        console.log('[DataMonitoringCenter] Database event:', event);
        
        if (event.type === 'system_event') {
          addNotification({
            type: event.severity === 'error' ? 'critical' : 'info',
            category: 'system',
            title: `System Event: ${event.eventType}`,
            message: event.message,
            source: 'Database Monitor',
            actionable: event.severity === 'error',
            priority: event.severity === 'error' ? 'high' : 'low',
            autoRemove: event.severity !== 'error',
            removeAfter: 20000,
          });
        }
      });

      return () => {
        if (streamIdRef.current) {
          dbService.closeStream(streamIdRef.current);
          streamIdRef.current = null;
        }
      };
    }
  }, [isVisible, countryId, dbService, addNotification]);

  // Render trend indicator
  const renderTrendIndicator = (trend: MetricTrend) => {
    const Icon = trend.trend === 'up' ? TrendingUp : trend.trend === 'down' ? TrendingDown : Activity;
    const colorClass = trend.trend === 'up' ? 'text-green-500' : trend.trend === 'down' ? 'text-red-500' : 'text-blue-500';
    
    return (
      <motion.div
        key={`${trend.metric}-${trend.timestamp}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border"
      >
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{trend.metric}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(trend.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-bold">
              {trend.metric.includes('GDP') ? 
                `$${(trend.current / 1000).toFixed(1)}k` : 
                trend.current.toLocaleString()}
            </span>
            <span className={`text-sm ${colorClass}`}>
              {trend.change > 0 ? '+' : ''}{trend.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`fixed inset-4 z-50 flex items-center justify-center ${className}`}
    >
      <div className="w-full max-w-4xl h-full max-h-[90vh] bg-background/95 backdrop-blur-lg border rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-card/50">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold">Data Monitoring Center</h2>
              <p className="text-sm text-muted-foreground">
                Real-time data synchronization for {countryData?.name || 'Country'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={forceRefresh}
              disabled={syncState?.status === 'syncing'}
            >
              <RefreshCw className={`h-4 w-4 ${syncState?.status === 'syncing' ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Connection</span>
                      <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Streams</span>
                      <span className="font-mono">{systemMetrics.dataStreams}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Errors</span>
                      <span className={`font-mono ${systemMetrics.errors > 0 ? 'text-red-500' : ''}`}>
                        {systemMetrics.errors}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Update</span>
                      <span className="text-xs">
                        {systemMetrics.lastUpdate ? 
                          new Date(systemMetrics.lastUpdate).toLocaleTimeString() : 
                          'Never'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">IxTime</span>
                      <span className="text-xs text-amber-500">
                        {IxTime.formatIxTime(IxTime.getCurrentIxTime()).split(',')[1]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Multiplier</span>
                      <span className="text-xs">×{IxTime.getTimeMultiplier()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recent Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  <AnimatePresence>
                    {metricTrends.length > 0 ? (
                      metricTrends.slice(0, 5).map((trend, index) => (
                        <div key={`trend-${trend.name}-${index}`}>
                          {renderTrendIndicator(trend, index)}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent data changes detected</p>
                        <p className="text-xs">Monitoring active...</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>

            {/* Current Data Overview */}
            {countryData && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Current Data Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">
                        {(countryData.currentPopulation / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-xs text-muted-foreground">Population</div>
                    </div>
                    
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold">
                        ${(countryData.currentGdpPerCapita / 1000).toFixed(0)}k
                      </div>
                      <div className="text-xs text-muted-foreground">GDP per Capita</div>
                    </div>
                    
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold">
                        {countryData.economicVitality?.toFixed(0) || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">Economic Vitality</div>
                    </div>
                    
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <Zap className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                      <div className="text-2xl font-bold">{countryData.economicTier}</div>
                      <div className="text-xs text-muted-foreground">Economic Tier</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default DataMonitoringCenter;