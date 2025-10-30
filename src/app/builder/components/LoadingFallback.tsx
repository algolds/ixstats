"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Loader2, BarChart3, Users, Globe, DollarSign } from "lucide-react";

/**
 * TabLoadingFallback - Skeleton loader for tab content
 * Used as fallback for lazy-loaded tab components
 */
export function TabLoadingFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-muted h-8 w-1/3 rounded" />
      <div className="space-y-3">
        <div className="bg-muted h-20 rounded" />
        <div className="bg-muted h-20 rounded" />
        <div className="bg-muted h-20 rounded" />
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
      <div className="space-y-4 text-center">
        <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading modal...</p>
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
          <BarChart3 className="text-muted-foreground h-5 w-5 animate-pulse" />
          <div className="bg-muted h-6 w-32 animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex h-48 items-end gap-2">
            <div className="bg-muted flex-1 animate-pulse rounded" style={{ height: "60%" }} />
            <div className="bg-muted flex-1 animate-pulse rounded" style={{ height: "80%" }} />
            <div className="bg-muted flex-1 animate-pulse rounded" style={{ height: "45%" }} />
            <div className="bg-muted flex-1 animate-pulse rounded" style={{ height: "90%" }} />
            <div className="bg-muted flex-1 animate-pulse rounded" style={{ height: "70%" }} />
          </div>
          <div className="flex justify-between">
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
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
    <div className="from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-amber-50/10">
      <div className="mx-auto max-w-md space-y-6 p-8 text-center">
        <div className="relative">
          <div className="mx-auto h-24 w-24">
            <Loader2 className="h-24 w-24 animate-spin text-amber-500" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="h-12 w-12 text-amber-600" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-foreground text-2xl font-bold">Loading Builder</h2>
          <p className="text-muted-foreground">Preparing your nation building tools...</p>
        </div>
        <div className="grid grid-cols-4 gap-4 pt-4">
          <div className="flex flex-col items-center gap-2 opacity-50">
            <Users className="h-6 w-6 text-blue-500" />
            <div className="bg-muted h-2 w-full rounded" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <BarChart3 className="h-6 w-6 text-green-500" />
            <div className="bg-muted h-2 w-full rounded" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <DollarSign className="h-6 w-6 text-purple-500" />
            <div className="bg-muted h-2 w-full rounded" />
          </div>
          <div className="flex flex-col items-center gap-2 opacity-50">
            <Globe className="h-6 w-6 text-amber-500" />
            <div className="bg-muted h-2 w-full rounded" />
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
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-6 w-1/3 animate-pulse rounded" />
            <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-10 w-24 animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
              <div className="bg-muted h-10 animate-pulse rounded" />
            </div>
            <div className="space-y-2">
              <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
              <div className="bg-muted h-10 animate-pulse rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
            <div className="bg-muted h-32 animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
