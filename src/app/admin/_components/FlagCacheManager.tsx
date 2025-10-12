"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Loader2, RefreshCw, Trash2, Database, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { withBasePath } from "~/lib/base-path";

interface FlagStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  nextUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface MediaWikiStats {
  cacheSize: number;
  hitRate: number;
  lastCleared: number | null;
}

interface ServerFlagCacheStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
}

interface FlagCacheStatus {
  flagCache: FlagStats;
  serverFlagCache: ServerFlagCacheStats;
  mediaWiki: MediaWikiStats;
  timestamp: number;
}

export function FlagCacheManager() {
  const [status, setStatus] = useState<FlagCacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch(withBasePath('/api/flag-cache?action=status'));
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      if (data.success) {
        setStatus(data);
      } else {
        throw new Error(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching flag cache status:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCache = async () => {
    try {
      setUpdating(true);
      setError(null);
      
      const response = await fetch(withBasePath('/api/flag-cache?action=update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countries: [] })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      if (data.success) {
        // Refresh status after update
        await fetchStatus();
      } else {
        throw new Error(data.error || 'Failed to update cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error updating flag cache:', err);
    } finally {
      setUpdating(false);
    }
  };

  const clearCache = async () => {
    try {
      setClearing(true);
      setError(null);
      
      const response = await fetch(withBasePath('/api/flag-cache?action=clear'), {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      if (data.success) {
        // Refresh status after clearing
        await fetchStatus();
      } else {
        throw new Error(data.error || 'Failed to clear cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error clearing flag cache:', err);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (stats: FlagStats) => {
    if (stats.isUpdating) return 'yellow';
    if (stats.failedFlags > stats.cachedFlags * 0.1) return 'red';
    if (stats.cachedFlags > stats.totalCountries * 0.8) return 'green';
    return 'orange';
  };

  if (loading) {
    return (
      <GlassCard className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Flag Cache Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading cache status...</span>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Flag Cache Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {status && (
          <>
            {/* Server Flag Cache Stats (Primary) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Database className="h-5 w-5" />
                Server Flag Cache (Local Storage)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.serverFlagCache.totalCountries}</div>
                  <div className="text-sm text-gray-600">Total Countries</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-green-600">{status.serverFlagCache.cachedFlags}</div>
                  <div className="text-sm text-gray-600">Downloaded Flags</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.serverFlagCache.diskUsage.totalSizeMB} MB</div>
                  <div className="text-sm text-gray-600">Disk Usage</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.serverFlagCache.diskUsage.totalFiles}</div>
                  <div className="text-sm text-gray-600">Files Stored</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge 
                  variant={status.serverFlagCache.isUpdating ? 'destructive' : 'default'}
                  className="flex items-center gap-1"
                >
                  {status.serverFlagCache.isUpdating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Downloading ({status.serverFlagCache.updateProgress.percentage}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </>
                  )}
                </Badge>
                
                {status.serverFlagCache.lastUpdateTime && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="h-3 w-3" />
                    Last updated: {formatTime(status.serverFlagCache.lastUpdateTime)}
                  </div>
                )}
              </div>

              {status.serverFlagCache.isUpdating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Download Progress</span>
                    <span className="text-sm">{status.serverFlagCache.updateProgress.current} / {status.serverFlagCache.updateProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${status.serverFlagCache.updateProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* In-Memory Flag Cache Stats */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">In-Memory Flag Cache</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.flagCache.totalCountries}</div>
                  <div className="text-sm text-gray-600">Total Countries</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-green-600">{status.flagCache.cachedFlags}</div>
                  <div className="text-sm text-gray-600">Cached Flags</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-red-600">{status.flagCache.failedFlags}</div>
                  <div className="text-sm text-gray-600">Failed Flags</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">
                    {status.flagCache.totalCountries > 0 
                      ? Math.round((status.flagCache.cachedFlags / status.flagCache.totalCountries) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Cache Rate</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge 
                  variant={getStatusColor(status.flagCache) === 'green' ? 'default' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {status.flagCache.isUpdating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Updating ({status.flagCache.updateProgress.percentage}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </>
                  )}
                </Badge>
                
                {status.flagCache.lastUpdateTime && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="h-3 w-3" />
                    Last updated: {formatTime(status.flagCache.lastUpdateTime)}
                  </div>
                )}
              </div>

              {status.flagCache.isUpdating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Update Progress</span>
                    <span className="text-sm">{status.flagCache.updateProgress.current} / {status.flagCache.updateProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${status.flagCache.updateProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MediaWiki Cache Stats */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">MediaWiki Cache</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.mediaWiki.cacheSize}</div>
                  <div className="text-sm text-gray-600">Cache Size</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-2xl font-bold">{status.mediaWiki.hitRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Hit Rate</div>
                </div>
                
                <div className="bg-white/50 rounded-lg p-4 border">
                  <div className="text-sm font-medium">Last Cleared</div>
                  <div className="text-sm text-gray-600">{formatTime(status.mediaWiki.lastCleared)}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button 
                onClick={updateCache}
                disabled={updating || status.flagCache.isUpdating}
                className="flex items-center gap-2"
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Download & Cache Flags
              </Button>
              
              <Button 
                variant="outline"
                onClick={clearCache}
                disabled={clearing}
                className="flex items-center gap-2"
              >
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear All Caches
              </Button>
              
              <Button 
                variant="ghost"
                onClick={fetchStatus}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </GlassCard>
  );
}