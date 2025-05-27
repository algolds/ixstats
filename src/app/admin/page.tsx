// src/app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import {
  Clock,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Save,
  AlertTriangle,
  Zap,
  Globe,
  TrendingUp,
  Server,
  Users,
  RefreshCw,
  Wifi,
  WifiOff,
  Sync,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

// Import SystemConfig from types
import type { SystemConfig } from "~/types/ixstats";

interface CalculationLog {
  id: string;
  timestamp: Date;
  ixTimeTimestamp: Date;
  countriesUpdated: number;
  executionTimeMs: number;
  globalGrowthFactor: number;
}

export default function AdminDashboard() {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [timeMultiplier, setTimeMultiplier] = useState(4);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [globalGrowthFactor, setGlobalGrowthFactor] = useState(1.0321);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [botSyncEnabled, setBotSyncEnabled] = useState(true);

  // Get system configuration
  const { data: systemConfig, refetch: refetchConfig, isLoading: configLoading } = api.admin.getSystemConfig.useQuery();
  const { data: calculationLogs, refetch: refetchLogs, isLoading: logsLoading } = api.admin.getCalculationLogs.useQuery();
  const { data: systemStatus, refetch: refetchStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: botStatus, refetch: refetchBotStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 10000, // Check bot status every 10 seconds
  });

  // Mutations
  const updateConfigMutation = api.admin.updateSystemConfig.useMutation({
    onSuccess: () => {
      void refetchConfig();
      setLastUpdate(new Date());
    },
  });

  const forceCalculationMutation = api.admin.forceCalculation.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchLogs();
      alert(`Calculation complete: ${data?.updated} countries updated in ${data?.executionTime}ms using ${data.message.includes('bot') ? 'bot' : 'local'} time.`);
    },
    onError: (error) => {
        alert(`Calculation error: ${error.message}`);
    }
  });

  const setBotTimeMutation = api.admin.setBotTimeOverride.useMutation({
    onSuccess: () => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const syncWithBotMutation = api.admin.syncWithBot.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      void refetchStatus();
      void refetchBotStatus();
      alert(data.success ? 'Successfully synced with Discord bot!' : `Sync failed: ${data.message}`);
    },
    onError: (error) => {
      alert(`Sync error: ${error.message}`);
    }
  });

  const pauseBotMutation = api.admin.pauseBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const resumeBotMutation = api.admin.resumeBotTime.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation({
    onSuccess: () => {
      void refetchStatus();
      void refetchBotStatus();
    },
  });

  // Update IxTime display from systemStatus if available, otherwise local IxTime
  useEffect(() => {
    const updateTimeDisplay = () => {
      if (systemStatus?.ixTime?.formattedIxTime) {
        setCurrentIxTime(systemStatus.ixTime.formattedIxTime);
      } else {
        setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true));
      }
    };

    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 1000);
    return () => clearInterval(interval);
  }, [systemStatus]);

  // Load system config into state with proper type handling
  useEffect(() => {
    if (systemConfig) {
      const multiplier = systemConfig.find((c) => c.key === 'time_multiplier');
      const growth = systemConfig.find((c) => c.key === 'global_growth_factor');
      const autoUpd = systemConfig.find((c) => c.key === 'auto_update');
      const botSync = systemConfig.find((c) => c.key === 'bot_sync_enabled');

      if (multiplier) setTimeMultiplier(parseFloat(multiplier.value));
      if (growth) setGlobalGrowthFactor(parseFloat(growth.value));
      if (autoUpd) setAutoUpdate(autoUpd.value === 'true');
      if (botSync) setBotSyncEnabled(botSync.value === 'true');
    }
  }, [systemConfig]);

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({
      configs: [
        { key: 'time_multiplier', value: timeMultiplier.toString() },
        { key: 'global_growth_factor', value: globalGrowthFactor.toString() },
        { key: 'auto_update', value: autoUpdate.toString() },
        { key: 'bot_sync_enabled', value: botSyncEnabled.toString() },
      ]
    });
  };

  const handleSetCustomTime = () => {
    if (customDate && customTime) {
      const [year, month, day] = customDate.split('-').map(Number);
      const [hour, minute] = customTime.split(':').map(Number);
      
      const desiredIxTimeEpoch = IxTime.createIxTime(year!, month!, day!, hour, minute);

      if (botSyncEnabled && botStatus?.botHealth?.available) {
        setBotTimeMutation.mutate({
          ixTime: desiredIxTimeEpoch,
        });
      } else {
        // Fallback to legacy method
        const setIxTimeMutation = api.admin.setCurrentIxTime.useMutation({
          onSuccess: () => {
            void refetchConfig();
            void refetchStatus();
          }
        });
        setIxTimeMutation.mutate({
          ixTime: desiredIxTimeEpoch,
        });
      }
    }
  };

  const handleForceCalculation = () => {
    forceCalculationMutation.mutate();
  };

  const handleSyncWithBot = () => {
    syncWithBotMutation.mutate();
  };

  const handlePauseBot = () => {
    pauseBotMutation.mutate();
  };

  const handleResumeBot = () => {
    resumeBotMutation.mutate();
  };

  const handleClearBotOverrides = () => {
    clearBotOverridesMutation.mutate();
  };

  const handleResetToRealTime = () => {
    if (botSyncEnabled && botStatus?.botHealth?.available) {
      clearBotOverridesMutation.mutate();
    } else {
      setTimeMultiplier(4);
      setGlobalGrowthFactor(1.0321);
      setAutoUpdate(true);
      const resetMutation = api.admin.resetIxTime.useMutation({
        onSuccess: () => {
          void refetchConfig();
          void refetchStatus();
        }
      });
      resetMutation.mutate();
    }
  };

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier === 0) return "text-red-600 dark:text-red-400";
    if (multiplier < 2) return "text-yellow-600 dark:text-yellow-400";
    if (multiplier === 4) return "text-green-600 dark:text-green-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const getBotStatusColor = (available: boolean, ready?: boolean) => {
    if (!available) return "text-red-600 dark:text-red-400";
    if (ready === false) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getBotStatusIcon = (available: boolean, ready?: boolean) => {
    if (!available) return <WifiOff className="h-5 w-5" />;
    if (ready === false) return <AlertCircle className="h-5 w-5" />;
    return <Wifi className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            IxStats Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Control IxTime flow, global economic factors, and system operations
          </p>
        </div>

        {/* Bot Status Banner */}
        {botStatus && (
          <div className={`mb-6 p-4 rounded-lg border ${
            botStatus.botHealth.available 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bot className={`h-6 w-6 mr-3 ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`} />
                <div>
                  <h3 className={`font-medium ${getBotStatusColor(botStatus.botHealth.available, botStatus.botStatus?.botReady)}`}>
                    Discord Bot Status: {botStatus.botHealth.available ? 'Connected' : 'Disconnected'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {botStatus.botHealth.message}
                    {botStatus.botStatus?.botUser && ` • ${botStatus.botStatus.botUser.tag}`}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSyncWithBot}
                  disabled={syncWithBotMutation.isPending}
                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-100 rounded-md text-sm flex items-center"
                >
                  <Sync className={`h-4 w-4 mr-1 ${syncWithBotMutation.isPending ? 'animate-spin' : ''}`} />
                  Sync
                </button>
                <button
                  onClick={() => void refetchBotStatus()}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center">
              <Clock className={`h-8 w-8 ${getMultiplierColor(systemStatus?.ixTime?.multiplier ?? timeMultiplier)}`} />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current IxTime</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {statusLoading ? "Loading..." : currentIxTime}
                </p>
                {botStatus?.botAvailable && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Synced with bot
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center">
              <Zap className={`h-8 w-8 ${getMultiplierColor(systemStatus?.ixTime?.multiplier ?? timeMultiplier)}`} />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Multiplier</p>
                <p className={`text-lg font-semibold ${getMultiplierColor(systemStatus?.ixTime?.multiplier ?? timeMultiplier)}`}>
                  {statusLoading ? "Loading..." : (systemStatus?.ixTime?.isPaused ? "PAUSED" : `${systemStatus?.ixTime?.multiplier ?? timeMultiplier}x Speed`)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {botStatus?.botAvailable ? "Bot controlled" : "Local fallback"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Global Growth</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {configLoading ? "Loading..." : ((globalGrowthFactor - 1) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
                <Server className="h-8 w-8 text-cyan-500" />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Calculation</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {statusLoading || !systemStatus?.lastCalculation ? "N/A" : new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                         {statusLoading || !systemStatus?.lastCalculation ? "" : `${systemStatus.lastCalculation.countriesUpdated} countries`}
                    </p>
                </div>
            </div>
           </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                    <Users className="h-8 w-8 text-purple-500" />
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Countries</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {statusLoading || systemStatus?.countryCount === undefined ? "N/A" : systemStatus.countryCount}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                    {getBotStatusIcon(botStatus?.botHealth?.available ?? false, botStatus?.botStatus?.botReady)}
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bot Sync Status</p>
                        <p className={`text-lg font-semibold ${getBotStatusColor(botStatus?.botHealth?.available ?? false, botStatus?.botStatus?.botReady)}`}>
                            {botStatus?.botHealth?.available ? 'Online' : 'Offline'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {botStatus?.lastSyncTime ? `Last sync: ${new Date(botStatus.lastSyncTime).toLocaleTimeString()}` : 'Never synced'}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Bot Control Panel */}
        {botStatus && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              Discord Bot Time Control
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <button
                onClick={handlePauseBot}
                disabled={pauseBotMutation.isPending || !botStatus.botHealth.available}
                className="flex items-center justify-center px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600 text-red-700 dark:text-red-100 rounded-md disabled:opacity-50"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause Bot Time
              </button>

              <button
                onClick={handleResumeBot}
                disabled={resumeBotMutation.isPending || !botStatus.botHealth.available}
                className="flex items-center justify-center px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 text-green-700 dark:text-green-100 rounded-md disabled:opacity-50"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Bot Time
              </button>

              <button
                onClick={handleClearBotOverrides}
                disabled={clearBotOverridesMutation.isPending || !botStatus.botHealth.available}
                className="flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear Bot Overrides
              </button>
            </div>

            {botStatus.botStatus?.hasTimeOverride && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Bot has active time override. Click "Clear Bot Overrides" to return to normal time flow.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Time Control Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            IxTime Control Panel
            {!botSyncEnabled && (
              <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                Local Mode
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Multiplier */}
            <div>
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                Time Flow Control
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Multiplier: {timeMultiplier}x
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={timeMultiplier}
                    onChange={(e) => setTimeMultiplier(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 dark:accent-indigo-400"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Paused</span>
                    <span>2x</span>
                    <span>4x (Normal)</span>
                    <span>10x</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setTimeMultiplier(0)}
                    className="flex items-center px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600 text-red-700 dark:text-red-100 rounded-md text-sm"
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </button>
                  <button
                    onClick={() => setTimeMultiplier(4)}
                    className="flex items-center px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 text-green-700 dark:text-green-100 rounded-md text-sm"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Normal (4x)
                  </button>
                  <button
                    onClick={handleResetToRealTime}
                    className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset Time
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Time Setting */}
            <div>
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                Set Custom IxTime
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSetCustomTime}
                  disabled={!customDate || !customTime || setBotTimeMutation.isPending}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                >
                  {setBotTimeMutation.isPending ? "Setting..." : "Set IxTime"}
                </button>
                {customDate && customTime && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Will set to: {IxTime.formatIxTime(
                      IxTime.createIxTime(
                        parseInt(customDate.split('-')[0]!),
                        parseInt(customDate.split('-')[1]!),
                        parseInt(customDate.split('-')[2]!),
                        parseInt(customTime.split(':')[0]!),
                        parseInt(customTime.split(':')[1]!)
                      ),
                      true
                    )}
                    {botSyncEnabled && botStatus?.botHealth?.available && (
                      <span className="ml-2 text-green-600 dark:text-green-400">(via bot)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Economic Control Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Global Economic Controls
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Global Growth Factor: {globalGrowthFactor.toFixed(4)} ({((globalGrowthFactor - 1) * 100).toFixed(2)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.001"
                value={globalGrowthFactor}
                onChange={(e) => setGlobalGrowthFactor(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 dark:accent-indigo-400"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>-50% (Recession)</span>
                <span>0% (Stagnant)</span>
                <span>+3.21% (Normal)</span>
                <span>+100% (Boom)</span>
              </div>
            </div>

            <div>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoUpdate"
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="autoUpdate" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Enable automatic calculations
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="botSync"
                    checked={botSyncEnabled}
                    onChange={(e) => setBotSyncEnabled(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="botSync" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Enable Discord bot time sync
                  </label>
                </div>

                <button
                  onClick={handleForceCalculation}
                  disabled={forceCalculationMutation.isPending}
                  className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 disabled:opacity-50 text-white rounded-md text-sm font-medium flex items-center justify-center"
                >
                  {forceCalculationMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  {forceCalculationMutation.isPending ? "Calculating..." : "Force Recalculation"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save Configuration</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Apply your changes to the system.
                {lastUpdate && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                    (Last saved: {lastUpdate.toLocaleTimeString()})
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={updateConfigMutation.isPending}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md font-medium flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Recent Calculation Logs */}
        {logsLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading calculation logs...</p>}
        {calculationLogs && calculationLogs.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Calculation Logs
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-850">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IxTime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Countries Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Execution Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Growth Factor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {calculationLogs.slice(0, 10).map((log: CalculationLog) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {IxTime.formatIxTime(log.ixTimeTimestamp.getTime())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {log.countriesUpdated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {log.executionTimeMs}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {log.globalGrowthFactor.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Warning Panel */}
        {systemStatus?.ixTime?.isPaused && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg p-4 mt-6">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  IxTime is currently paused
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Economic calculations and time progression have been suspended. Countries will not update automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}