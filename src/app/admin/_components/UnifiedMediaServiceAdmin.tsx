"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, AlertTriangle } from "lucide-react";

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  cacheSize: number;
  lastUpdated: number;
  serviceStats: {
    totalRequests: number;
    flagRequests: number;
    infoboxRequests: number;
  };
}

export function UnifiedMediaServiceAdmin() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/flag-cache?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCache = async () => {
    try {
      setIsInitializing(true);
      const response = await fetch('/api/flag-cache?action=flags', {
        method: 'GET',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchStats(); // Refresh stats
        alert(`Cache initialized! Loaded ${Object.keys(data.flags).length} flags.`);
      } else {
        alert('Failed to initialize cache: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to initialize cache:', error);
      alert('Failed to initialize cache: ' + error);
    } finally {
      setIsInitializing(false);
    }
  };

  const clearCache = async () => {
    try {
      setIsLoading(true);
      // Call the unified service clear method
      const response = await fetch('/api/flag-cache?action=clear', {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchStats(); // Refresh stats
        alert('Cache cleared successfully!');
      } else {
        alert('Failed to clear cache: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const hitRate = stats ? (stats.hitRate * 100).toFixed(1) : '0';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Unified Media Service
        </CardTitle>
        <CardDescription>
          Centralized flag and wiki data caching system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats?.cacheSize ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Cached Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {hitRate}%
            </div>
            <div className="text-sm text-muted-foreground">Hit Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats?.serviceStats.flagRequests ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Flag Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats?.serviceStats.totalRequests ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={stats?.cacheSize ? "default" : "secondary"}>
            Cache: {stats?.cacheSize ? "Active" : "Empty"}
          </Badge>
          <Badge variant={parseFloat(hitRate) > 80 ? "default" : "destructive"}>
            Performance: {parseFloat(hitRate) > 80 ? "Good" : "Needs Improvement"}
          </Badge>
          {lastUpdated && (
            <Badge variant="outline">
              Updated: {lastUpdated.toLocaleTimeString()}
            </Badge>
          )}
        </div>

        {/* Cache Health Warning */}
        {stats && stats.cacheSize === 0 && (
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              Cache is empty. Initialize the cache to improve performance.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={fetchStats}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Stats
          </Button>

          <Button
            onClick={initializeCache}
            disabled={isInitializing}
            variant="default"
            size="sm"
          >
            {isInitializing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Initialize Cache
          </Button>

          <Button
            onClick={clearCache}
            disabled={isLoading}
            variant="destructive"
            size="sm"
          >
            Clear Cache
          </Button>
        </div>

        {/* Detailed Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <h4 className="font-medium mb-2">Request Statistics</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Cache Hits:</span>
                  <span>{stats.cacheHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Misses:</span>
                  <span>{stats.cacheMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hit Ratio:</span>
                  <span>{hitRate}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Service Breakdown</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Flag Requests:</span>
                  <span>{stats.serviceStats.flagRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Infobox Requests:</span>
                  <span>{stats.serviceStats.infoboxRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Service Requests:</span>
                  <span>{stats.serviceStats.totalRequests}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UnifiedMediaServiceAdmin;