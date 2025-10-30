// src/app/admin/military-equipment/page.tsx
// Admin interface for managing military equipment catalog

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  Copy,
  Check,
  X,
  Plane,
  Ship,
  Car,
  Rocket,
  Wrench,
  Users,
  DollarSign,
  Settings,
  Image,
  FileText,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

// Equipment categories
const CATEGORIES = {
  all: "All Equipment",
  aircraft: "Aircraft",
  ship: "Ships",
  vehicle: "Vehicles",
  weapon: "Weapons",
  support: "Support Equipment",
};

const SUBCATEGORIES = {
  aircraft: ["fighter", "bomber", "transport", "helicopter", "uav", "trainer"],
  ship: ["carrier", "destroyer", "frigate", "submarine", "corvette", "amphibious"],
  vehicle: ["tank", "ifv", "apc", "artillery", "mlrs", "engineering"],
  weapon: ["missile", "radar", "sam", "anti-tank", "small-arms", "naval-gun"],
  support: ["logistics", "medical", "command", "reconnaissance", "electronic-warfare"],
};

const ERAS = [
  { value: "COLD_WAR", label: "Cold War" },
  { value: "MODERN", label: "Modern" },
  { value: "CONTEMPORARY", label: "Contemporary" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "NEXT_GEN", label: "Next Generation" },
];

const CATEGORY_ICONS: Record<string, any> = {
  aircraft: Plane,
  ship: Ship,
  vehicle: Car,
  weapon: Rocket,
  support: Wrench,
};

interface EquipmentFormData {
  key: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  era: string;
  specifications: Record<string, any>;
  capabilities: Record<string, any>;
  acquisitionCost: number;
  maintenanceCost: number;
  technologyLevel: number;
  crewRequirement: number;
  maintenanceHours: number;
  imageUrl: string;
  description: string;
  historicalContext: string;
  isActive: boolean;
}

