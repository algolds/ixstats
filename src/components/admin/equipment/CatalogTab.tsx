"use client";

// src/components/admin/equipment/CatalogTab.tsx
// Equipment Catalog tab: category tabs, filters, bulk actions, stats, equipment grid.

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Plus, Search, Check, Xmark as X, Filter, Rocket } from "iconoir-react";
import { CATEGORIES, SUBCATEGORIES, ERAS, CATEGORY_ICONS } from "~/lib/military/catalog-utils";
import { EquipmentCard } from "./EquipmentCard";
import { FacetCard } from "~/components/ui/facet-container";

interface CatalogTabProps {
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  eraFilter: string;
  setEraFilter: (value: string) => void;
  subcategoryFilter: string;
  setSubcategoryFilter: (value: string) => void;
  techLevelRange: [number, number];
  setTechLevelRange: (value: [number, number]) => void;
  costRange: [number, number];
  setCostRange: (value: [number, number]) => void;
  showInactive: boolean;
  setShowInactive: (value: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  equipmentData: any[] | undefined;
  filteredEquipment: any[];
  manufacturers: any[] | undefined;
  isLoading: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  handleBulkToggle: (isActive: boolean) => void;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  handleEdit: (equipment: any) => void;
  handleClone: (equipment: any) => void;
  handleDelete: (id: string, name: string) => void;
}

export function CatalogTab({
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  eraFilter,
  setEraFilter,
  subcategoryFilter,
  setSubcategoryFilter,
  techLevelRange,
  setTechLevelRange,
  costRange,
  setCostRange,
  showInactive,
  setShowInactive,
  selectedIds,
  setSelectedIds,
  equipmentData,
  filteredEquipment,
  manufacturers,
  isLoading,
  setIsAddDialogOpen,
  handleBulkToggle,
  toggleSelection,
  toggleSelectAll,
  handleEdit,
  handleClone,
  handleDelete,
}: CatalogTabProps) {
  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="bg-fill-3 rounded-row flex w-full flex-wrap justify-start gap-1 p-1">
          {Object.entries(CATEGORIES).map(([key, label]) => {
            const Icon = CATEGORY_ICONS[key] || Rocket;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-control text-caption flex items-center gap-2 px-3 py-1.5 transition-transform active:scale-[0.98]"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Advanced Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
          />
        </div>

        <Select value={eraFilter} onValueChange={setEraFilter}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="All Eras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-footnote">
              All Eras
            </SelectItem>
            {ERAS.map((era) => (
              <SelectItem key={era.value} value={era.value} className="text-footnote">
                {era.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="All Subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-footnote">
              All Subcategories
            </SelectItem>
            {selectedCategory !== "all" &&
              SUBCATEGORIES[selectedCategory as keyof typeof SUBCATEGORIES]?.map((sub) => (
                <SelectItem key={sub} value={sub} className="text-footnote capitalize">
                  {sub}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-1.5 px-2 select-none">
          <Checkbox
            id="showInactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked as boolean)}
            className="h-3.5 w-3.5"
          />
          <span>Show inactive</span>
        </label>
      </div>

      {/* Advanced Filters Row 2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Tech Level Range */}
        <div>
          <label className="text-label text-body mb-2 block font-medium">
            Tech Level: {techLevelRange[0]} - {techLevelRange[1]}
          </label>
          <Slider
            value={techLevelRange}
            onValueChange={(value) => setTechLevelRange(value as [number, number])}
            min={60}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Cost Range */}
        <div>
          <label className="text-label text-body mb-2 block font-medium">
            Acquisition Cost: ${(costRange[0] / 1000000).toFixed(1)}M - $
            {(costRange[1] / 1000000).toFixed(1)}M
          </label>
          <Slider
            value={costRange}
            onValueChange={(value) => setCostRange(value as [number, number])}
            min={0}
            max={10000000}
            step={100000}
            className="w-full"
          />
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="rounded-row border-red/30 bg-red/10 text-footnote flex items-center gap-3 border p-2.5">
          <span className="text-label font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkToggle(true)}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkToggle(false)}>
            <X className="mr-1 h-3.5 w-3.5" />
            Deactivate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Total Systems</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{equipmentData?.length || 0}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Active Registry</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {equipmentData?.filter((e: { isActive: boolean }) => e.isActive).length || 0}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Filtered Results</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">{filteredEquipment.length}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Manufacturers</p>
          <p className="text-title-2 text-indigo mt-1 tabular-nums">{manufacturers?.length || 0}</p>
        </FacetCard>
      </div>

      {/* Equipment Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="border-tint mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-label-secondary text-footnote">Loading equipment catalog...</p>
        </div>
      ) : filteredEquipment.length === 0 ? (
        <FacetCard className="p-12 text-center">
          <Filter className="text-label-secondary mx-auto mb-3 h-8 w-8" />
          <p className="text-label-secondary text-footnote">
            No defense equipment matching current filters.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add First Equipment
          </Button>
        </FacetCard>
      ) : (
        <>
          {/* Select All Checkbox */}
          <div className="mb-4 flex items-center gap-2">
            <Checkbox
              id="selectAll"
              checked={
                selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0
              }
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="selectAll" className="text-label text-body cursor-pointer">
              Select all ({filteredEquipment.length} items)
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEquipment.map((equipment: { id: string; name: string }) => (
              <EquipmentCard
                key={equipment.id}
                equipment={equipment}
                isSelected={selectedIds.has(equipment.id)}
                onToggleSelect={() => toggleSelection(equipment.id)}
                onEdit={() => handleEdit(equipment)}
                onClone={() => handleClone(equipment)}
                onDelete={() => handleDelete(equipment.id, equipment.name)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
