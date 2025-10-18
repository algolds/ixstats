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
  // Wifi, // Wifi and WifiOff are not used
  // WifiOff,
  TrendingUp,
  // TrendingDown, // Not used
  RefreshCw,
  Zap,
  Bot,
  AlertTriangle,
  Info,
  ArrowLeftRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { AdminPageBotStatusView } from "~/types/ixstats"; // Import the main type

// Interface for simulated metrics
interface BotMetrics {
  timestamp: string;
  responseTime: number;
  isAvailable: boolean;
  errorCount: number;
}

// Interface for sync event details
interface SyncEventDetails {
  /** Operation duration in milliseconds */
  duration?: number;

  /** Number of records synced */
  recordsAffected?: number;

  /** IxTime before sync */
  previousIxTime?: string;

  /** IxTime after sync */
  newIxTime?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// Interface for sync events log
interface SyncEvent {
  timestamp: string;
  eventType: string;
  source: string;
  success: boolean;
  errorMessage?: string;
  details?: SyncEventDetails;
}

export function BotMonitoringDashboard() {
  const [metrics, setMetrics] = useState<BotMetrics[]>([]);
  const [recentEvents, setRecentEvents] = useState<SyncEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    data: botStatusData, // Renamed to avoid confusion with the nested botStatus property
    refetch: refetchBotStatus,
    isLoading: isLoadingBotStatus,
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 5000, // Check every 5 seconds
  });

  const syncWithBotMutation = api.admin.syncWithBot.useMutation({
    onSuccess: (data) => {
      void refetchBotStatus(); // Ensure promise is handled
      const event: SyncEvent = {
        timestamp: new Date().toISOString(),
        eventType: "Manual Sync",
        source: "Admin Dashboard",
        success: data.success,
        errorMessage: data.success ? undefined : data.message,
      };
      setRecentEvents((prev) => [event, ...prev.slice(0, 9)]);
    },
    onError: (error) => {
      const event: SyncEvent = {
        timestamp: new Date().toISOString(),
        eventType: "Manual Sync",
        source: "Admin Dashboard",
        success: false,
        errorMessage: error.message,
      };
      setRecentEvents((prev) => [event, ...prev.slice(0, 9)]);
    },
  });

  // Effect for collecting simulated metrics
  useEffect(() => {
    const collectMetrics = () => {
      // Check if botStatusData is loaded and not the error fallback
      if (botStatusData && !("error" in botStatusData)) {
        const newMetric: BotMetrics = {
          timestamp: new Date().toISOString(),
          responseTime: Math.random() * 100 + 10, // Simulated response time
          isAvailable: botStatusData.botHealth.available,
          errorCount: 0, // Placeholder for actual error count if available
        };

        setMetrics((prev) => {
          const updated = [...prev, newMetric].slice(-20); // Keep last 20 metrics
          return updated;
        });
      } else if (botStatusData && "error" in botStatusData) {
        // Handle metrics when botStatusData is the error fallback
         const newMetric: BotMetrics = {
          timestamp: new Date().toISOString(),
          responseTime: 0, 
          isAvailable: botStatusData.botHealth.available, // botHealth is on the error type
          errorCount: 1, // Indicate an error state
        };
        setMetrics((prev) => {
          const updated = [...prev, newMetric].slice(-20);
          return updated;
        });
      }
    };

    collectMetrics(); // Initial collection
    const interval = setInterval(collectMetrics, 5000); // Collect every 5 seconds
    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [botStatusData]); // Rerun effect if botStatusData changes

  // Helper to get status color
  const getStatusColor = (available: boolean) => {
    return available
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  };

  // Helper to get status icon
  const getStatusIcon = (available: boolean) => {
    return available ? (
      <CheckCircle className="h-5 w-5" />
    ) : (
      <AlertCircle className="h-5 w-5" />
    );
  };

  // Helper to format uptime from milliseconds
  const formatUptime = (uptimeMs: number | null | undefined) => {
    if (uptimeMs === null || uptimeMs === undefined) return "Unknown";
    if (uptimeMs === 0) return "0m"; // Handle case where uptime is exactly 0
    const totalSeconds = Math.floor(uptimeMs / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Handler for force sync button
  const handleSyncWithBot = () => {
    syncWithBotMutation.mutate();
  };

  // Loading state
  if (isLoadingBotStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500 dark:text-gray-400">
            Loading bot status...
          </span>
        </div>
      </div>
    );
  }

  // Handle case where data is not yet available (should be covered by isLoading, but as a fallback)
  if (!botStatusData) {
     return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center py-8">
          <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
          <span className="text-gray-500 dark:text-gray-400">
            Bot status not available.
          </span>
        </div>
      </div>
    );
  }

  // Handle the error fallback structure from the tRPC route
  // This is a type guard to ensure botStatusData is the error structure.
  if ("error" in botStatusData && botStatusData.error) {
    const errorState = botStatusData; // errorState is now known to be the error structure
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Error Loading Bot Status
            </h3>
             <button
              onClick={() => void refetchBotStatus()}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">Details: {String(errorState.error || 'Unknown error')}</p>
        {errorState.botHealth && (
          <div className={`flex items-center space-x-3 p-3 rounded-md ${errorState.botHealth.available ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className={getStatusColor(errorState.botHealth.available)}>
              {getStatusIcon(errorState.botHealth.available)}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bot Health</p>
              <p className={`font-medium ${getStatusColor(errorState.botHealth.available)}`}>
                {errorState.botHealth.message}
              </p>
            </div>
          </div>
        )}
         <p className="text-xs text-gray-500 dark:text-gray-400">
            Current IxTime (fallback): {errorState.formattedIxTime}
        </p>
         <p className="text-xs text-gray-500 dark:text-gray-400">
            Multiplier (fallback): {errorState.multiplier}x
        </p>
      </div>
    );
  }
  
  // Type assertion to ensure botStatusData matches AdminPageBotStatusView
  const botStatus = botStatusData;

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
              aria-label="Refresh bot status"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className={getStatusColor(botStatus.botHealth.available)}>
              {getStatusIcon(botStatus.botHealth.available)}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connection</p>
              <p
                className={`font-medium ${getStatusColor(
                  botStatus.botHealth.available
                )}`}
              >
                {botStatus.botHealth.available ? "Online" : `Offline: ${botStatus.botHealth.message}`}
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
                {/* Corrected: Access uptime from botStatus.botStatus.uptime */}
                {formatUptime(botStatus.botStatus?.uptime)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Multiplier</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {/* Access multiplier directly from botStatus (IxTimeState) */}
                {botStatus.multiplier ? `${botStatus.multiplier}x` : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2 items-center">
          <button
            onClick={handleSyncWithBot}
            disabled={!botStatus.botHealth.available || syncWithBotMutation.isPending}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ArrowLeftRight
              className={`h-3 w-3 mr-1 ${
                syncWithBotMutation.isPending ? "animate-spin" : ""
              }`}
            />
            {syncWithBotMutation.isPending ? "Syncing..." : "Force Sync"}
          </button>

          {/* Access hasTimeOverride directly from botStatus (IxTimeState) */}
          {botStatus.hasTimeOverride && (
            <div className="flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Time Override Active
            </div>
          )}
          
          {/* Access isPaused directly from botStatus (IxTimeState) */}
          {botStatus.isPaused && (
            <div className="flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md text-sm">
              <AlertCircle className="h-3 w-3 mr-1" />
              Time Paused
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
              Performance Metrics (Simulated)
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" opacity={0.3} /> {/* Updated stroke color for better dark mode visibility */}
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10, fill: '#A0AEC0' }} // Adjusted tick color
                        tickFormatter={(value) =>
                          new Date(value).toLocaleTimeString()
                        }
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#A0AEC0' }} /> {/* Adjusted tick color */}
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(26, 32, 44, 0.8)', borderColor: '#4A5568', borderRadius: '0.375rem' }} // Darker tooltip
                        labelStyle={{ color: '#E2E8F0' }} // Light label
                        itemStyle={{ color: '#E2E8F0' }} // Light item text
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value: number) => [`${value.toFixed(1)}ms`, "Response Time"]}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" opacity={0.3} />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10, fill: '#A0AEC0' }}
                        tickFormatter={(value) =>
                          new Date(value).toLocaleTimeString()
                        }
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#A0AEC0' }} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(value) => value === 1 ? 'Online' : 'Offline'} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(26, 32, 44, 0.8)', borderColor: '#4A5568', borderRadius: '0.375rem' }}
                        labelStyle={{ color: '#E2E8F0' }}
                        itemStyle={{ color: '#E2E8F0' }}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value: number) => [value === 1 ? "Online" : "Offline", "Status"]}
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
              {/* Corrected: Access username from botStatus.botStatus.botUser */}
              {botStatus.botStatus?.botUser && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bot User</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {botStatus.botStatus.botUser.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {botStatus.botStatus.botUser.id}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Sync</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {/* Access lastSyncTime directly from botStatus (IxTimeState) */}
                  {botStatus.lastSyncTime
                    ? new Date(botStatus.lastSyncTime).toLocaleString()
                    : "Never"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Source</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {/* Access botAvailable directly from botStatus (IxTimeState) */}
                  {botStatus.botAvailable ? "Bot (Authoritative)" : "Local Fallback"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current IxTime</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {/* Access formattedIxTime directly from botStatus (IxTimeState) */}
                  {botStatus.formattedIxTime || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Override</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {/* Access hasTimeOverride directly from botStatus (IxTimeState) */}
                  {botStatus.hasTimeOverride ? "Active" : "None"}
                </p>
                {/* Access timeOverrideValue directly from botStatus (IxTimeState) */}
                {botStatus.timeOverrideValue && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(botStatus.timeOverrideValue).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Multiplier Override</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {/* Access hasMultiplierOverride directly from botStatus (IxTimeState) */}
                  {botStatus.hasMultiplierOverride
                    ? `${botStatus.multiplierOverrideValue}x` // Access multiplierOverrideValue
                    : "None"}
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
              <div className="space-y-2 max-h-96 overflow-y-auto"> {/* Added scroll for long lists */}
                {recentEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={event.success ? "text-green-500" : "text-red-500"}>
                        {event.success ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
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
