"use client";

import React from "react";
import { Search } from "iconoir-react";
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
import { Card } from "~/components/ui/card";

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
    <Card
      variant="inset"
      padding="sm"
      onClick={() => onSelect(equipment)}
      className="flex w-full items-start gap-3 text-left"
      interactive
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="rounded-control-sm h-14 w-20 shrink-0 object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h5 className="text-label text-body font-medium">{equipment.name}</h5>
          <Badge variant="outline">{equipment.category}</Badge>
          <Badge variant="default">{era?.label.split(" ")[0]}</Badge>
        </div>
        <p className="text-label-secondary text-footnote">
          {manufacturer ? `${manufacturer.name} • ${manufacturer.country}` : equipment.manufacturer}
        </p>
        <div className="text-footnote mt-2 flex items-center gap-4">
          <span>
            <span className="text-label-secondary">Cost:</span> $
            <NumberFlowDisplay value={equipment.acquisitionCost ?? 0} format="compact" />
          </span>
          {equipment.range && (
            <span>
              <span className="text-label-secondary">Range:</span> {equipment.range} km
            </span>
          )}
        </div>
      </div>
      <span className="text-label border-separator rounded-control-sm text-caption shrink-0 border px-3 py-2">
        Select
      </span>
    </Card>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search equipment..."
            className="pl-9"
          />
        </div>
        <Select value={selectedEra} onValueChange={onSelectedEraChange}>
          <SelectTrigger>
            <SelectValue placeholder="All eras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All eras</SelectItem>
            {Object.entries(MILITARY_ERAS).map(([key, era]) => (
              <SelectItem key={key} value={key}>
                {era.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedManufacturer} onValueChange={onSelectedManufacturerChange}>
          <SelectTrigger>
            <SelectValue placeholder="All manufacturers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All manufacturers</SelectItem>
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
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="rounded-control h-20" />
          ))}
        {equipment.map((item) => (
          <EquipmentRow
            key={item.key}
            equipment={item}
            manufacturer={item.manufacturer ? manufacturersByKey.get(item.manufacturer) : undefined}
            onSelect={onSelect}
          />
        ))}
        {!isLoading && equipment.length === 0 && (
          <div className="text-label-secondary text-body py-6 text-center">
            No equipment found matching your criteria
          </div>
        )}
      </div>
    </>
  );
});
