"use client";

// src/components/admin/equipment/EquipmentCard.tsx
// Single equipment catalog card with selection, edit, clone, delete actions.

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  EditPencil as Pencil,
  Copy,
  Trash as Trash2,
  EyeClosed as EyeOff,
  Rocket,
} from "iconoir-react";
import { CATEGORY_ICONS } from "~/lib/military/catalog-utils";

interface EquipmentCardProps {
  equipment: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function EquipmentCard({
  equipment,
  isSelected,
  onToggleSelect,
  onEdit,
  onClone,
  onDelete,
}: EquipmentCardProps) {
  const Icon = CATEGORY_ICONS[equipment.category] || Rocket;

  return (
    <Card
      className={`facet-card-child p-4 transition-all hover:border-red-500/50 ${isSelected ? "ring-2 ring-red-500" : ""}`}
    >
      {/* Selection & Image */}
      <div className="mb-3 flex items-start justify-between">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        {equipment.imageUrl ? (
          <img
            src={equipment.imageUrl}
            alt={equipment.name}
            className="h-16 w-16 rounded-lg border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Icon className="text-muted-foreground h-8 w-8" />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-2">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-foreground line-clamp-1 flex-1 font-semibold">{equipment.name}</h3>
          {!equipment.isActive && (
            <EyeOff className="h-4 w-4 shrink-0 text-red-400" aria-label="Inactive" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400 capitalize">
            {equipment.category}
          </span>
          {equipment.subcategory && (
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400 capitalize">
              {equipment.subcategory}
            </span>
          )}
        </div>
      </div>

      {/* Key Info */}
      <div className="mb-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Manufacturer:</span>
          <span className="text-foreground font-medium">{equipment.manufacturer}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Era:</span>
          <span className="text-foreground font-medium">{equipment.era}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tech Level:</span>
          <span className="text-foreground font-medium">{equipment.technologyLevel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Acquisition:</span>
          <span className="text-foreground font-medium">
            ${(equipment.acquisitionCost / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Maintenance:</span>
          <span className="text-foreground font-medium">
            ${(equipment.maintenanceCost / 1000).toFixed(0)}K/yr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Crew:</span>
          <span className="text-foreground font-medium">{equipment.crewRequirement}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Usage:</span>
          <span className="text-foreground font-medium">{equipment.usageCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/10 pt-3">
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
