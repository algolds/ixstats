"use client";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Factory,
  EyeOff,
  DollarSign,
  Target,
  Users,
  Pencil,
  Network,
  Trash2,
} from "lucide-react";
import { COMPLEXITY_COLORS } from "~/lib/admin/economic-component-transforms";

interface EconomicComponentCardProps {
  component: any;
  onEdit: () => void;
  onDelete: () => void;
}

export function EconomicComponentCard({
  component,
  onEdit,
  onDelete,
}: EconomicComponentCardProps) {
  const hasTaxImpact =
    component.taxImpact &&
    (component.taxImpact.optimalCorporateRate !== 20 ||
      component.taxImpact.optimalIncomeRate !== 25 ||
      component.taxImpact.revenueEfficiency !== 75);

  const hasSectorImpact =
    component.sectorImpact && Object.values(component.sectorImpact).some((val: any) => val !== 1.0);

  const hasEmploymentImpact =
    component.employmentImpact &&
    (component.employmentImpact.unemploymentModifier !== 0 ||
      component.employmentImpact.participationModifier !== 1.0 ||
      component.employmentImpact.wageGrowthModifier !== 1.0);

  return (
    <Card className="glass-card-child p-4 transition-all hover:border-[--intel-gold]/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Factory className="h-4 w-4 text-[--intel-gold]" />
            <h3 className="text-foreground line-clamp-1 font-semibold">{component.name}</h3>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-xs bg-${component.color}-500/20 text-${component.color}-400`}
          >
            {component.category}
          </span>
        </div>
        {!component.isActive && <EyeOff className="h-4 w-4 text-red-400" aria-label="Inactive" />}
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs text-[--intel-silver]">{component.description}</p>

      {/* Effectiveness Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Effectiveness</span>
          <span className="text-foreground font-medium">{component.effectiveness}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full ${
              component.effectiveness >= 75
                ? "bg-green-400"
                : component.effectiveness >= 50
                  ? "bg-yellow-400"
                  : "bg-red-400"
            }`}
            style={{ width: `${component.effectiveness}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Complexity:</span>
          <span
            className={`font-medium ${COMPLEXITY_COLORS[component.metadata?.complexity || "Medium"]}`}
          >
            {component.metadata?.complexity || "Medium"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Usage:</span>
          <span className="text-foreground font-medium">{component.usageCount || 0}×</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Cost:</span>
          <span className="text-foreground font-medium">
            ${(component.implementationCost / 1000).toFixed(0)}k / $
            {(component.maintenanceCost / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* Impact Indicators */}
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        {hasTaxImpact && (
          <div className="rounded bg-blue-500/20 p-1" title="Tax Impact">
            <DollarSign className="h-3 w-3 text-blue-400" />
          </div>
        )}
        {hasSectorImpact && (
          <div className="rounded bg-purple-500/20 p-1" title="Sector Impact">
            <Target className="h-3 w-3 text-purple-400" />
          </div>
        )}
        {hasEmploymentImpact && (
          <div className="rounded bg-green-500/20 p-1" title="Employment Impact">
            <Users className="h-3 w-3 text-green-400" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} className="text-xs">
          <Network className="mr-1 h-3 w-3" />
          Synergies
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
