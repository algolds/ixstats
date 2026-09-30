"use client";
// src/components/admin/atomic-components/AtomicComponentCard.tsx
// Universal Card renderer for Atomic Simulation Components (Economic & Government)

import { Industry as Factory, City as Building2, Network } from "iconoir-react";

interface AtomicComponentCardProps {
  component: {
    name: string;
    description: string;
    category: string;
    effectiveness: number;
    synergies: readonly string[];
    metadata?: { complexity?: string };
    usageCount?: number;
  };
  domain: "economy" | "government";
}

export function AtomicComponentCard({ component, domain }: AtomicComponentCardProps) {
  const Icon = domain === "economy" ? Factory : Building2;
  const accentColor = domain === "economy" ? "text-amber-400" : "text-cyan-400";
  const badgeColor =
    domain === "economy"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
      : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";

  return (
    <div className="group border-border/30 bg-card/25 hover:border-border/60 relative rounded-2xl border p-3.5 shadow-xs backdrop-blur-md transition-colors">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="mb-1 flex items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${accentColor}`} />
            <h3 className="text-foreground line-clamp-1 text-sm font-semibold">{component.name}</h3>
          </div>
          <span
            className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${badgeColor}`}
          >
            {component.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-3 line-clamp-2 text-xs leading-relaxed">
        {component.description}
      </p>

      {/* Effectiveness Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Effectiveness</span>
          <span className="text-foreground font-semibold">{component.effectiveness}%</span>
        </div>
        <div className="bg-card/60 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              component.effectiveness >= 75
                ? "bg-emerald-400"
                : component.effectiveness >= 50
                  ? "bg-amber-400"
                  : "bg-red-400"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, component.effectiveness))}%` }}
          />
        </div>
      </div>

      {/* Metrics & Synergies count */}
      <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
        <span className="font-mono text-xs">
          Complexity: {component.metadata?.complexity ?? "—"}
        </span>
        <span className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          {component.synergies.length} synergies
        </span>
      </div>
    </div>
  );
}
