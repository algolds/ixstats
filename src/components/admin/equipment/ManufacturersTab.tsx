"use client";

// src/components/admin/equipment/ManufacturersTab.tsx
// Manufacturers tab: filters, sortable table, and aggregate stats.

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import {
  Plus,
  Pencil,
  Search,
  Filter,
  Globe,
  ToggleLeft,
  ToggleRight,
  ArrowUpDown,
  Package,
} from "lucide-react";
import {
  parseSpecialties,
  type Manufacturer,
  type ManufacturerWithCount,
  type SortField,
} from "~/lib/military/manufacturer-utils";

interface ManufacturersTabProps {
  manufacturerSearchQuery: string;
  setManufacturerSearchQuery: (value: string) => void;
  countryFilter: string;
  setCountryFilter: (value: string) => void;
  showInactiveManufacturers: boolean;
  setShowInactiveManufacturers: (value: boolean) => void;
  countries: string[];
  normalizedManufacturers: Manufacturer[];
  filteredManufacturers: ManufacturerWithCount[];
  manufacturersLoading: boolean;
  onAddManufacturer: () => void;
  handleSort: (field: SortField) => void;
  handleEditManufacturer: (manufacturer: Manufacturer) => void;
  handleToggleActive: (manufacturer: Manufacturer) => void;
}

export function ManufacturersTab({
  manufacturerSearchQuery,
  setManufacturerSearchQuery,
  countryFilter,
  setCountryFilter,
  showInactiveManufacturers,
  setShowInactiveManufacturers,
  countries,
  normalizedManufacturers,
  filteredManufacturers,
  manufacturersLoading,
  onAddManufacturer,
  handleSort,
  handleEditManufacturer,
  handleToggleActive,
}: ManufacturersTabProps) {
  return (
    <div className="space-y-6">
      <div className="glass-card-parent rounded-xl border border-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-xl font-bold">Defense Manufacturers</h2>
          <Button
            onClick={onAddManufacturer}
            className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Manufacturer
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search manufacturers..."
              value={manufacturerSearchQuery}
              onChange={(e) => setManufacturerSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Country filter */}
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger>
              <Globe className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map((country: string) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show inactive toggle */}
          <Button
            variant={showInactiveManufacturers ? "default" : "outline"}
            onClick={() => setShowInactiveManufacturers(!showInactiveManufacturers)}
            className="w-full"
          >
            {showInactiveManufacturers ? (
              <ToggleRight className="mr-2 h-4 w-4" />
            ) : (
              <ToggleLeft className="mr-2 h-4 w-4" />
            )}
            {showInactiveManufacturers ? "Showing All" : "Active Only"}
          </Button>

          {/* Stats placeholder */}
          <div className="bg-primary/5 border-primary/20 flex items-center justify-center rounded-md border px-4 py-2">
            <Package className="text-primary mr-2 h-4 w-4" />
            <span className="text-sm font-medium">
              {filteredManufacturers.length} manufacturers
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card-child border-border/50 rounded-xl border p-6">
        {manufacturersLoading ? (
          <div className="py-12 text-center">
            <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading manufacturers...</p>
          </div>
        ) : filteredManufacturers.length === 0 ? (
          <div className="py-12 text-center">
            <Filter className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No manufacturers found</p>
            <Button className="mt-4" onClick={onAddManufacturer}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Manufacturer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("name")}
                      className="hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("country")}
                      className="hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Country
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("founded")}
                      className="hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Founded
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("equipmentCount")}
                      className="hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Equipment
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManufacturers.map((manufacturer) => {
                  const specialties = parseSpecialties(manufacturer.specialty ?? null);
                  const equipmentCount = manufacturer.equipmentCount ?? 0;

                  return (
                    <TableRow key={manufacturer.id}>
                      <TableCell className="font-medium">{manufacturer.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="text-muted-foreground h-3 w-3" />
                          {manufacturer.country}
                        </div>
                      </TableCell>
                      <TableCell>
                        {specialties.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {specialties.slice(0, 3).map((spec) => (
                              <Badge key={spec} variant="secondary" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                            {specialties.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{specialties.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {manufacturer.founded ? (
                          <span className="text-sm">{manufacturer.founded}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="text-muted-foreground h-3 w-3" />
                          <span className="text-sm font-medium">{equipmentCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {manufacturer.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditManufacturer(manufacturer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(manufacturer)}
                          >
                            {manufacturer.isActive ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="glass-card-child border-border/50 rounded-lg border p-4">
          <div className="text-foreground text-2xl font-bold">{normalizedManufacturers.length}</div>
          <div className="text-muted-foreground text-sm">Total Manufacturers</div>
        </div>
        <div className="glass-card-child border-border/50 rounded-lg border p-4">
          <div className="text-foreground text-2xl font-bold">
            {normalizedManufacturers.filter((m) => m.isActive).length}
          </div>
          <div className="text-muted-foreground text-sm">Active</div>
        </div>
        <div className="glass-card-child border-border/50 rounded-lg border p-4">
          <div className="text-foreground text-2xl font-bold">{countries.length}</div>
          <div className="text-muted-foreground text-sm">Countries</div>
        </div>
        <div className="glass-card-child border-border/50 rounded-lg border p-4">
          <div className="text-foreground text-2xl font-bold">
            {normalizedManufacturers.reduce((sum, m) => sum + (m.equipment?.length ?? 0), 0)}
          </div>
          <div className="text-muted-foreground text-sm">Total Equipment</div>
        </div>
      </div>
    </div>
  );
}
