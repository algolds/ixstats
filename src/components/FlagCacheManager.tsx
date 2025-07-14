// src/components/FlagCacheManager.tsx
"use client";

import React from "react";
import { useFlagCacheManager } from "~/hooks/useFlagCacheManager";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Flag
} from "lucide-react";

export function FlagCacheManager() {
  const {
    stats,
    isLoading,
    error,
    updateAllFlags,
    initializeCache,
    clearCache,
    refreshStats,
  } = useFlagCacheManager();

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeUntil = (timestamp: number | null): string => {
    if (!timestamp) return "Unknown";
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return "Now";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = () => {
    if (stats.isUpdating) return "bg-blue-500";
    if (stats.cachedFlags === stats.totalCountries) return "bg-green-500";
    if (stats.cachedFlags > stats.totalCountries * 0.8) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusText = () => {
    if (stats.isUpdating) return "Updating";
    if (stats.cachedFlags === stats.totalCountries) return "Complete";
    if (stats.cachedFlags > stats.totalCountries * 0.8) return "Good";
    return "Needs Update";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" />
            Flag Cache Manager
          </h2>
          <p className="text-muted-foreground">
            Manage country flag caching and automatic updates
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Countries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCountries}</div>
          </CardContent>
        </Card>

        {/* Cached Flags */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cached Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.cachedFlags}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalCountries > 0 
                ? `${Math.round((stats.cachedFlags / stats.totalCountries) * 100)}% coverage`
                : "0% coverage"
              }
            </p>
          </CardContent>
        </Card>

        {/* Failed Flags */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failedFlags}
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`${getStatusColor()} text-white`}>
              {getStatusText()}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats.isUpdating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Update Progress</CardTitle>
            <CardDescription>
              {stats.updateProgress.current} of {stats.updateProgress.total} countries processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={stats.updateProgress.percentage} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              {stats.updateProgress.percentage}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatTime(stats.lastUpdateTime)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Next Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatTime(stats.nextUpdateTime)}</p>
            <p className="text-xs text-muted-foreground">
              in {formatTimeUntil(stats.nextUpdateTime)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
          <CardDescription>
            Manage flag cache operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={initializeCache}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Initialize Cache
            </Button>
            
            <Button
              onClick={updateAllFlags}
              disabled={isLoading || stats.isUpdating}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Update All Flags
            </Button>
            
            <Button
              onClick={clearCache}
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cache Efficiency</CardTitle>
          <CardDescription>
            Performance metrics and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cache Hit Rate</span>
              <span className="text-sm font-medium">
                {stats.totalCountries > 0 
                  ? `${Math.round((stats.cachedFlags / stats.totalCountries) * 100)}%`
                  : "0%"
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Failed Rate</span>
              <span className="text-sm font-medium text-red-600">
                {stats.totalCountries > 0 
                  ? `${Math.round((stats.failedFlags / stats.totalCountries) * 100)}%`
                  : "0%"
                }
              </span>
            </div>

            {stats.failedFlags > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {stats.failedFlags} flags failed to load. Consider retrying the update.
                  </span>
                </div>
              </div>
            )}

            {stats.cachedFlags === stats.totalCountries && stats.totalCountries > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    All flags are cached! Cache is fully optimized.
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 