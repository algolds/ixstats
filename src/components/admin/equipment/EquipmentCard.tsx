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
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils/cn";

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
      className={cn(
        "flex flex-col gap-6 py-6",
        `hover:border-red/50 p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${isSelected ? "ring-red ring-2" : ""}`
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        {equipment.imageUrl ? (
          <img
            src={equipment.imageUrl}
            alt={equipment.name}
            className="rounded-control border-separator h-16 w-16 border object-cover"
          />
        ) : (
          <div className="rounded-control border-separator bg-fill-4 flex h-16 w-16 items-center justify-center border">
            <Icon className="text-label-secondary h-8 w-8" />
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-label line-clamp-1 flex-1 font-semibold">{equipment.name}</h3>
          {!equipment.isActive && (
            <EyeOff className="text-red h-4 w-4 shrink-0" aria-label="Inactive" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="capitalize">
            {equipment.category}
          </Badge>
          {equipment.subcategory && (
            <Badge variant="info" className="capitalize">
              {equipment.subcategory}
            </Badge>
          )}
        </div>
      </div>

      <div className="text-footnote mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Manufacturer:</span>
          <span className="text-label font-medium">{equipment.manufacturer}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Era:</span>
          <span className="text-label font-medium">{equipment.era}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Tech Level:</span>
          <span className="text-label font-medium">{equipment.technologyLevel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Acquisition:</span>
          <span className="text-label font-medium">
            ${(equipment.acquisitionCost / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Maintenance:</span>
          <span className="text-label font-medium">
            ${(equipment.maintenanceCost / 1000).toFixed(0)}K/yr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Crew:</span>
          <span className="text-label font-medium">{equipment.crewRequirement}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label-secondary">Usage:</span>
          <span className="text-label font-medium">{equipment.usageCount}</span>
        </div>
      </div>

      <div className="border-separator flex items-center gap-2 border-t pt-3">
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
