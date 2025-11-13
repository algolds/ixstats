'use client';

import { useState } from 'react';
import { RefreshCw, Database, AlertCircle, CheckCircle, XCircle, Play, RotateCcw, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '~/trpc/react';

export default function NSSyncMonitoringPage() {
  const [refreshInterval, setRefreshInterval] = useState<number | null>(10000); // Default 10s refresh
  const [showResetConfirm, setShowResetConfirm] = useState<number | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  const seasons = [1, 2, 3, 4];

  // Queries
  const { data: healthStats, isLoading: loadingHealth, refetch: refetchHealth } =
    api.nsImport.getSyncHealth.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  // Fetch all season statuses individually
  const seasonStatuses = seasons.map((season) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = api.nsImport.getSyncStatus.useQuery(
      { season },
      { refetchInterval: refreshInterval ?? false }
    );
    return data;
  });

  const { data: syncLogs, refetch: refetchLogs } = api.nsImport.getSyncLogs.useQuery(
    { season: undefined, limit: 50 },
    {
      refetchInterval: refreshInterval ?? false,
    }
  );

  // Mutations
  const triggerSyncMutation = api.nsImport.triggerManualSync.useMutation({
    onSuccess: (data) => {
      alert(`Sync queued for Season ${data.season}`);
      void refetchHealth();
    },
    onError: (error) => {
      alert(`Error triggering sync: ${error.message}`);
    },
  });

  const resetSyncMutation = api.nsImport.resetSync.useMutation({
    onSuccess: (data) => {
      alert(data.message);
      setShowResetConfirm(null);
      void refetchHealth();
    },
    onError: (error) => {
      alert(`Error resetting sync: ${error.message}`);
    },
  });

  const handleRefreshAll = () => {
    void refetchHealth();
    void refetchLogs();
  };

  const handleTriggerSync = (season: number) => {
    if (confirm(`Start manual sync for Season ${season}?`)) {
      triggerSyncMutation.mutate({ season });
    }
  };

  const handleResetSync = (season: number) => {
    resetSyncMutation.mutate({ season });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'IN_PROGRESS':
        return 'text-blue-600 bg-blue-50';
      case 'FAILED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'IN_PROGRESS':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-600" />
                NationStates Sync Monitoring
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor NS card sync operations, checkpoint progress, and error rates
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Auto-refresh toggle */}
              <select
                value={refreshInterval ?? 'off'}
                onChange={(e) => setRefreshInterval(e.target.value === 'off' ? null : parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="off">Auto-refresh: Off</option>
                <option value="5000">Every 5s</option>
                <option value="10000">Every 10s</option>
                <option value="30000">Every 30s</option>
              </select>

              {/* Manual refresh */}
              <button
                onClick={handleRefreshAll}
                disabled={loadingHealth}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Overall Health Metrics */}
        {healthStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-6 w-6 text-blue-600" />
                <div className="text-sm text-gray-600">Total Syncs</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{healthStats.overall.totalSyncs}</div>
              <div className="text-xs text-gray-500 mt-1">
                {healthStats.overall.lastSyncAt ? new Date(healthStats.overall.lastSyncAt).toLocaleString() : 'Never'}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {(healthStats.overall.successRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {healthStats.overall.successfulSyncs} successful
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
              <div className={`text-3xl font-bold ${healthStats.overall.errorRate > 0.1 ? 'text-red-600' : 'text-gray-900'}`}>
                {(healthStats.overall.errorRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {healthStats.overall.failedSyncs} failed
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-6 w-6 text-purple-600" />
                <div className="text-sm text-gray-600">Avg Cards/Sync</div>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {healthStats.overall.avgCardsProcessed.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">per sync operation</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {healthStats && healthStats.alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-red-900">Active Alerts</h3>
            </div>
            <div className="space-y-2">
              {healthStats.alerts.map((alert, idx) => (
                <div key={idx} className="text-sm text-red-700 ml-8">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Season Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {seasonStatuses?.map((seasonData, idx) => {
            if (!seasonData) return null;
            const season = seasons[idx]!;

            return (
              <div key={season} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-gray-900">Season {season}</h3>
                    {getStatusIcon(seasonData.status)}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(seasonData.status)}`}>
                    {seasonData.status}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span className="font-medium">{seasonData.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        seasonData.status === 'COMPLETED'
                          ? 'bg-green-600'
                          : seasonData.status === 'IN_PROGRESS'
                          ? 'bg-blue-600'
                          : seasonData.status === 'FAILED'
                          ? 'bg-red-600'
                          : 'bg-gray-400'
                      }`}
                      style={{ width: `${seasonData.progress}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Cards Processed</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {seasonData.cardsProcessed.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      of {seasonData.totalCards.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Errors</div>
                    <div className={`text-2xl font-bold ${seasonData.errorCount > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                      {seasonData.errorCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      {seasonData.errorCount > 10 ? 'High error count' : 'Within threshold'}
                    </div>
                  </div>
                </div>

                {/* Last Checkpoint */}
                {seasonData.lastCheckpoint && (
                  <div className="text-sm text-gray-600 mb-4">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Last checkpoint: {new Date(seasonData.lastCheckpoint).toLocaleString()}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTriggerSync(season)}
                    disabled={seasonData.status === 'IN_PROGRESS' || triggerSyncMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <Play className="h-4 w-4" />
                    Trigger Sync
                  </button>

                  <button
                    onClick={() => setShowResetConfirm(season)}
                    disabled={seasonData.status === 'IN_PROGRESS' || resetSyncMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Errors */}
        {healthStats && healthStats.recentErrors.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Recent Errors (Last 50)
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {healthStats.recentErrors.slice(0, 20).map((error, idx) => (
                <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-red-900">Season {error.season}</span>
                    <span className="text-sm text-red-600">
                      {new Date(error.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-red-700 font-mono bg-red-100 p-2 rounded">
                    {error.error}
                  </div>
                  {error.cardsAffected > 0 && (
                    <div className="text-xs text-red-600 mt-2">
                      Cards affected: {error.cardsAffected}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Logs */}
        {syncLogs && syncLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Database className="h-6 w-6 text-blue-600" />
              Recent Sync Operations
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Season</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cards</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Updated</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">Season {log.season}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{log.cardsProcessed.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm">{log.cardsCreated?.toLocaleString() ?? 0}</td>
                      <td className="py-3 px-4 text-sm">{log.cardsUpdated?.toLocaleString() ?? 0}</td>
                      <td className="py-3 px-4 text-sm">{formatDuration(log.duration)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(log.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reset Confirmation Dialog */}
        {showResetConfirm !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Reset Season {showResetConfirm} Sync?</h3>
              </div>
              <p className="text-gray-600 mb-6">
                This will clear the checkpoint and sync will start from the beginning. All progress will be lost.
                Are you sure you want to continue?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowResetConfirm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResetSync(showResetConfirm)}
                  disabled={resetSyncMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetSyncMutation.isPending ? 'Resetting...' : 'Reset Sync'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
