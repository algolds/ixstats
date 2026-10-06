"use client";

import React from "react";
import {
  EditPencil as Edit,
  Trash as Trash2,
  Plus,
  NavArrowDown,
  NavArrowRight,
  Group as Users,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import {
  BRANCH_TYPE_LABELS,
  branchStrength,
  type BranchTypeKey,
} from "~/lib/military/force-structure";
import { formatCount, type ForceBranch, type ForceUnit } from "./force-fields";

interface BranchCardProps {
  branch: ForceBranch;
  expanded: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddUnit: () => void;
  onEditUnit: (unit: ForceUnit) => void;
  onDeleteUnit: (unit: ForceUnit) => void;
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-label font-medium tabular-nums">{value}</div>
      <div className="text-label-secondary text-footnote truncate">{label}</div>
    </div>
  );
}

function UnitRow({
  unit,
  canEdit,
  onEdit,
  onDelete,
}: {
  unit: ForceUnit;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const commander = [unit.commanderRank, unit.commanderName].filter(Boolean).join(" ");
  return (
    <li className="border-separator flex items-center gap-3 border-t py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label text-body truncate font-medium">{unit.name}</span>
          <Badge variant="outline" className="capitalize">
            {unit.unitType}
          </Badge>
        </div>
        <div className="text-label-secondary text-footnote truncate">
          {formatCount(unit.personnel)} personnel · {Math.round(unit.readiness)}% ready
          {commander ? ` · ${commander}` : ""}
          {unit.headquarters ? ` · ${unit.headquarters}` : ""}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={`Edit ${unit.name}`}
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-label-secondary hover:text-destructive h-8 w-8"
            aria-label={`Delete ${unit.name}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

/** One branch: headline figures, readiness, and its units when expanded. */
export function BranchCard({
  branch,
  expanded,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  onAddUnit,
  onEditUnit,
  onDeleteUnit,
}: BranchCardProps) {
  const assigned = branch.units.reduce((s, u) => s + u.personnel, 0);
  const assetCount = branch.assets.reduce((s, a) => s + a.quantity, 0);
  const typeLabel = BRANCH_TYPE_LABELS[branch.branchType as BranchTypeKey] ?? branch.branchType;
  const Chevron = expanded ? NavArrowDown : NavArrowRight;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${branch.name}` : `Expand ${branch.name}`}
          onClick={onToggle}
        >
          <Chevron className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-label text-headline truncate">{branch.name}</h4>
            <Badge variant="outline">{typeLabel}</Badge>
          </div>
          {branch.motto && (
            <p className="text-label-secondary text-footnote truncate italic">{branch.motto}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Active duty" value={formatCount(branch.activeDuty)} />
            <Figure label="Reserves" value={formatCount(branch.reserves)} />
            <Figure
              label={`Units (${formatCount(assigned)} assigned)`}
              value={branch.units.length}
            />
            <Figure label="Combat strength" value={formatCount(branchStrength(branch))} />
          </div>
          <div className="mt-3">
            <div className="text-footnote mb-1 flex items-center justify-between">
              <span className="text-label-secondary">Readiness</span>
              <span className="text-label font-medium tabular-nums">
                {Math.round(branch.readinessLevel)}%
              </span>
            </div>
            <Progress value={branch.readinessLevel} className="h-1" />
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Edit ${branch.name}`}
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-label-secondary hover:text-destructive h-8 w-8"
              aria-label={`Delete ${branch.name}`}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-separator mt-4 border-t pt-3 pl-11">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-label-secondary text-footnote flex items-center gap-2">
              <Users aria-hidden="true" className="h-4 w-4" />
              {branch.units.length} units · {formatCount(assetCount)} assets
            </span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onAddUnit}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add unit
              </Button>
            )}
          </div>
          {branch.units.length === 0 ? (
            <p className="text-label-secondary text-footnote py-2">
              No units yet. Units organise this branch&apos;s personnel into formations you can
              deploy.
            </p>
          ) : (
            <ul>
              {branch.units.map((unit) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  canEdit={canEdit}
                  onEdit={() => onEditUnit(unit)}
                  onDelete={() => onDeleteUnit(unit)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
