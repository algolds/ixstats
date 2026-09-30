"use client";

import React from "react";
import { Search } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Skeleton } from "~/components/ui/skeleton";
import { MILITARY_ERAS } from "~/lib/military/equipment";
import type { CatalogManufacturer } from "~/lib/military/player-catalog";
import type { EquipmentPreset } from "./asset-config";

interface EquipmentBrowserProps {
  equipment: EquipmentPreset[];
  manufacturers: CatalogManufacturer[];
  isLoading?: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedEra: string;
  onSelectedEraChange: (value: string) => void;
  selectedManufacturer: string;
  onSelectedManufacturerChange: (value: string) => void;
  onSelect: (equipment: EquipmentPreset) => void;
}

function EquipmentRow({
  equipment,
  manufacturer,
  onSelect,
}: {
  equipment: EquipmentPreset;
  manufacturer: CatalogManufacturer | undefined;
  onSelect: (equipment: EquipmentPreset) => void;
}) {
  const era = MILITARY_ERAS[equipment.era as keyof typeof MILITARY_ERAS];
  const imageUrl = equipment.imageUrl;

  return (
    <div
      className="hover:border-primary/50 group relative cursor-pointer overflow-hidden rounded-lg border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
      onClick={() => onSelect(equipment)}
    >
      {/* Background Image with Glass Blur Effect */}
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 transition-opacity group-hover:opacity-30"
          style={{
            backgroundImage: `url(${imageUrl})`,
          }}
        />
      )}

      {/* Glass Overlay */}
      <div className="bg-background/80 relative p-3 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h5 className="text-sm font-medium">{equipment.name}</h5>
              <Badge variant="outline" className="text-xs">
                {equipment.category}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {era?.label.split(" ")[0]}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {manufacturer
                ? `${manufacturer.name} • ${manufacturer.country}`
                : equipment.manufacturer}
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs">
              <span>
                <span className="text-muted-foreground">Cost:</span> $
                <NumberFlowDisplay value={equipment.acquisitionCost ?? 0} format="compact" />
              </span>
              {equipment.range && (
                <span>
                  <span className="text-muted-foreground">Range:</span> {equipment.range} km
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline">
            Select
          </Button>
        </div>
      </div>
    </div>
  );
}

export const EquipmentBrowser = React.memo(function EquipmentBrowser({
  equipment,
  manufacturers,
  isLoading = false,
  searchQuery,
  onSearchQueryChange,
  selectedEra,
  onSelectedEraChange,
  selectedManufacturer,
  onSelectedManufacturerChange,
  onSelect,
}: EquipmentBrowserProps) {
  const manufacturersByKey = React.useMemo(
    () => new Map(manufacturers.map((mfg) => [mfg.key, mfg])),
    [manufacturers]
  );

  return (
    <>
      {/* Search and Filters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search equipment..."
            className="pl-9"
          />
        </div>
        <Select value={selectedEra} onValueChange={onSelectedEraChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Eras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Eras</SelectItem>
            {Object.entries(MILITARY_ERAS).map(([key, era]) => (
              <SelectItem key={key} value={key}>
                {era.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedManufacturer} onValueChange={onSelectedManufacturerChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Manufacturers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Manufacturers</SelectItem>
            {manufacturers.map((mfg) => (
              <SelectItem key={mfg.key} value={mfg.key}>
                {mfg.name} ({mfg.country})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Equipment List */}
      <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        {equipment.map((item) => (
          <EquipmentRow
            key={item.key}
            equipment={item}
            manufacturer={item.manufacturer ? manufacturersByKey.get(item.manufacturer) : undefined}
            onSelect={onSelect}
          />
        ))}
        {!isLoading && equipment.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-sm">
            No equipment found matching your criteria
          </div>
        )}
      </div>
    </>
  );
});
