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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { MultiSelect } from "~/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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
  ArrowUpDown
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
  'aircraft',
  'ships',
  'vehicles',
  'weapons',
  'missiles',
  'electronics',
  'radar',
  'communications',
  'naval',
  'aerospace',
  'armored-vehicles',
  'artillery',
  'small-arms',
  'submarines',
  'helicopters',
  'drones',
  'cyber-systems',
  'satellites'
] as const;

type SortField = 'name' | 'country' | 'equipmentCount' | 'founded';
type SortDirection = 'asc' | 'desc';

export default function ManufacturersPage() {
  usePageTitle({ title: "Defense Manufacturers Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    specialty: [] as string[],
    founded: undefined as number | undefined,
    description: '',
    isActive: true
  });

  // Queries
  const { data: manufacturers, isLoading, refetch } = api.militaryEquipment.getManufacturers.useQuery(
    {
      isActive: showInactive ? undefined : true
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
        type: "success"
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create manufacturer",
        type: "error"
      });
    }
  });

  const updateMutation = api.militaryEquipment.updateManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer updated successfully",
        type: "success"
      });
      refetch();
      setEditingId(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manufacturer",
        type: "error"
      });
    }
  });

  // Get unique countries for filter
  const countries = useMemo(() => {
    if (!manufacturers) return [];
    const uniqueCountries = new Set(manufacturers.map(m => m.country));
    return Array.from(uniqueCountries).sort();
  }, [manufacturers]);

  // Filtered and sorted manufacturers
  const filteredManufacturers = useMemo(() => {
    if (!manufacturers) return [];

    let filtered = manufacturers.filter(manufacturer => {
      // Country filter
      if (countryFilter !== 'all' && manufacturer.country !== countryFilter) return false;

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
    const withCounts = filtered.map(m => ({
      ...m,
      equipmentCount: m.equipment?.length || 0
    }));

    // Sort
    withCounts.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'country':
          comparison = a.country.localeCompare(b.country);
          break;
        case 'equipmentCount':
          comparison = a.equipmentCount - b.equipmentCount;
          break;
        case 'founded':
          comparison = (a.founded || 0) - (b.founded || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return withCounts;
  }, [manufacturers, countryFilter, searchQuery, sortField, sortDirection]);

  // Handlers
  const resetForm = () => {
    setFormData({
      name: '',
      country: '',
      specialty: [],
      founded: undefined,
      description: '',
      isActive: true
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error"
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      country: formData.country,
      specialty: formData.specialty.length > 0 ? formData.specialty.join(', ') : undefined,
      founded: formData.founded,
      description: formData.description || undefined,
      isActive: formData.isActive
    });
  };

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingId(manufacturer.id);
    setFormData({
      name: manufacturer.name,
      country: manufacturer.country,
      specialty: manufacturer.specialty ? manufacturer.specialty.split(', ').map(s => s.trim()) : [],
      founded: manufacturer.founded || undefined,
      description: manufacturer.description || '',
      isActive: manufacturer.isActive
    });
    setIsAddDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name || !formData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error"
      });
      return;
    }

    updateMutation.mutate({
      id: editingId,
      name: formData.name,
      country: formData.country,
      specialty: formData.specialty.length > 0 ? formData.specialty.join(', ') : undefined,
      founded: formData.founded,
      description: formData.description || undefined,
      isActive: formData.isActive
    });
  };

  const handleToggleActive = (manufacturer: Manufacturer) => {
    updateMutation.mutate({
      id: manufacturer.id,
      isActive: !manufacturer.isActive
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const parseSpecialties = (specialty: string | null): string[] => {
    if (!specialty) return [];
    return specialty.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole = typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass-card-parent p-6 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Factory className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Defense Manufacturers
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage military equipment manufacturers
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => { setEditingId(null); resetForm(); setIsAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manufacturer
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show inactive toggle */}
            <Button
              variant={showInactive ? "default" : "outline"}
              onClick={() => setShowInactive(!showInactive)}
              className="w-full"
            >
              {showInactive ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
              {showInactive ? "Showing All" : "Active Only"}
            </Button>

            {/* Stats placeholder */}
            <div className="flex items-center justify-center px-4 py-2 rounded-md bg-primary/5 border border-primary/20">
              <Package className="h-4 w-4 mr-2 text-primary" />
              <span className="text-sm font-medium">
                {filteredManufacturers.length} manufacturers
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card-child p-6 rounded-xl border border-border/50">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading manufacturers...</p>
            </div>
          ) : filteredManufacturers.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No manufacturers found</p>
              <Button className="mt-4" onClick={() => { setEditingId(null); resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
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
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('country')}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Country
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Specialties</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('founded')}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Founded
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('equipmentCount')}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
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
                            <Globe className="h-3 w-3 text-muted-foreground" />
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
                            <span className="text-sm text-muted-foreground italic">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {manufacturer.founded ? (
                            <span className="text-sm">{manufacturer.founded}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">{equipmentCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {manufacturer.isActive ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
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
                              {manufacturer.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
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
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">{manufacturers?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Manufacturers</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {manufacturers?.filter(m => m.isActive).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {countries.length}
            </div>
            <div className="text-sm text-muted-foreground">Countries</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {manufacturers?.reduce((sum, m) => sum + (m.equipment?.length || 0), 0) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Equipment</div>
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingId(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Manufacturer</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update manufacturer information' : 'Create a new defense manufacturer'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lockheed Martin"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Country *</label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g., United States"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Specialties</label>
                <MultiSelect
                  options={SPECIALTIES}
                  value={formData.specialty}
                  onChange={(value) => setFormData({ ...formData, specialty: value })}
                  placeholder="Select specialties..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Founded</label>
                <Input
                  type="number"
                  value={formData.founded || ''}
                  onChange={(e) => setFormData({ ...formData, founded: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g., 1995"
                  min="1800"
                  max="2100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
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
                  className="rounded border-border"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer">
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
                disabled={!formData.name || !formData.country || createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
