"use client";

import React from 'react';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Loader2, BarChart3, Users, Globe, DollarSign } from 'lucide-react';

/**
 * TabLoadingFallback - Skeleton loader for tab content
 * Used as fallback for lazy-loaded tab components
 */
export function TabLoadingFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="space-y-3">
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    </div>
  );
}

/**
 * ModalLoadingFallback - Loader for modal dialogs
 * Used for lazy-loaded modals and overlays
 */
export function ModalLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading modal...</p>
      </div>
    </div>
  );
}

/**
 * ChartLoadingFallback - Placeholder for charts
 * Shows while chart components are loading
 */
export function ChartLoadingFallback() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground animate-pulse" />
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-end gap-2 h-48">
            <div className="flex-1 bg-muted rounded animate-pulse" style={{ height: '60%' }} />
            <div className="flex-1 bg-muted rounded animate-pulse" style={{ height: '80%' }} />
            <div className="flex-1 bg-muted rounded animate-pulse" style={{ height: '45%' }} />
            <div className="flex-1 bg-muted rounded animate-pulse" style={{ height: '90%' }} />
            <div className="flex-1 bg-muted rounded animate-pulse" style={{ height: '70%' }} />
          </div>
          <div className="flex justify-between">
            <div className="h-4 bg-muted rounded w-16 animate-pulse" />
            <div className="h-4 bg-muted rounded w-16 animate-pulse" />
            <div className="h-4 bg-muted rounded w-16 animate-pulse" />
            <div className="h-4 bg-muted rounded w-16 animate-pulse" />
            <div className="h-4 bg-muted rounded w-16 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * BuilderLoadingFallback - Full page loader for builder
 * Used as fallback for the entire builder page
 */
export function BuilderLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-50/10 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        <div className="relative">
          <div className="w-24 h-24 mx-auto">
            <Loader2 className="h-24 w-24 text-amber-500 animate-spin" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="h-12 w-12 text-amber-600" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Loading Builder</h2>
          <p className="text-muted-foreground">
            Preparing your nation building tools...
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 pt-4">
          <div className="flex flex-col items-center gap-2 opacity-50">
            <Users className="h-6 w-6 text-blue-500" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <BarChart3 className="h-6 w-6 text-green-500" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <DollarSign className="h-6 w-6 text-purple-500" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <Globe className="h-6 w-6 text-amber-500" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SectionLoadingFallback - Loader for builder sections
 * Used for individual sections within the builder
 */
export function SectionLoadingFallback() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
          </div>
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
