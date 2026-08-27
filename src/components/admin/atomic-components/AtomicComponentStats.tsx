// src/components/admin/atomic-components/AtomicComponentStats.tsx
// Universal Telemetry & Usage Statistics Grid for Atomic Components
"use client";

import { Component as Layers, CheckCircle, Network, Folder } from "iconoir-react";

interface AtomicComponentStatsProps {
  totalCount: number;
  activeCount: number;
  synergyCount: number;
  categoryCount: number;
  domain: "economy" | "government";
}

export function AtomicComponentStats({
  totalCount,
  activeCount,
  synergyCount,
  categoryCount,
  domain: _domain,
}: AtomicComponentStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Components
          </span>
          <Layers className="text-muted-foreground h-3.5 w-3.5" />
        </div>
        <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
          {totalCount}
        </p>
      </div>

      <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Registry
          </span>
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-500">
          {activeCount}
        </p>
      </div>

      <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Synergy Links
          </span>
          <Network className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-500">
          {synergyCount}
        </p>
      </div>

      <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Categories
          </span>
          <Folder className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-500">
          {categoryCount}
        </p>
      </div>
    </div>
  );
}
