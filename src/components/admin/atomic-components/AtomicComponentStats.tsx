// src/components/admin/atomic-components/AtomicComponentStats.tsx
// Universal Telemetry & Usage Statistics Grid for Atomic Components
"use client";

import {
  Component as Layers,
  CheckCircle,
  Network,
  Folder,
} from "iconoir-react";

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
      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Components
          </span>
          <Layers className="text-muted-foreground h-3.5 w-3.5" />
        </div>
        <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">{totalCount}</p>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Registry
          </span>
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <p className="text-emerald-500 mt-1 font-mono text-xl font-bold tracking-tight">{activeCount}</p>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Synergy Links
          </span>
          <Network className="text-cyan-400 h-3.5 w-3.5" />
        </div>
        <p className="text-cyan-500 mt-1 font-mono text-xl font-bold tracking-tight">{synergyCount}</p>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Categories
          </span>
          <Folder className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <p className="text-amber-500 mt-1 font-mono text-xl font-bold tracking-tight">{categoryCount}</p>
      </div>
    </div>
  );
}
