"use client";

import React, { Component, type ReactNode } from "react";
import { Map, WarningCircle as AlertCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import type { Geometry, Position } from "geojson";

// ── Editor Loading Screen ────────────────────────────────────────────

export function EditorLoadingScreen({ countryName }: { countryName?: string | null }) {
  return (
    <div
      role="status"
      className="bg-surface absolute inset-0 z-40 flex items-center justify-center p-6"
    >
      <FacetMaterial
        material="regular"
        className="rounded-card w-full max-w-xs space-y-4 p-6 text-center"
      >
        <Map className="text-label-secondary mx-auto h-6 w-6" aria-hidden />
        <div>
          <h2 className="text-label text-headline">Loading map editor…</h2>
          {countryName && <p className="text-label-secondary text-footnote mt-1">{countryName}</p>}
        </div>
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mx-auto h-3 w-2/3" />
        </div>
      </FacetMaterial>
    </div>
  );
}

// ── Geometry Vertices Counter Helper ─────────────────────────────────

export function countGeometryVertices(geometry: Geometry | object): number {
  const geo = geometry as { type?: string; coordinates?: Position[][] | Position[][][] };
  if (!geo.coordinates) return 0;
  if (geo.type === "Polygon") {
    return (geo.coordinates as Position[][]).reduce((s, ring) => s + ring.length, 0);
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates as Position[][][]).reduce(
      (s, poly) => s + poly.reduce((s2, ring) => s2 + ring.length, 0),
      0
    );
  }
  return 0;
}

// ── Error Boundary Component ─────────────────────────────────────────

interface ErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[EditorErrorBoundary:${this.props.name}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle className="text-destructive h-5 w-5" aria-hidden />
          <p className="text-label-secondary text-footnote">
            {this.props.name} encountered an error
          </p>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
