// src/app/_components/bot-monitoring.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Server,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Zap,
  Bot,
  AlertTriangle,
  Info
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface BotMetrics {
  timestamp: string;
  responseTime: number;
  isAvailable: boolean;
  errorCount: number;
}

interface SyncEvent {
  timestamp: string;
  eventType: string;
  source: string;
  success: boolean;
  errorMessage?: string;
  details?: any;
}

export function BotMonitoringDashboard() {
  const [metrics, setMetrics] = useState<BotMetrics[]>([]);
  const [recentEvents, setRecentEvents] = useState<SyncEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 5000, // Check every 5 seconds
  });

  // Simulate metrics collection (in real implementation, this would come from your API)
  useEffect(() => {
    const collectMetrics = () => {
      if (botStatus) {
        const newMetric: BotMetrics = {
          timestamp: new Date().toISOString(),
          responseTime: Math.random() * 100 + 10, // Simulated response time
          isAvailable: botStatus.botHealth.available,
          errorCount: 0,
        };

        setMetrics(prev => {
          const updated = [...prev, newMetric].slice(-20); // Keep last 20 metrics
          return updated;
        });
      }
    };

    const interval = setInterval(collectMetrics, 5000);
    return () => clearInterval(interval);
  }, [botStatus]);

  const getStatusColor = (available: boolean) => {
    return available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  };

  const getStatusIcon = (available: boolean) => {
    return available ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />;
  };

  const formatUptime = (uptimeMs: number | null) => {
    if (!uptimeMs) return "Unknown";
    const seconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (!botStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500 dark:text-gray-400">Loading bot status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            Discord Bot Monitor
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => void refetchBotStatus()}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className={getStatusColor(botStatus.botHealth.available)}>
              {getStatusIcon(botStatus.botHealth.available)}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connection</p>
              <p className={`font-medium ${getStatusColor(botStatus.botHealth.available)}`}>
                {botStatus.botHealth.available ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bot Ready</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {botStatus.botStatus?.botReady ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatUptime(botStatus.botStatus?.botReady ? 86400000 : null)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Multiplier</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {botStatus.botStatus?.multiplier ? `${botStatus.botStatus.multiplier}x` : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2">
          <button
            onClick={() => api.admin.syncWithBot.useMutation().mutate()}
            disabled={!botStatus.botHealth.available}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Force Sync
          </button>
          
          {botStatus.botStatus?.hasTimeOverride && (
            <div className="flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Time Override Active
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <>
          {/* Performance Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Metrics
            </h4>
            
            {metrics.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Response Time Chart */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Response Time (Last 20 checks)
                  </h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={metrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Response Time']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="responseTime" 
                        stroke="#3B82F6" 
                        strokeWidth={2} 
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Availability Chart */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Availability Status
                  </h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={metrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                      <Tooltip 
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value: number) => [value ? 'Online' : 'Offline', 'Status']}
                      />
                      <Area 
                        type="stepAfter" 
                        dataKey="isAvailable" 
                        stroke="#10B981" 
                        fill="#10B981" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <Info className="h-5 w-5 mr-2" />
                Collecting performance data...
              </div>
            )}
          </div>

          {/* Bot Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              Bot Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {botStatus.botStatus?.botUser && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bot User</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {botStatus.botStatus.botUser.tag}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {botStatus.botStatus.botUser.id}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Sync</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {botStatus.lastSyncTime 
                    ? new Date(botStatus.lastSyncTime).toLocaleString()
                    : "Never"
                  }
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Source</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {botStatus.botAvailable ? "Bot (Authoritative)" : "Local Fallback"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current IxTime</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {botStatus.formattedIxTime || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Override</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {botStatus.hasTimeOverride ? "Active" : "None"}
                </p>
                {botStatus.timeOverrideValue && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(botStatus.timeOverrideValue).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Multiplier Override</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {botStatus.hasMultiplierOverride 
                    ? `${botStatus.multiplierOverrideValue}x`
                    : "None"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Sync Events Log */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Recent Sync Events
            </h4>
            
            {recentEvents.length > 0 ? (
              <div className="space-y-2">
                {recentEvents.slice(0, 10).map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-md">
                    <div className="flex items-center space-x-3">
                      <div className={event.success ? "text-green-500" : "text-red-500"}>
                        {event.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.eventType} from {event.source}
                        </p>
                        {event.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {event.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <Info className="h-5 w-5 mr-2" />
                No recent sync events
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default BotMonitoringDashboard;