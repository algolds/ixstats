"use client";
// src/components/admin/atomic-components/AtomicComponentCard.tsx
// Universal Card renderer for Atomic Simulation Components (Economic & Government)

import { Industry as Factory, City as Building2, Network } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";

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
  const accentColor = domain === "economy" ? "text-yellow" : "text-teal";
  const badgeColor =
    domain === "economy"
      ? "bg-yellow/10 text-yellow border-yellow/20"
      : "bg-teal/10 text-teal border-teal/20";

  return (
    <FacetCard className="group hover:border-separator relative p-4 transition-colors">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="mb-1 flex items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${accentColor}`} />
            <h3 className="text-label text-headline line-clamp-1">{component.name}</h3>
          </div>
          <span
            className={`rounded-control-sm text-caption inline-block border px-2 py-0.5 ${badgeColor}`}
          >
            {component.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-label-secondary text-footnote mb-3 line-clamp-2 leading-relaxed">
        {component.description}
      </p>

      {/* Effectiveness Bar */}
      <div className="mb-3">
        <div className="text-footnote mb-1 flex items-center justify-between">
          <span className="text-label-secondary">Effectiveness</span>
          <span className="text-label font-semibold">{component.effectiveness}%</span>
        </div>
        <div className="bg-surface h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
              component.effectiveness >= 75
                ? "bg-green"
                : component.effectiveness >= 50
                  ? "bg-yellow"
                  : "bg-red"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, component.effectiveness))}%` }}
          />
        </div>
      </div>

      {/* Metrics & Synergies count */}
      <div className="border-separator text-label-secondary text-footnote flex items-center justify-between border-t pt-2">
        <span className="text-footnote tabular-nums">
          Complexity: {component.metadata?.complexity ?? "—"}
        </span>
        <span className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          {component.synergies.length} synergies
        </span>
      </div>
    </FacetCard>
  );
}
