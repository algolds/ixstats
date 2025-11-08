// src/app/admin/military-equipment/page.tsx
// Admin interface for managing military equipment catalog - unified tabbed interface

"use client";

import React, { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api, type RouterOutputs } from "~/trpc/react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useToast } from "~/components/ui/toast";
import { Badge } from "~/components/ui/badge";
import { MultiSelect } from "~/components/ui/multi-select";
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
  Factory,
  BarChart3,
  Package,
  Globe,
  ToggleLeft,
  ToggleRight,
  ArrowUpDown,
  Loader2,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Upload,
} from "lucide-react";
import Link from "next/link";

// Equipment categories (must match tRPC router and seed script)
const CATEGORIES = {
  all: "All Equipment",
  aircraft: "Aircraft",
  naval: "Naval Vessels",
  vehicle: "Vehicles",
  missile: "Missiles & Weapons",
  support: "Support Equipment",
};

const SUBCATEGORIES = {
  aircraft: [
    "fighter_gen5",
    "fighter_gen4_5",
    "fighter",
    "bomber",
    "attack",
    "transport",
    "helicopter",
  ],
  naval: ["carrier", "destroyer", "frigate", "submarine", "amphibious"],
  vehicle: ["tank", "ifv", "apc", "artillery", "mlrs"],
  missile: ["air_defense", "missile", "naval_weapon", "torpedo"],
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
  naval: Ship,
  vehicle: Car,
  missile: Rocket,
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

// Type definitions for analytics
type UsageStats = RouterOutputs["militaryEquipment"]["getEquipmentUsageStats"];
type ManufacturerStats = RouterOutputs["militaryEquipment"]["getManufacturerStats"];
type CatalogEquipment = RouterOutputs["militaryEquipment"]["getAllCatalogEquipment"];
type CatalogEquipmentItem = CatalogEquipment extends Array<infer Item> ? Item : never;

// Manufacturer specialties
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

interface Manufacturer {
  id: string;
  name: string;
  country: string;
  specialty: string | null;
  founded?: number | null;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  equipment?: {
    id: string;
    name: string;
    category: string;
    technologyTier?: number;
    technologyLevel?: number;
  }[];
}

type ManufacturerWithCount = Manufacturer & { equipmentCount: number };

export default function MilitaryEquipmentPage() {
  usePageTitle({ title: "Military Equipment Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // Main tab state
  const [activeMainTab, setActiveMainTab] = useState("catalog");

  // Equipment Catalog State
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

  // Manufacturers State
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [manufacturerSearchQuery, setManufacturerSearchQuery] = useState("");
  const [showInactiveManufacturers, setShowInactiveManufacturers] = useState(false);
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] = useState(false);
  const [editingManufacturerId, setEditingManufacturerId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  const [manufacturerFormData, setManufacturerFormData] = useState({
    name: "",
    country: "",
    specialty: [] as string[],
    founded: undefined as number | undefined,
    description: "",
    isActive: true,
  });

  // Queries - Equipment Catalog (always active)
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

  // Queries - Manufacturers Tab (conditional)
  const {
    data: manufacturersAll,
    isLoading: manufacturersLoading,
    refetch: refetchManufacturers,
  } = api.militaryEquipment.getManufacturers.useQuery(
    {
      isActive: showInactiveManufacturers ? undefined : true,
    },
    {
      refetchOnWindowFocus: false,
      enabled: activeMainTab === "manufacturers",
    }
  );

  // Queries - Analytics Tab (conditional)
  const {
    data: usageStats,
    isLoading: loadingUsage,
    error: usageError,
  } = api.militaryEquipment.getEquipmentUsageStats.useQuery(undefined, {
    enabled: activeMainTab === "analytics",
    refetchOnWindowFocus: false,
  });

  const {
    data: manufacturerStats,
    isLoading: loadingManufacturers,
    error: manufacturerError,
  } = api.militaryEquipment.getManufacturerStats.useQuery(undefined, {
    enabled: activeMainTab === "analytics",
    refetchOnWindowFocus: false,
  });

  const {
    data: allEquipment,
    isLoading: loadingAll,
    error: allError,
  } = api.militaryEquipment.getAllCatalogEquipment.useQuery(
    {
      includeInactive: true,
    },
    {
      enabled: activeMainTab === "analytics",
      refetchOnWindowFocus: false,
    }
  );

  // Queries - Small Arms Tab (conditional)
  const {
    data: smallArmsEquipment,
    isLoading: smallArmsLoading,
    refetch: refetchSmallArms,
  } = api.smallArmsEquipment.getAllEquipment.useQuery(
    {
      isActive: showInactive ? undefined : true,
      includeManufacturer: true,
      includeEra: true,
    },
    {
      refetchOnWindowFocus: false,
      enabled: activeMainTab === "small-arms",
    }
  );

  const { data: smallArmsStats } = api.smallArmsEquipment.getStatistics.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: activeMainTab === "small-arms",
  });

  // Mutations - Equipment Catalog
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

  // Mutations - Manufacturers
  const createManufacturerMutation = api.militaryEquipment.createManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer created successfully",
        type: "success",
      });
      refetchManufacturers();
      setIsManufacturerDialogOpen(false);
      resetManufacturerForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create manufacturer",
        type: "error",
      });
    },
  });

  const updateManufacturerMutation = api.militaryEquipment.updateManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer updated successfully",
        type: "success",
      });
      refetchManufacturers();
      setEditingManufacturerId(null);
      resetManufacturerForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manufacturer",
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
      if (item.technologyLevel < techLevelRange[0]! || item.technologyLevel > techLevelRange[1]!)
        return false;

      // Cost filter
      if (item.acquisitionCost < costRange[0]! || item.acquisitionCost > costRange[1]!) return false;

      return true;
    });
  }, [equipmentData, subcategoryFilter, techLevelRange, costRange]);

  // Normalized manufacturers for Manufacturers tab
  const normalizedManufacturers = useMemo<Manufacturer[]>(() => {
    if (!manufacturersAll) return [];
    return manufacturersAll.map((m) => ({
      ...m,
      specialty: m.specialty ?? "",
      founded: (m as Manufacturer).founded ?? null,
      description: (m as Manufacturer).description ?? null,
      equipment: (m as Manufacturer).equipment ?? [],
    })) as Manufacturer[];
  }, [manufacturersAll]);

  // Get unique countries for filter
  const countries = useMemo(() => {
    if (normalizedManufacturers.length === 0) return [];
    const uniqueCountries = new Set(normalizedManufacturers.map((m) => m.country));
    return Array.from(uniqueCountries).sort();
  }, [normalizedManufacturers]);

  // Filtered and sorted manufacturers
  const filteredManufacturers = useMemo<ManufacturerWithCount[]>(() => {
    if (normalizedManufacturers.length === 0) return [];

    let filtered = normalizedManufacturers.filter((manufacturer) => {
      // Country filter
      if (countryFilter !== "all" && manufacturer.country !== countryFilter) return false;

      // Search filter
      if (manufacturerSearchQuery) {
        const query = manufacturerSearchQuery.toLowerCase();
        return (
          manufacturer.name.toLowerCase().includes(query) ||
          manufacturer.country.toLowerCase().includes(query) ||
          manufacturer.specialty?.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Add equipment count for sorting
    const withCounts: ManufacturerWithCount[] = filtered.map((m) => ({
      ...m,
      equipmentCount: m.equipment?.length ?? 0,
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
  }, [normalizedManufacturers, countryFilter, manufacturerSearchQuery, sortField, sortDirection]);

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

  const resetManufacturerForm = () => {
    setManufacturerFormData({
      name: "",
      country: "",
      specialty: [],
      founded: undefined,
      description: "",
      isActive: true,
    });
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
      setSelectedIds(new Set(filteredEquipment.map((e: { id: string }) => e.id)));
    }
  };

  // Manufacturers handlers
  const handleCreateManufacturer = () => {
    if (!manufacturerFormData.name || !manufacturerFormData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error",
      });
      return;
    }

    createManufacturerMutation.mutate({
      name: manufacturerFormData.name,
      country: manufacturerFormData.country,
      specialty: manufacturerFormData.specialty.length > 0 ? manufacturerFormData.specialty.join(", ") : undefined,
      founded: manufacturerFormData.founded,
      description: manufacturerFormData.description || undefined,
      isActive: manufacturerFormData.isActive,
    });
  };

  const handleEditManufacturer = (manufacturer: Manufacturer) => {
    setEditingManufacturerId(manufacturer.id);
    setManufacturerFormData({
      name: manufacturer.name,
      country: manufacturer.country,
      specialty: manufacturer.specialty
        ? manufacturer.specialty.split(", ").map((s) => s.trim())
        : [],
      founded: manufacturer.founded || undefined,
      description: manufacturer.description || "",
      isActive: manufacturer.isActive,
    });
    setIsManufacturerDialogOpen(true);
  };

  const handleUpdateManufacturer = () => {
    if (!editingManufacturerId || !manufacturerFormData.name || !manufacturerFormData.country) {
      toast({
        title: "Validation Error",
        description: "Name and country are required",
        type: "error",
      });
      return;
    }

    updateManufacturerMutation.mutate({
      id: editingManufacturerId,
      name: manufacturerFormData.name,
      country: manufacturerFormData.country,
      specialty: manufacturerFormData.specialty.length > 0 ? manufacturerFormData.specialty.join(", ") : undefined,
      founded: manufacturerFormData.founded,
      description: manufacturerFormData.description || undefined,
      isActive: manufacturerFormData.isActive,
    });
  };

  const handleToggleActive = (manufacturer: Manufacturer) => {
    updateManufacturerMutation.mutate({
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
        {/* Header - Outside tabs, always visible */}
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
                    Manage equipment catalog, manufacturers, and analytics
                  </p>
                </div>
              </div>
            </div>
            {activeMainTab === "catalog" && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-red-500/20 text-red-500 hover:bg-red-500/30"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
          <TabsList className="glass-card-parent flex w-full gap-2 overflow-x-auto border-b border-white/10 p-2">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Equipment Catalog
            </TabsTrigger>
            <TabsTrigger value="manufacturers" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Manufacturers
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="small-arms" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Small Arms
            </TabsTrigger>
          </TabsList>

          {/* Tab Content: Equipment Catalog */}
          <TabsContent value="catalog" className="space-y-6">
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
          </TabsContent>

          {/* Tab Content: Manufacturers */}
          <TabsContent value="manufacturers" className="space-y-6">
            <div className="glass-card-parent rounded-xl border border-white/10 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-foreground text-xl font-bold">Defense Manufacturers</h2>
                <Button
                  onClick={() => {
                    setEditingManufacturerId(null);
                    resetManufacturerForm();
                    setIsManufacturerDialogOpen(true);
                  }}
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
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setEditingManufacturerId(null);
                      resetManufacturerForm();
                      setIsManufacturerDialogOpen(true);
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
                <div className="text-foreground text-2xl font-bold">
                  {normalizedManufacturers.length}
                </div>
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
                  {normalizedManufacturers.reduce(
                    (sum, m) => sum + (m.equipment?.length ?? 0),
                    0
                  )}
                </div>
                <div className="text-muted-foreground text-sm">Total Equipment</div>
              </div>
            </div>
          </TabsContent>

          {/* Tab Content: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsContent
              usageStats={usageStats}
              manufacturerStats={manufacturerStats}
              allEquipment={allEquipment}
              isLoading={loadingUsage || loadingManufacturers || loadingAll}
              error={usageError || manufacturerError || allError}
            />
          </TabsContent>

          {/* Tab Content: Small Arms */}
          <TabsContent value="small-arms" className="space-y-6">
            <div className="glass-card-parent rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-xl font-bold">Small Arms Equipment</h2>
                <p className="text-muted-foreground text-sm">
                  Manage small arms catalog and manufacturers
                </p>
              </div>
            </div>

            {smallArmsLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500"></div>
                <p className="text-muted-foreground">Loading small arms equipment...</p>
              </div>
            ) : (
              <>
                {/* Statistics */}
                {smallArmsStats && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card className="glass-card-child p-4">
                      <p className="text-muted-foreground text-sm">Total Equipment</p>
                      <p className="text-foreground mt-2 text-3xl font-bold">
                        {smallArmsStats.totalEquipment}
                      </p>
                    </Card>
                    <Card className="glass-card-child p-4">
                      <p className="text-muted-foreground text-sm">Equipment Types</p>
                      <p className="mt-2 text-3xl font-bold text-blue-400">
                        {smallArmsStats.equipmentByType.length}
                      </p>
                    </Card>
                    <Card className="glass-card-child p-4">
                      <p className="text-muted-foreground text-sm">Manufacturers</p>
                      <p className="mt-2 text-3xl font-bold text-green-400">
                        {smallArmsStats.totalManufacturers}
                      </p>
                    </Card>
                    <Card className="glass-card-child p-4">
                      <p className="text-muted-foreground text-sm">Eras</p>
                      <p className="mt-2 text-3xl font-bold text-purple-400">
                        {smallArmsStats.equipmentByEra.length}
                      </p>
                    </Card>
                  </div>
                )}

                {/* Equipment Display */}
                {smallArmsEquipment && smallArmsEquipment.length > 0 ? (
                  <div className="glass-card-child rounded-xl border border-white/10 p-6">
                    <p className="text-foreground text-sm">
                      {smallArmsEquipment.length} equipment items available
                    </p>
                  </div>
                ) : (
                  <Card className="glass-card-parent p-12 text-center">
                    <Filter className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">No small arms equipment found</p>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

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

        {/* Manufacturer Dialog */}
        <Dialog
          open={isManufacturerDialogOpen}
          onOpenChange={(open) => {
            setIsManufacturerDialogOpen(open);
            if (!open) {
              setEditingManufacturerId(null);
              resetManufacturerForm();
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingManufacturerId ? "Edit" : "Add"} Manufacturer</DialogTitle>
              <DialogDescription>
                {editingManufacturerId
                  ? "Update manufacturer information"
                  : "Create a new defense manufacturer"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
                <Input
                  value={manufacturerFormData.name}
                  onChange={(e) => setManufacturerFormData({ ...manufacturerFormData, name: e.target.value })}
                  placeholder="e.g., Lockheed Martin"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Country *</label>
                <Input
                  value={manufacturerFormData.country}
                  onChange={(e) => setManufacturerFormData({ ...manufacturerFormData, country: e.target.value })}
                  placeholder="e.g., United States"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Specialties
                </label>
                <MultiSelect
                  options={SPECIALTIES}
                  value={manufacturerFormData.specialty}
                  onChange={(value) => setManufacturerFormData({ ...manufacturerFormData, specialty: value })}
                  placeholder="Select specialties..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">Founded</label>
                <Input
                  type="number"
                  value={manufacturerFormData.founded || ""}
                  onChange={(e) =>
                    setManufacturerFormData({
                      ...manufacturerFormData,
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
                  value={manufacturerFormData.description}
                  onChange={(e) => setManufacturerFormData({ ...manufacturerFormData, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={manufacturerFormData.isActive}
                  onChange={(e) => setManufacturerFormData({ ...manufacturerFormData, isActive: e.target.checked })}
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
              <Button variant="outline" onClick={() => setIsManufacturerDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={editingManufacturerId ? handleUpdateManufacturer : handleCreateManufacturer}
                disabled={
                  !manufacturerFormData.name ||
                  !manufacturerFormData.country ||
                  createManufacturerMutation.isPending ||
                  updateManufacturerMutation.isPending
                }
              >
                {createManufacturerMutation.isPending || updateManufacturerMutation.isPending
                  ? "Saving..."
                  : editingManufacturerId
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
            <EyeOff className="h-4 w-4 shrink-0 text-red-400" aria-label="Inactive" />
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

// Analytics Content Component
interface AnalyticsContentProps {
  usageStats: UsageStats | undefined;
  manufacturerStats: ManufacturerStats | undefined;
  allEquipment: CatalogEquipment | undefined;
  isLoading: boolean;
  error: any;
}

function AnalyticsContent({
  usageStats,
  manufacturerStats,
  allEquipment,
  isLoading,
  error,
}: AnalyticsContentProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-muted-foreground text-sm">Loading military equipment analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
            <CardDescription className="text-red-500">{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!usageStats || !manufacturerStats || !allEquipment) {
    return null;
  }

  // Calculate summary statistics
  const totalEquipment = allEquipment.length;
  const activeEquipment = allEquipment.filter((eq) => eq.isActive).length;
  const totalManufacturers = manufacturerStats.totalManufacturers;
  const avgTechLevel =
    totalEquipment > 0
      ? allEquipment.reduce((sum, eq) => sum + (eq.technologyLevel ?? 0), 0) / totalEquipment
      : 0;

  const manufacturerLookup = useMemo(
    () =>
      new Map(
        manufacturerStats.manufacturers.map((m) => [m.name, m] as const)
      ),
    [manufacturerStats.manufacturers]
  );

  // Prepare chart data
  const topEquipmentChartData = usageStats.topEquipment.map((eq) => ({
    name: eq.name.length > 30 ? eq.name.substring(0, 30) + "..." : eq.name,
    fullName: eq.name,
    count: eq.usageCount,
    category: eq.category,
    manufacturer: eq.manufacturer ?? "Unknown",
  }));

  const categoryChartData = usageStats.byCategory.map((cat) => ({
    name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
    value: cat._count.id,
    usage: cat._sum.usageCount || 0,
  }));

  const eraChartData = usageStats.byEra.map((era) => ({
    name: era.era.toUpperCase().replace("-", " "),
    value: era._count.id,
    usage: era._sum.usageCount || 0,
  }));

  const manufacturerChartData = usageStats.byManufacturer.slice(0, 10).map((mfr) => {
    const details = manufacturerLookup.get(mfr.manufacturerName);
    const displayName =
      mfr.manufacturerName.length > 25
        ? mfr.manufacturerName.substring(0, 25) + "..."
        : mfr.manufacturerName;

    return {
      name: displayName,
      fullName: mfr.manufacturerName,
      count: mfr.equipmentCount,
      usage: mfr.totalUsage,
      country: details?.country ?? "Unknown",
    };
  });

  // Technology level progression by era
  const eraOrder = ["wwi", "wwii", "cold-war", "modern", "future"];
  const techProgressionData = eraOrder
    .map((era) => {
      const eraEquipment = allEquipment.filter((eq) => eq.era === era);
      const avgTech =
        eraEquipment.length > 0
          ? eraEquipment.reduce((sum, eq) => sum + (eq.technologyLevel ?? 0), 0) /
            eraEquipment.length
          : 0;
      return {
        era: era.toUpperCase().replace("-", " "),
        avgTechLevel: Math.round(avgTech * 10) / 10,
        count: eraEquipment.length,
      };
    })
    .filter((item) => item.count > 0);

  // Deprecation candidates (usageCount < 5)
  const deprecationCandidates = allEquipment
    .filter((eq) => eq.isActive && eq.usageCount < 5)
    .sort((a, b) => a.usageCount - b.usageCount)
    .slice(0, 20);

  // Colors for charts (red theme)
  const COLORS = [
    "#ef4444",
    "#dc2626",
    "#f87171",
    "#fca5a5",
    "#fee2e2",
    "#b91c1c",
    "#991b1b",
    "#7f1d1d",
    "#fecaca",
    "#fb923c",
  ];

  // Chart configs
  const chartConfig = {
    count: { label: "Equipment Count", color: "#ef4444" },
    value: { label: "Total Items", color: "#dc2626" },
    usage: { label: "Usage Count", color: "#f87171" },
    avgTechLevel: { label: "Avg Tech Level", color: "#ef4444" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card-parent rounded-xl border border-white/10 p-6">
        <h2 className="text-2xl font-bold tracking-tight text-red-600">
          Military Equipment Analytics
        </h2>
        <p className="text-muted-foreground">
          Comprehensive usage analytics and statistics for military equipment catalog
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment Items</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalEquipment}</div>
            <p className="text-muted-foreground text-xs">Across all categories and eras</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Equipment</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeEquipment}</div>
            <p className="text-muted-foreground text-xs">Currently available for procurement</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Manufacturers</CardTitle>
            <Factory className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalManufacturers}</div>
            <p className="text-muted-foreground text-xs">Active equipment producers</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Tech Level</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{avgTechLevel.toFixed(1)}</div>
            <p className="text-muted-foreground text-xs">Across all equipment (1-10 scale)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 10 Most Used Equipment */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Top 10 Most Used Equipment</CardTitle>
            <CardDescription>Equipment with the highest procurement usage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={topEquipmentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment by Category */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment by Category</CardTitle>
            <CardDescription>Distribution across equipment categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment by Era */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment by Era</CardTitle>
            <CardDescription>Distribution across historical eras</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={eraChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {eraChartData.map((entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment Count by Manufacturer */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment Count by Manufacturer (Top 10)</CardTitle>
            <CardDescription>
              Manufacturers with the most equipment items in catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={manufacturerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Technology Level Progression by Era */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Technology Level Progression by Era</CardTitle>
            <CardDescription>Average technology tier across historical eras</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={techProgressionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="era" />
                <YAxis domain={[0, 10]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="avgTechLevel"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: "#ef4444", r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Least Used Equipment Table (Deprecation Candidates) */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Least Used Equipment (Deprecation Candidates)
          </CardTitle>
          <CardDescription>
            Equipment with usage count less than 5 - consider reviewing for relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deprecationCandidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="px-4 py-2 text-left text-sm font-medium">Equipment Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Category</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Era</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Manufacturer</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">Tech Level</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Usage Count</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deprecationCandidates.map((equipment, index) => {
                    const manufacturerName =
                      (equipment as CatalogEquipmentItem).manufacturer ?? "N/A";
                    const techLevel =
                      (equipment as CatalogEquipmentItem).technologyLevel ??
                      (equipment as CatalogEquipmentItem & { technologyTier?: number })
                        .technologyTier ??
                      null;

                    return (
                      <tr key={equipment.id} className={index % 2 === 0 ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-3 text-sm font-medium">{equipment.name}</td>
                        <td className="px-4 py-3 text-sm">
                          {equipment.category.charAt(0).toUpperCase() + equipment.category.slice(1)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {equipment.era.toUpperCase().replace("-", " ")}
                        </td>
                        <td className="px-4 py-3 text-sm">{manufacturerName}</td>
                        <td className="px-4 py-3 text-center font-mono text-sm">
                          {techLevel ?? "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-orange-600">
                          {equipment.usageCount}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              equipment.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {equipment.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="mb-4 h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-green-600">All Equipment Well-Utilized</p>
              <p className="text-muted-foreground text-sm">No equipment with usage count below 5</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
