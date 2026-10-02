"use client";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Globe, EditPencil as Pencil, Copy, Trash as Trash2 } from "iconoir-react";
import { SCENARIO_TYPES, RELATIONSHIP_LEVELS } from "~/lib/admin/diplomatic-scenario-transforms";
import { Badge } from "~/components/ui/badge";

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
    <Card className="hover:border-yellow/50 flex flex-col justify-between gap-6 p-4 py-6 transition-[color,background-color,border-color,box-shadow,opacity,transform]">
      <div>
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="mt-1" />
            <div>
              <div className="mb-1 flex items-center gap-2">
                <TypeIcon className="text-yellow h-4 w-4" />
                <h3 className="text-label line-clamp-1 font-semibold">{scenario.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="gray">{typeConfig?.label || scenario.type}</Badge>
                <span
                  className={`rounded-control-sm bg-fill-4 text-footnote px-2 py-0.5 ${relConfig?.color || ""}`}
                >
                  {relConfig?.label || scenario.relationshipState}
                </span>
                {difficulty && <Badge variant="yellow">{difficulty}</Badge>}
                {timeFrame && <Badge variant="teal">{timeFrame.replace("_", " ")}</Badge>}
              </div>
            </div>
          </div>
          {scenario.status !== "active" && <Badge variant="red">{scenario.status}</Badge>}
        </div>

        {/* Narrative */}
        <p className="text-footnote text-label-secondary mb-3 line-clamp-2">{scenario.narrative}</p>

        {/* Stats */}
        <div className="border-separator text-footnote mb-3 grid grid-cols-3 gap-2 border-t border-b py-2 text-center">
          <div>
            <span className="text-label-secondary">Impact</span>
            <p className="text-label font-medium">{scenario.culturalImpact}%</p>
          </div>
          <div>
            <span className="text-label-secondary">Risk</span>
            <p className="text-label font-medium">{scenario.diplomaticRisk}%</p>
          </div>
          <div>
            <span className="text-label-secondary">Choices</span>
            <p className="text-label font-medium">{choicesCount}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
