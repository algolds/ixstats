"use client";
// src/components/admin/atomic-components/AtomicComponentStats.tsx
// Universal Telemetry & Usage Statistics Grid for Atomic Components

import { Component as Layers, CheckCircle, Network, Folder } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";

interface AtomicComponentStatsProps {
  totalCount: number;
  /** Active components adopted across nations; undefined while loading. */
  adoptionCount: number | undefined;
  synergyCount: number;
  categoryCount: number;
}

export function AtomicComponentStats({
  totalCount,
  adoptionCount,
  synergyCount,
  categoryCount,
}: AtomicComponentStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <FacetCard className="p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">Total Components</span>
          <Layers className="text-label-secondary h-3.5 w-3.5" />
        </div>
        <p className="text-label text-title-2 mt-1 tabular-nums">{totalCount}</p>
      </FacetCard>

      <FacetCard className="p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">Adopted by Nations</span>
          <CheckCircle className="text-green h-3.5 w-3.5" />
        </div>
        <p className="text-title-2 text-green mt-1 tabular-nums">{adoptionCount ?? "—"}</p>
      </FacetCard>

      <FacetCard className="p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">Synergy Links</span>
          <Network className="text-teal h-3.5 w-3.5" />
        </div>
        <p className="text-title-2 text-teal mt-1 tabular-nums">{synergyCount}</p>
      </FacetCard>

      <FacetCard className="p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">Categories</span>
          <Folder className="text-yellow h-3.5 w-3.5" />
        </div>
        <p className="text-title-2 text-yellow mt-1 tabular-nums">{categoryCount}</p>
      </FacetCard>
    </div>
  );
}
