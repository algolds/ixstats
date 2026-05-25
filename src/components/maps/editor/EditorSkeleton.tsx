"use client";

/**
 * EditorSkeleton — Loading skeleton components for the map editor panels.
 *
 * - FeatureListSkeleton: 6 shimmer rows with circle icon + text bar
 * - PropertyFormSkeleton: 4 shimmer rows (label + input field shapes)
 * - LayerPanelSkeleton: 8 shimmer rows (eye icon + text)
 */

export function FeatureListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="bg-muted h-4 w-4 animate-pulse rounded-full" />
          <div
            className="bg-muted h-3 flex-1 animate-pulse rounded"
            style={{ width: `${60 + ((i * 7) % 30)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function PropertyFormSkeleton() {
  return (
    <div className="space-y-4 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div
            className="bg-muted h-2.5 animate-pulse rounded"
            style={{ width: `${30 + ((i * 11) % 20)}%` }}
          />
          <div className="bg-muted h-8 w-full animate-pulse rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function LayerPanelSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <div className="bg-muted h-4 w-4 animate-pulse rounded" />
          <div
            className="bg-muted h-3 flex-1 animate-pulse rounded"
            style={{ width: `${50 + ((i * 9) % 40)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
