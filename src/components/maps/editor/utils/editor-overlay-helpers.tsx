"use client";

import React, { Component, type ReactNode } from "react";
import { Map, WarningCircle as AlertCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import type { Geometry, MultiPolygon, Polygon } from "geojson";
import { getAllRings } from "~/lib/maps/border-editor";

export function EditorLoadingScreen({ countryName }: { countryName?: string | null }) {
  return (
    <div
      role="status"
      className="bg-surface absolute inset-0 z-40 flex items-center justify-center p-6"
    >
      <FacetMaterial
        layer="chrome"
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

export function countGeometryVertices(geometry: Geometry | object): number {
  const geo = geometry as { type?: string; coordinates?: unknown };
  if (!geo.coordinates || (geo.type !== "Polygon" && geo.type !== "MultiPolygon")) return 0;
  return getAllRings(geo as Polygon | MultiPolygon).reduce((sum, ring) => sum + ring.length, 0);
}

interface ErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

export class EditorErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
          <Button variant="secondary" size="xs" onClick={() => this.setState({ hasError: false })}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
