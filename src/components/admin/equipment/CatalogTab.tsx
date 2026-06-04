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
import { Card } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Plus, Search, Check, X, Filter, Rocket } from "lucide-react";
import {
  CATEGORIES,
  SUBCATEGORIES,
  ERAS,
  CATEGORY_ICONS,
} from "~/lib/equipment-catalog-utils";
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
    <div className="space-y-6">
      <div className="glass-card-parent rounded-xl border border-white/10 p-4">
        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-4">
          <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
            {Object.entries(CATEGORIES).map(([key, label]) => {
              const Icon = CATEGORY_ICONS[key] || Rocket;
              return (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Advanced Filters */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Era filter */}
          <Select value={eraFilter} onValueChange={setEraFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Eras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Eras</SelectItem>
              {ERAS.map((era) => (
                <SelectItem key={era.value} value={era.value}>
                  {era.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Subcategory filter */}
          <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcategories</SelectItem>
              {selectedCategory !== "all" &&
                SUBCATEGORIES[selectedCategory as keyof typeof SUBCATEGORIES]?.map((sub) => (
                  <SelectItem key={sub} value={sub} className="capitalize">
                    {sub}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Show inactive toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="showInactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked as boolean)}
            />
            <label htmlFor="showInactive" className="text-foreground cursor-pointer text-sm">
              Show inactive
            </label>
          </div>
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
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <span className="text-foreground text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => handleBulkToggle(true)}>
              <Check className="mr-2 h-4 w-4" />
              Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkToggle(false)}>
              <X className="mr-2 h-4 w-4" />
              Deactivate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="glass-card-child p-4">
          <p className="text-muted-foreground text-sm">Total Equipment</p>
          <p className="text-foreground mt-2 text-3xl font-bold">{equipmentData?.length || 0}</p>
        </Card>
        <Card className="glass-card-child p-4">
          <p className="text-muted-foreground text-sm">Active Equipment</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {equipmentData?.filter((e: { isActive: boolean }) => e.isActive).length || 0}
          </p>
        </Card>
        <Card className="glass-card-child p-4">
          <p className="text-muted-foreground text-sm">Filtered Results</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">{filteredEquipment.length}</p>
        </Card>
        <Card className="glass-card-child p-4">
          <p className="text-muted-foreground text-sm">Manufacturers</p>
          <p className="mt-2 text-3xl font-bold text-purple-400">{manufacturers?.length || 0}</p>
        </Card>
      </div>

      {/* Equipment Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-red-500"></div>
          <p className="text-muted-foreground">Loading equipment catalog...</p>
        </div>
      ) : filteredEquipment.length === 0 ? (
        <Card className="glass-card-parent p-12 text-center">
          <Filter className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No equipment found matching your filters</p>
          <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Equipment
          </Button>
        </Card>
      ) : (
        <>
          {/* Select All Checkbox */}
          <div className="mb-4 flex items-center gap-2">
            <Checkbox
              id="selectAll"
              checked={selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0}
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
