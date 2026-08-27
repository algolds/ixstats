"use client";

import React, { useState, useEffect, Component, type ReactNode } from "react";
import { Map, WarningCircle as AlertCircle } from "iconoir-react";

// ── Editor Loading Screen ────────────────────────────────────────────

export function EditorLoadingScreen({ countryName }: { countryName?: string | null }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-map-ocean absolute inset-0 z-40 flex items-center justify-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.06)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* Animated rings */}
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed border-emerald-500/30" />
          <div className="absolute inset-3 animate-[spin_4s_linear_infinite_reverse] rounded-full border border-emerald-400/20" />
          <div className="absolute inset-6 animate-pulse rounded-full border border-emerald-300/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Map className="h-8 w-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground text-sm font-semibold">Loading Map Editor{dots}</h2>
          {countryName && <p className="text-muted-foreground mt-1 text-xs">{countryName}</p>}
        </div>

        <div className="text-muted-foreground/60 flex gap-4 text-[10px]">
          <span>Geometry</span>
          <span>Features</span>
          <span>Layers</span>
        </div>
      </div>
    </div>
  );
}

// ── Geometry Vertices Counter Helper ─────────────────────────────────

export function countGeometryVertices(geometry: object): number {
  const geo = geometry as { type: string; coordinates: unknown };
  if (!geo.coordinates) return 0;
  if (geo.type === "Polygon") {
    return (geo.coordinates as number[][][]).reduce((s, ring) => s + ring.length, 0);
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates as number[][][][]).reduce(
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
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-muted-foreground text-xs">{this.props.name} encountered an error</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-muted text-foreground hover:bg-accent rounded-md px-3 py-1 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
