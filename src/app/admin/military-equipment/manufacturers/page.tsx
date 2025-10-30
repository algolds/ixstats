// src/app/admin/military-equipment/manufacturers/page.tsx
// Admin interface for managing defense manufacturers

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { MultiSelect } from "~/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/toast";
import { Badge } from "~/components/ui/badge";
import {
  Factory,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Globe,
  Package,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

interface Manufacturer {
  id: string;
  name: string;
  country: string;
  specialty: string | null;
  founded: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  equipment: {
    id: string;
    name: string;
    category: string;
    technologyTier: number;
  }[];
}

const SPECIALTIES = [
  "aircraft",
  "ships",
  "vehicles",
  "weapons",
  "missiles",
  "electronics",
  "radar",
  "communications",
  "naval",
  "aerospace",
  "armored-vehicles",
  "artillery",
  "small-arms",
  "submarines",
  "helicopters",
  "drones",
  "cyber-systems",
  "satellites",
] as const;

type SortField = "name" | "country" | "equipmentCount" | "founded";
type SortDirection = "asc" | "desc";

export default function ManufacturersPage() {
  usePageTitle({ title: "Defense Manufacturers Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    specialty: [] as string[],
    founded: undefined as number | undefined,
    description: "",
    isActive: true,
  });

  // Queries
  const {
    data: manufacturers,
    isLoading,
    refetch,
  } = api.militaryEquipment.getManufacturers.useQuery(
    {
      isActive: showInactive ? undefined : true,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const createMutation = api.militaryEquipment.createManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer created successfully",
        type: "success",
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create manufacturer",
        type: "error",
      });
    },
  });

  const updateMutation = api.militaryEquipment.updateManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer updated successfully",
        type: "success",
      });
      refetch();
      setEditingId(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manufacturer",
        type: "error",
      });
    },
  });

  // Get unique countries for filter
  const countries = useMemo(() => {
    if (!manufacturers) return [];
    const uniqueCountries = new Set(manufacturers.map((m) => m.country));
    return Array.from(uniqueCountries).sort();
  }, [manufacturers]);

  // Filtered and sorted manufacturers
  const filteredManufacturers = useMemo(() => {
    if (!manufacturers) return [];

    let filtered = manufacturers.filter((manufacturer) => {
      // Country filter
      if (countryFilter !== "all" && manufacturer.country !== countryFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          manufacturer.name.toLowerCase().includes(query) ||
          manufacturer.country.toLowerCase().includes(query) ||
          manufacturer.specialty?.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Add equipment count for sorting
    const withCounts = filtered.map((m) => ({
      ...m,
      equipmentCount: m.equipment?.length || 0,
    }));

    // Sort
    withCounts.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "country":
          comparison = a.country.localeCompare(b.country);
          break;
        case "equipmentCount":
          comparison = a.equipmentCount - b.equipmentCount;
          break;
        case "founded":
          comparison = (a.founded || 0) - (b.founded || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return withCounts;
  }, [manufacturers, countryFilter, searchQuery, sortField, sortDirection]);

  // Handlers
  const resetForm = () => {
    setFormData({
      name: "",
      country: "",
      specialty: [],
      founded: undefined,
      description: "",
      isActive: true,
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error",
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      country: formData.country,
      specialty: formData.specialty.length > 0 ? formData.specialty.join(", ") : undefined,
      founded: formData.founded,
      description: formData.description || undefined,
      isActive: formData.isActive,
    });
  };

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingId(manufacturer.id);
    setFormData({
      name: manufacturer.name,
      country: manufacturer.country,
      specialty: manufacturer.specialty
        ? manufacturer.specialty.split(", ").map((s) => s.trim())
        : [],
      founded: manufacturer.founded || undefined,
      description: manufacturer.description || "",
      isActive: manufacturer.isActive,
    });
    setIsAddDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name || !formData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error",
      });
      return;
    }

    updateMutation.mutate({
      id: editingId,
      name: formData.name,
      country: formData.country,
      specialty: formData.specialty.length > 0 ? formData.specialty.join(", ") : undefined,
      founded: formData.founded,
      description: formData.description || undefined,
      isActive: formData.isActive,
    });
  };

  const handleToggleActive = (manufacturer: Manufacturer) => {
    updateMutation.mutate({
      id: manufacturer.id,
      isActive: !manufacturer.isActive,
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const parseSpecialties = (specialty: string | null): string[] => {
    if (!specialty) return [];
    return specialty
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole =
    typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="glass-card-parent border-primary/20 from-primary/5 to-primary/10 mb-6 rounded-xl border-2 bg-gradient-to-br via-transparent p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 border-primary/20 rounded-xl border p-3">
                  <Factory className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                    Defense Manufacturers
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage military equipment manufacturers
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingId(null);
                resetForm();
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Manufacturer
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search manufacturers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show inactive toggle */}
            <Button
              variant={showInactive ? "default" : "outline"}
              onClick={() => setShowInactive(!showInactive)}
              className="w-full"
            >
              {showInactive ? (
                <ToggleRight className="mr-2 h-4 w-4" />
              ) : (
                <ToggleLeft className="mr-2 h-4 w-4" />
              )}
              {showInactive ? "Showing All" : "Active Only"}
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
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground">Loading manufacturers...</p>
            </div>
          ) : filteredManufacturers.length === 0 ? (
            <div className="py-12 text-center">
              <Filter className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No manufacturers found</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                  setIsAddDialogOpen(true);
                }}
              >
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
                    const specialties = parseSpecialties(manufacturer.specialty);
                    const equipmentCount = manufacturer.equipment?.length || 0;

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
                              onClick={() => handleEdit(manufacturer)}
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
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="glass-card-child border-border/50 rounded-lg border p-4">
            <div className="text-foreground text-2xl font-bold">{manufacturers?.length || 0}</div>
            <div className="text-muted-foreground text-sm">Total Manufacturers</div>
          </div>
          <div className="glass-card-child border-border/50 rounded-lg border p-4">
            <div className="text-foreground text-2xl font-bold">
              {manufacturers?.filter((m) => m.isActive).length || 0}
            </div>
            <div className="text-muted-foreground text-sm">Active</div>
          </div>
          <div className="glass-card-child border-border/50 rounded-lg border p-4">
            <div className="text-foreground text-2xl font-bold">{countries.length}</div>
            <div className="text-muted-foreground text-sm">Countries</div>
          </div>
          <div className="glass-card-child border-border/50 rounded-lg border p-4">
            <div className="text-foreground text-2xl font-bold">
              {manufacturers?.reduce((sum, m) => sum + (m.equipment?.length || 0), 0) || 0}
            </div>
            <div className="text-muted-foreground text-sm">Total Equipment</div>
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingId(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Add"} Manufacturer</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update manufacturer information"
                  : "Create a new defense manufacturer"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lockheed Martin"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Country *</label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g., United States"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Specialties
                </label>
                <MultiSelect
                  options={SPECIALTIES}
                  value={formData.specialty}
                  onChange={(value) => setFormData({ ...formData, specialty: value })}
                  placeholder="Select specialties..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Founded</label>
                <Input
                  type="number"
                  value={formData.founded || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      founded: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g., 1995"
                  min="1800"
                  max="2100"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="border-border rounded"
                />
                <label
                  htmlFor="isActive"
                  className="text-foreground cursor-pointer text-sm font-medium"
                >
                  Active
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={
                  !formData.name ||
                  !formData.country ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
