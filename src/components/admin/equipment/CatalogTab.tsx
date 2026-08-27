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
        <TabsList className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          {Object.entries(CATEGORIES).map(([key, label]) => {
            const Icon = CATEGORY_ICONS[key] || Rocket;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
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
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
          />
        </div>

        <Select value={eraFilter} onValueChange={setEraFilter}>
          <SelectTrigger className="border-border/30 bg-background/50 h-8 w-36 rounded-xl text-xs backdrop-blur-md">
            <SelectValue placeholder="All Eras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Eras
            </SelectItem>
            {ERAS.map((era) => (
              <SelectItem key={era.value} value={era.value} className="text-xs">
                {era.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
          <SelectTrigger className="border-border/30 bg-background/50 h-8 w-40 rounded-xl text-xs backdrop-blur-md">
            <SelectValue placeholder="All Subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Subcategories
            </SelectItem>
            {selectedCategory !== "all" &&
              SUBCATEGORIES[selectedCategory as keyof typeof SUBCATEGORIES]?.map((sub) => (
                <SelectItem key={sub} value={sub} className="text-xs capitalize">
                  {sub}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2 text-xs select-none">
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
          <label className="text-foreground mb-2 block text-sm font-medium">
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
          <label className="text-foreground mb-2 block text-sm font-medium">
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
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs">
          <span className="text-foreground font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkToggle(true)}
            className="h-7 px-2 text-xs active:scale-[0.98]"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkToggle(false)}
            className="h-7 px-2 text-xs active:scale-[0.98]"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Deactivate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-7 px-2 text-xs active:scale-[0.98]"
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Systems
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {equipmentData?.length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Registry
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {equipmentData?.filter((e: { isActive: boolean }) => e.isActive).length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Filtered Results
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {filteredEquipment.length}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Manufacturers
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
            {manufacturers?.length || 0}
          </p>
        </div>
      </div>

      {/* Equipment Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground text-xs">Loading equipment catalog...</p>
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
          <Filter className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-xs">
            No defense equipment matching current filters.
          </p>
          <Button
            size="sm"
            className="mt-4 h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add First Equipment
          </Button>
        </div>
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
            <label htmlFor="selectAll" className="text-foreground cursor-pointer text-sm">
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