export default function MilitaryEquipmentPage() {
  usePageTitle({ title: "Military Equipment Catalog Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [eraFilter, setEraFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [techLevelRange, setTechLevelRange] = useState<[number, number]>([60, 100]);
  const [costRange, setCostRange] = useState<[number, number]>([0, 10000000]);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Form state
  const [formData, setFormData] = useState<EquipmentFormData>({
    key: "",
    name: "",
    manufacturer: "",
    category: "aircraft",
    subcategory: "fighter",
    era: "MODERN",
    specifications: {},
    capabilities: {},
    acquisitionCost: 1000000,
    maintenanceCost: 100000,
    technologyLevel: 80,
    crewRequirement: 1,
    maintenanceHours: 100,
    imageUrl: "",
    description: "",
    historicalContext: "",
    isActive: true,
  });

  // Queries
  const {
    data: equipmentData,
    isLoading,
    refetch,
  } = api.militaryEquipment.getAllCatalogEquipment.useQuery(
    {
      includeInactive: showInactive,
      category: selectedCategory !== "all" ? (selectedCategory as any) : undefined,
      era: eraFilter !== "all" ? (eraFilter as any) : undefined,
      search: searchQuery || undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: manufacturers } = api.militaryEquipment.getManufacturers.useQuery(
    { isActive: true },
    { refetchOnWindowFocus: false }
  );

  // Mutations
  const createMutation = api.militaryEquipment.createCatalogEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment created successfully",
        type: "success",
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create equipment",
        type: "error",
      });
    },
  });

  const updateMutation = api.militaryEquipment.updateCatalogEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment updated successfully",
        type: "success",
      });
      refetch();
      setEditingEquipment(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update equipment",
        type: "error",
      });
    },
  });

  const deleteMutation = api.militaryEquipment.deleteCatalogEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment deactivated successfully",
        type: "success",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate equipment",
        type: "error",
      });
    },
  });

  const bulkToggleMutation = api.militaryEquipment.bulkToggleEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bulk operation completed successfully",
        type: "success",
      });
      refetch();
      setSelectedIds(new Set());
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete bulk operation",
        type: "error",
      });
    },
  });

  // Filter equipment
  const filteredEquipment = useMemo(() => {
    if (!equipmentData) return [];

    return equipmentData.filter((item) => {
      // Subcategory filter
      if (subcategoryFilter !== "all" && item.subcategory !== subcategoryFilter) return false;

      // Tech level filter
      if (item.technologyLevel < techLevelRange[0] || item.technologyLevel > techLevelRange[1])
        return false;

      // Cost filter
      if (item.acquisitionCost < costRange[0] || item.acquisitionCost > costRange[1]) return false;

      return true;
    });
  }, [equipmentData, subcategoryFilter, techLevelRange, costRange]);

  // Handlers
  const resetForm = () => {
    setFormData({
      key: "",
      name: "",
      manufacturer: "",
      category: "aircraft",
      subcategory: "fighter",
      era: "MODERN",
      specifications: {},
      capabilities: {},
      acquisitionCost: 1000000,
      maintenanceCost: 100000,
      technologyLevel: 80,
      crewRequirement: 1,
      maintenanceHours: 100,
      imageUrl: "",
      description: "",
      historicalContext: "",
      isActive: true,
    });
    setActiveTab("general");
  };

  const handleCreate = () => {
    createMutation.mutate({
      key: formData.key,
      name: formData.name,
      manufacturer: formData.manufacturer,
      category: formData.category as any,
      subcategory: formData.subcategory,
      era: formData.era as any,
      specifications: formData.specifications,
      capabilities: formData.capabilities,
      acquisitionCost: formData.acquisitionCost,
      maintenanceCost: formData.maintenanceCost,
      technologyLevel: formData.technologyLevel,
      crewRequirement: formData.crewRequirement,
      maintenanceHours: formData.maintenanceHours,
      imageUrl: formData.imageUrl || undefined,
      description: formData.description || undefined,
      historicalContext: formData.historicalContext || undefined,
      isActive: formData.isActive,
    } as any);
  };

  const handleUpdate = () => {
    if (!editingEquipment?.id) return;

    updateMutation.mutate({
      id: editingEquipment.id,
      name: formData.name,
      category: formData.category as any,
      subcategory: formData.subcategory,
      era: formData.era as any,
      manufacturer: formData.manufacturer,
      specifications: formData.specifications,
      capabilities: formData.capabilities,
      acquisitionCost: formData.acquisitionCost,
      maintenanceCost: formData.maintenanceCost,
      technologyLevel: formData.technologyLevel,
      crewRequirement: formData.crewRequirement,
      maintenanceHours: formData.maintenanceHours,
      imageUrl: formData.imageUrl || undefined,
      description: formData.description || undefined,
      historicalContext: formData.historicalContext || undefined,
      isActive: formData.isActive,
    } as any);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (equipment: any) => {
    setFormData({
      key: equipment.key,
      name: equipment.name,
      manufacturer: equipment.manufacturer,
      category: equipment.category,
      subcategory: equipment.subcategory || "",
      era: equipment.era,
      specifications: equipment.specifications || {},
      capabilities: equipment.capabilities || {},
      acquisitionCost: equipment.acquisitionCost,
      maintenanceCost: equipment.maintenanceCost,
      technologyLevel: equipment.technologyLevel,
      crewRequirement: equipment.crewRequirement,
      maintenanceHours: equipment.maintenanceHours || 0,
      imageUrl: equipment.imageUrl || "",
      description: equipment.description || "",
      historicalContext: equipment.historicalContext || "",
      isActive: equipment.isActive,
    });
    setEditingEquipment(equipment);
    setActiveTab("general");
  };

  const handleClone = (equipment: any) => {
    setFormData({
      key: `${equipment.key}_COPY`,
      name: `${equipment.name} (Copy)`,
      manufacturer: equipment.manufacturer,
      category: equipment.category,
      subcategory: equipment.subcategory || "",
      era: equipment.era,
      specifications: equipment.specifications || {},
      capabilities: equipment.capabilities || {},
      acquisitionCost: equipment.acquisitionCost,
      maintenanceCost: equipment.maintenanceCost,
      technologyLevel: equipment.technologyLevel,
      crewRequirement: equipment.crewRequirement,
      maintenanceHours: equipment.maintenanceHours || 0,
      imageUrl: equipment.imageUrl || "",
      description: equipment.description || "",
      historicalContext: equipment.historicalContext || "",
      isActive: true,
    });
    setIsAddDialogOpen(true);
    setActiveTab("general");
  };

  const handleBulkToggle = (isActive: boolean) => {
    if (selectedIds.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one equipment item",
        type: "warning",
      });
      return;
    }

    bulkToggleMutation.mutate({
      equipmentIds: Array.from(selectedIds),
      isActive,
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEquipment.map((e) => e.id)));
    }
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading...</p>
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
        <div className="glass-card-parent mb-6 rounded-xl border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <Rocket className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                    Military Equipment Catalog
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage equipment catalog for procurement system
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </div>

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
              <span className="text-foreground text-sm font-medium">
                {selectedIds.size} selected
              </span>
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
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="glass-card-child p-4">
            <p className="text-muted-foreground text-sm">Total Equipment</p>
            <p className="text-foreground mt-2 text-3xl font-bold">{equipmentData?.length || 0}</p>
          </Card>
          <Card className="glass-card-child p-4">
            <p className="text-muted-foreground text-sm">Active Equipment</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {equipmentData?.filter((e) => e.isActive).length || 0}
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
              {filteredEquipment.map((equipment) => (
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

        {/* Equipment Editor Dialog */}
        {(isAddDialogOpen || editingEquipment) && (
          <EquipmentEditorDialog
            isOpen={isAddDialogOpen || !!editingEquipment}
            isEditing={!!editingEquipment}
            formData={formData}
            setFormData={setFormData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            manufacturers={manufacturers || []}
            onClose={() => {
              setIsAddDialogOpen(false);
              setEditingEquipment(null);
              resetForm();
            }}
            onSave={editingEquipment ? handleUpdate : handleCreate}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// Equipment Card Component
interface EquipmentCardProps {
  equipment: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function EquipmentCard({
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
      className={`glass-card-child p-4 transition-all hover:border-red-500/50 ${isSelected ? "ring-2 ring-red-500" : ""}`}
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
            <EyeOff className="h-4 w-4 shrink-0 text-red-400" title="Inactive" />
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

// Equipment Editor Dialog
interface EquipmentEditorDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  manufacturers: any[];
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

function EquipmentEditorDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  manufacturers,
  onClose,
  onSave,
  isPending,
}: EquipmentEditorDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "specifications", label: "Specifications", icon: FileText },
    { id: "capabilities", label: "Capabilities", icon: Rocket },
    { id: "costs", label: "Costs & Requirements", icon: DollarSign },
    { id: "media", label: "Media & Documentation", icon: Image },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
          <DialogDescription>Configure military equipment catalog entry</DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <TabsContent value="general">
              <GeneralTab
                formData={formData}
                setFormData={setFormData}
                manufacturers={manufacturers}
                isEditing={isEditing}
              />
            </TabsContent>
            <TabsContent value="specifications">
              <SpecificationsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="capabilities">
              <CapabilitiesTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="costs">
              <CostsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="media">
              <MediaTab formData={formData} setFormData={setFormData} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="shrink-0 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || !formData.key || isPending}
            className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
          >
            {isPending ? "Saving..." : isEditing ? "Update Equipment" : "Create Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab Components
function GeneralTab({
  formData,
  setFormData,
  manufacturers,
  isEditing,
}: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
  manufacturers: any[];
  isEditing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Equipment Key * {isEditing && "(Cannot be changed)"}
        </label>
        <Input
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
          placeholder="e.g., F35_LIGHTNING_II"
          disabled={isEditing}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Unique identifier (uppercase, underscores)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., F-35 Lightning II"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Manufacturer *</label>
        <Select
          value={formData.manufacturer}
          onValueChange={(value) => setFormData({ ...formData, manufacturer: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select manufacturer..." />
          </SelectTrigger>
          <SelectContent>
            {manufacturers.map((mfr) => (
              <SelectItem key={mfr.id} value={mfr.key || mfr.name}>
                {mfr.name} ({mfr.country})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Category *</label>
          <Select
            value={formData.category}
            onValueChange={(value) =>
              setFormData({ ...formData, category: value, subcategory: "" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORIES)
                .filter(([key]) => key !== "all")
                .map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Subcategory</label>
          <Select
            value={formData.subcategory}
            onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {SUBCATEGORIES[formData.category as keyof typeof SUBCATEGORIES]?.map((sub) => (
                <SelectItem key={sub} value={sub} className="capitalize">
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Era *</label>
        <Select
          value={formData.era}
          onValueChange={(value) => setFormData({ ...formData, era: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ERAS.map((era) => (
              <SelectItem key={era.value} value={era.value}>
                {era.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
        />
        <label htmlFor="isActive" className="text-foreground cursor-pointer text-sm">
          Active (visible in procurement system)
        </label>
      </div>
    </div>
  );
}

function SpecificationsTab({
  formData,
  setFormData,
}: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  const [specJson, setSpecJson] = useState(JSON.stringify(formData.specifications, null, 2));

  const handleSpecChange = (value: string) => {
    setSpecJson(value);
    try {
      const parsed = JSON.parse(value);
      setFormData({ ...formData, specifications: parsed });
    } catch (e) {
      // Invalid JSON, don't update formData
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Specifications (JSON)
        </label>
        <Textarea
          value={specJson}
          onChange={(e) => handleSpecChange(e.target.value)}
          placeholder='{"crew": 1, "speed": "Mach 1.6", "range": "2200 km", "ceiling": "50000 ft", ...}'
          rows={15}
          className="font-mono text-xs"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Example fields: crew, speed, range, ceiling, armor, armament, weight, length, wingspan,
          etc.
        </p>
      </div>
    </div>
  );
}

function CapabilitiesTab({
  formData,
  setFormData,
}: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  const [capJson, setCapJson] = useState(JSON.stringify(formData.capabilities, null, 2));

  const handleCapChange = (value: string) => {
    setCapJson(value);
    try {
      const parsed = JSON.parse(value);
      setFormData({ ...formData, capabilities: parsed });
    } catch (e) {
      // Invalid JSON, don't update formData
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Capabilities (JSON)
        </label>
        <Textarea
          value={capJson}
          onChange={(e) => handleCapChange(e.target.value)}
          placeholder='{"role": ["multirole fighter"], "strengths": ["stealth", "advanced avionics"], "weaknesses": ["high cost"], ...}'
          rows={15}
          className="font-mono text-xs"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Example fields: role, strengths, weaknesses, special_features, combat_radius, payload,
          etc.
        </p>
      </div>
    </div>
  );
}

function CostsTab({
  formData,
  setFormData,
}: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Acquisition Cost ($) *
        </label>
        <Input
          type="number"
          value={formData.acquisitionCost}
          onChange={(e) =>
            setFormData({ ...formData, acquisitionCost: parseFloat(e.target.value) || 0 })
          }
          min={0}
          step={100000}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Current: ${(formData.acquisitionCost / 1000000).toFixed(2)}M
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Maintenance Cost ($/year) *
        </label>
        <Input
          type="number"
          value={formData.maintenanceCost}
          onChange={(e) =>
            setFormData({ ...formData, maintenanceCost: parseFloat(e.target.value) || 0 })
          }
          min={0}
          step={10000}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Current: ${(formData.maintenanceCost / 1000).toFixed(0)}K/year
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Technology Level: {formData.technologyLevel}
        </label>
        <Slider
          value={[formData.technologyLevel]}
          onValueChange={([value]) => setFormData({ ...formData, technologyLevel: value })}
          min={60}
          max={100}
          step={1}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Range: 60 (basic) to 100 (cutting edge)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Crew Requirement *</label>
        <Input
          type="number"
          value={formData.crewRequirement}
          onChange={(e) =>
            setFormData({ ...formData, crewRequirement: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Annual Maintenance Hours
        </label>
        <Input
          type="number"
          value={formData.maintenanceHours}
          onChange={(e) =>
            setFormData({ ...formData, maintenanceHours: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
      </div>
    </div>
  );
}

function MediaTab({
  formData,
  setFormData,
}: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Image URL</label>
        <Input
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
        {formData.imageUrl && (
          <img
            src={formData.imageUrl}
            alt="Preview"
            className="mt-2 h-32 w-32 rounded-lg border border-white/10 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the equipment..."
          rows={4}
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Historical Context</label>
        <Textarea
          value={formData.historicalContext}
          onChange={(e) => setFormData({ ...formData, historicalContext: e.target.value })}
          placeholder="Historical information, deployment history, notable uses..."
          rows={6}
        />
      </div>
    </div>
  );
}
