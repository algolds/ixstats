"use client";

/**
 * EditorSkeleton — Loading skeleton components for the map editor panels.
 *
 * - FeatureListSkeleton: 6 shimmer rows with circle icon + text bar
 * - PropertyFormSkeleton: 4 shimmer rows (label + input field shapes)
 * - LayerPanelSkeleton: 8 shimmer rows (eye icon + text)
 *
 * Built on the Facet `<Skeleton>` primitive.
 */

import { Skeleton } from "~/components/ui/skeleton";

export function FeatureListSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading features">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 rounded" style={{ width: `${60 + ((i * 7) % 30)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function PropertyFormSkeleton() {
  return (
    <div className="space-y-4 p-3" aria-busy="true" aria-label="Loading properties">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-2.5 rounded" style={{ width: `${30 + ((i * 11) % 20)}%` }} />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function LayerPanelSkeleton() {
  return (
    <div className="space-y-1.5 p-3" aria-busy="true" aria-label="Loading layers">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 rounded" style={{ width: `${50 + ((i * 9) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}
