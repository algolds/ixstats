'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Activity, Database, Map, Server, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '~/trpc/react';

export default function MapsMonitoringPage() {
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Queries
  const { data: cacheStats, isLoading: loadingCache, refetch: refetchCache } =
    api.mapMonitoring.getCacheStats.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  const { data: martinStatus, isLoading: loadingMartin, refetch: refetchMartin } =
    api.mapMonitoring.getMartinStatus.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  const { data: serviceStatuses, isLoading: loadingServices, refetch: refetchServices } =
    api.mapMonitoring.getServiceStatuses.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  const { data: tileMetrics, isLoading: loadingMetrics, refetch: refetchMetrics } =
    api.mapMonitoring.getTileMetrics.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  // Mutations
  const clearCacheMutation = api.mapMonitoring.clearCache.useMutation({
    onSuccess: (data) => {
      alert(`Successfully cleared ${data.cleared} cache entries`);
      setShowClearConfirm(false);
      void refetchCache();
      void refetchMetrics();
    },
    onError: (error) => {
      alert(`Error clearing cache: ${error.message}`);
    },
  });

  const handleRefreshAll = () => {
    void refetchCache();
    void refetchMartin();
    void refetchServices();
    void refetchMetrics();
  };

  const handleClearCache = () => {
    clearCacheMutation.mutate({ pattern: 'tile:*', confirm: true });
  };

  const isLoading = loadingCache || loadingMartin || loadingServices || loadingMetrics;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Map className="h-8 w-8 text-blue-600" />
                Maps System Monitoring
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor Redis cache, Martin tile server, and map performance metrics
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
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Service Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {serviceStatuses?.map((service) => (
            <div key={service.name} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                {service.healthy ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${service.healthy ? 'text-green-600' : 'text-red-600'}`}>
                    {service.running ? 'Running' : 'Stopped'}
                  </span>
                </div>
                {service.details && (
                  <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                    {service.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Redis Cache Statistics */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Redis Cache Statistics
            </h2>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={!cacheStats?.enabled || clearCacheMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Clear Cache
            </button>
          </div>

          {cacheStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Total Cached Tiles</div>
                <div className="text-3xl font-bold text-blue-600">{cacheStats.totalKeys.toLocaleString()}</div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Cache Hit Rate</div>
                <div className="text-3xl font-bold text-green-600">{cacheStats.hitRate}%</div>
                <div className="text-xs text-gray-500 mt-1">{cacheStats.hits.toLocaleString()} hits</div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Memory Usage</div>
                <div className="text-3xl font-bold text-purple-600">{cacheStats.memoryUsagePercent}%</div>
                <div className="text-xs text-gray-500 mt-1">{cacheStats.memoryUsed} / {cacheStats.memoryMax}</div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Uptime</div>
                <div className="text-3xl font-bold text-orange-600">{cacheStats.uptime}</div>
                <div className="text-xs text-gray-500 mt-1">{cacheStats.evictedKeys} evicted</div>
              </div>
            </div>
          )}

          {!cacheStats?.connected && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-medium">Redis Not Connected</div>
                <div className="text-sm text-red-600">Tile caching is disabled. Check Redis configuration.</div>
              </div>
            </div>
          )}
        </div>

        {/* Martin Tile Server Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
            <Server className="h-6 w-6 text-blue-600" />
            Martin Tile Server
          </h2>

          {martinStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <div className={`text-lg font-semibold ${martinStatus.running ? 'text-green-600' : 'text-red-600'}`}>
                    {martinStatus.running ? 'Running' : 'Stopped'}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Health</div>
                  <div className={`text-lg font-semibold ${martinStatus.healthy ? 'text-green-600' : 'text-yellow-600'}`}>
                    {martinStatus.healthy ? 'Healthy' : 'Unhealthy'}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Endpoint</div>
                  <div className="text-sm font-mono text-gray-700">{martinStatus.endpoint}</div>
                </div>
              </div>

              {martinStatus.availableLayers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Available Layers ({martinStatus.availableLayers.length})</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {martinStatus.availableLayers.map((layer) => (
                      <div key={layer} className="bg-blue-50 px-3 py-2 rounded text-sm font-mono text-blue-700">
                        {layer}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {martinStatus.error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Martin Error</div>
                    <div className="text-sm text-red-600">{martinStatus.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tile Performance Metrics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
            <Activity className="h-6 w-6 text-blue-600" />
            Tile Performance Metrics
          </h2>

          {tileMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Requests</div>
                  <div className="text-3xl font-bold text-blue-600">{tileMetrics.totalRequests.toLocaleString()}</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Cache Hit Rate</div>
                  <div className="text-3xl font-bold text-green-600">{tileMetrics.cacheHitRate}%</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Avg Response Time</div>
                  <div className="text-3xl font-bold text-purple-600">{tileMetrics.avgResponseTime}ms</div>
                </div>
              </div>

              {tileMetrics.layerStats.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Cached Tiles by Layer</div>
                  <div className="space-y-2">
                    {tileMetrics.layerStats.map((stat) => (
                      <div key={stat.layer} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-mono text-sm text-gray-700">{stat.layer}</span>
                        <span className="text-lg font-semibold text-blue-600">{stat.cachedTiles.toLocaleString()} tiles</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clear Cache Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Clear Redis Cache?</h3>
              </div>
              <p className="text-gray-600 mb-6">
                This will clear all cached tiles. Tiles will need to be regenerated on next request, which may cause temporary slowness.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={clearCacheMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {clearCacheMutation.isPending ? 'Clearing...' : 'Clear Cache'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
