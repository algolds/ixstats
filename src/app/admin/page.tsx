// src/app/admin/page.tsx
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
} from "lucide-react";

interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}

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

  // Get system configuration
  const { data: systemConfig, refetch: refetchConfig, isLoading: configLoading } = api.admin.getSystemConfig.useQuery();
  const { data: calculationLogs, refetch: refetchLogs, isLoading: logsLoading } = api.admin.getCalculationLogs.useQuery();
  const { data: systemStatus, refetch: refetchStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 5000, // Refetch status every 5 seconds
  });


  // Mutations
  const updateConfigMutation = api.admin.updateSystemConfig.useMutation({
    onSuccess: () => {
      refetchConfig();
      setLastUpdate(new Date());
    },
  });

  const forceCalculationMutation = api.admin.forceCalculation.useMutation({
    onSuccess: (data) => {
      setLastUpdate(new Date());
      refetchLogs();
      alert(`Calculation complete: ${data?.updated} countries updated in ${data?.executionTime}ms.`);
    },
    onError: (error) => {
        alert(`Calculation error: ${error.message}`);
    }
  });

  const setIxTimeMutation = api.admin.setCurrentIxTime.useMutation({
    onSuccess: () => {
      setLastUpdate(new Date());
      refetchStatus(); // Refetch status to show new time override
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

    updateTimeDisplay(); // Initial
    const interval = setInterval(updateTimeDisplay, 1000); // Keep local clock ticking for display
    return () => clearInterval(interval);
  }, [systemStatus]);


  // Load system config into state
  useEffect(() => {
    if (systemConfig) {
      const multiplier = systemConfig.find((c: SystemConfig) => c.key === 'time_multiplier');
      const growth = systemConfig.find((c: SystemConfig) => c.key === 'global_growth_factor');
      const autoUpd = systemConfig.find((c: SystemConfig) => c.key === 'auto_update');

      if (multiplier) setTimeMultiplier(parseFloat(multiplier.value));
      if (growth) setGlobalGrowthFactor(parseFloat(growth.value));
      if (autoUpd) setAutoUpdate(autoUpd.value === 'true');
    }
  }, [systemConfig]);

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({
      configs: [
        { key: 'time_multiplier', value: timeMultiplier.toString() },
        { key: 'global_growth_factor', value: globalGrowthFactor.toString() },
        { key: 'auto_update', value: autoUpdate.toString() },
      ]
    });
  };

  const handleSetCustomTime = () => {
    if (customDate && customTime) {
      const [year, month, day] = customDate.split('-').map(Number);
      const [hour, minute] = customTime.split(':').map(Number);
      
      // Create a real-world Date object from the custom inputs (UTC to be safe)
      const realWorldDateForOverride = new Date(Date.UTC(year!, month! -1, day!, hour, minute));
      // Then this real-world date needs to be used to *set* the IxTime epoch effectively,
      // or the IxTime.setOverride should take this Date object and calculate the IxTime value itself.
      // For simplicity, if setIxTime expects an IxTime timestamp, we might need a conversion step.
      // Assuming setIxTime takes a real-world timestamp to set the IxTime *as if* it were that real time:
      // This is tricky. Let's assume `setIxTimeMutation` takes the *desired IxTime epoch value*
      const desiredIxTimeEpoch = IxTime.createIxTime(year!, month!, day!, hour, minute);

      setIxTimeMutation.mutate({
        ixTime: desiredIxTimeEpoch,
      });
    }
  };

  const handleForceCalculation = () => {
    forceCalculationMutation.mutate({});
  };

  const handleResetToRealTime = () => {
    setTimeMultiplier(4); // Default multiplier
    setGlobalGrowthFactor(1.0321); // Default growth
    setAutoUpdate(true);
    api.admin.resetIxTime.useMutation().mutate(); // Call reset endpoint
    refetchConfig(); // To get potentially reset values from DB
    refetchStatus();
  };

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier === 0) return "text-red-600 dark:text-red-400";
    if (multiplier < 2) return "text-yellow-600 dark:text-yellow-400";
    if (multiplier === 4) return "text-green-600 dark:text-green-400";
    return "text-blue-600 dark:text-blue-400";
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
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active DM Inputs</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {statusLoading || systemStatus?.activeDmInputs === undefined ? "N/A" : systemStatus.activeDmInputs}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Time Control Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            IxTime Control Panel
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
                  disabled={!customDate || !customTime || setIxTimeMutation.isPending}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                >
                  {setIxTimeMutation.isPending ? "Setting..." : "Set IxTime"}
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
              <div className="flex items-center mb-4">
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
              <button
                onClick={handleForceCalculation}
                disabled={forceCalculationMutation.isPending}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 disabled:opacity-50 text-white rounded-md text-sm font-medium flex items-center justify-center"
              >
                 {forceCalculationMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" /> }
                {forceCalculationMutation.isPending ? "Calculating..." : "Force Recalculation"}
              </button>
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