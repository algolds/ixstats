"use client";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { City as Building2, EyeClosed as EyeOff, EditPencil as Pencil, Network, Trash as Trash2 } from "iconoir-react";
import { COMPLEXITY_COLORS } from "~/lib/admin/government-component-transforms";

interface GovernmentComponentCardProps {
  component: any;
  onEdit: () => void;
  onDelete: () => void;
}

export function GovernmentComponentCard({
  component,
  onEdit,
  onDelete,
}: GovernmentComponentCardProps) {
  return (
    <Card className="facet-card-child p-4 transition-all hover:border-[--intel-gold]/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[--intel-gold]" />
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
