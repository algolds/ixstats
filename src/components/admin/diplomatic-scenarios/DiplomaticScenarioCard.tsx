"use client";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Globe, EditPencil as Pencil, Copy, Trash as Trash2 } from "iconoir-react";
import { SCENARIO_TYPES, RELATIONSHIP_LEVELS } from "~/lib/admin/diplomatic-scenario-transforms";

interface DiplomaticScenarioCardProps {
  scenario: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function DiplomaticScenarioCard({
  scenario,
  isSelected,
  onToggleSelect,
  onEdit,
  onClone,
  onDelete,
}: DiplomaticScenarioCardProps) {
  const typeConfig = SCENARIO_TYPES.find((t) => t.value === scenario.type);
  const TypeIcon = typeConfig?.icon || Globe;
  const relConfig = RELATIONSHIP_LEVELS.find((r) => r.value === scenario.relationshipState);

  const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
  const difficulty = tags.find((t: string) =>
    ["trivial", "moderate", "challenging", "critical", "legendary"].includes(t)
  );
  const timeFrame = tags.find((t: string) =>
    ["urgent", "time_sensitive", "strategic", "long_term"].includes(t)
  );

  const choicesCount = Array.isArray(scenario.responseOptions)
    ? scenario.responseOptions.length
    : 0;

  return (
    <Card className="facet-card-child flex flex-col justify-between p-4 transition-all hover:border-[--intel-gold]/50">
      <div>
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="mt-1" />
            <div>
              <div className="mb-1 flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-[--intel-gold]" />
                <h3 className="text-foreground line-clamp-1 font-semibold">{scenario.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[--intel-silver]">
                  {typeConfig?.label || scenario.type}
                </span>
                <span
                  className={`rounded bg-white/5 px-2 py-0.5 text-xs ${relConfig?.color || ""}`}
                >
                  {relConfig?.label || scenario.relationshipState}
                </span>
                {difficulty && (
                  <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
                    {difficulty}
                  </span>
                )}
                {timeFrame && (
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                    {timeFrame.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          {scenario.status !== "active" && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              {scenario.status}
            </span>
          )}
        </div>

        {/* Narrative */}
        <p className="mb-3 line-clamp-2 text-xs text-[--intel-silver]">{scenario.narrative}</p>

        {/* Stats */}
        <div className="mb-3 grid grid-cols-3 gap-2 border-t border-b border-white/10 py-2 text-center text-xs">
          <div>
            <span className="text-[--intel-silver]">Impact</span>
            <p className="text-foreground font-medium">{scenario.culturalImpact}%</p>
          </div>
          <div>
            <span className="text-[--intel-silver]">Risk</span>
            <p className="text-foreground font-medium">{scenario.diplomaticRisk}%</p>
          </div>
          <div>
            <span className="text-[--intel-silver]">Choices</span>
            <p className="text-foreground font-medium">{choicesCount}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone} className="text-xs">
          <Copy className="h-3 w-3" />
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
