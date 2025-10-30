// src/app/admin/military-equipment/small-arms/page.tsx
// Admin interface for managing small arms equipment catalog

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Card } from "~/components/ui/card";
import { Slider } from "~/components/ui/slider";
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
  Filter,
  Shield,
  Target,
  Crosshair,
  Zap,
  Settings,
  Factory,
  Globe,
  Upload,
  Image,
  DollarSign,
  Weight,
  Gauge,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

// Equipment types with icons
const EQUIPMENT_TYPES = [
  { value: 'pistols', label: 'Pistols', icon: Target },
  { value: 'assault_rifles', label: 'Assault Rifles', icon: Crosshair },
  { value: 'battle_rifles', label: 'Battle Rifles', icon: Crosshair },
  { value: 'sniper_rifles', label: 'Sniper Rifles', icon: Target },
  { value: 'submachine_guns', label: 'Submachine Guns', icon: Zap },
  { value: 'machine_guns', label: 'Machine Guns', icon: Zap },
  { value: 'grenade_launchers', label: 'Grenade Launchers', icon: Shield },
  { value: 'shotguns', label: 'Shotguns', icon: Target },
  { value: 'tactical_equipment', label: 'Tactical Equipment', icon: Shield },
  { value: 'anti_tank_weapons', label: 'Anti-Tank Weapons', icon: Target },
  { value: 'manpads', label: 'MANPADS', icon: Zap },
];

interface EquipmentFormData {
  key: string;
  name: string;
  manufacturerKey: string;
  category: string;
  equipmentType: string;
  eraKey: string;
  weight: number;
  unitCost: number;
  maintenanceCost: number;
  imageUrl: string;
  caliber: string;
  capacity: number | null;
  effectiveRange: number | null;
  fireRate: number | null;
  protectionLevel: string;
  range: number | null;
  altitude: number | null;
  description: string;
}

interface ManufacturerFormData {
  key: string;
  name: string;
  country: string;
  specialty: string[];
}

export default function SmallArmsEquipmentPage() {
  usePageTitle({ title: "Small Arms Equipment Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [activeMainTab, setActiveMainTab] = useState('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState('general');

  // Manufacturer management state
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<any | null>(null);

  // Bulk import state
  const [bulkImportJson, setBulkImportJson] = useState('');

  // Queries
  const { data: equipment, isLoading, refetch } = api.smallArmsEquipment.getAllEquipment.useQuery(
    {
      equipmentType: typeFilter !== 'all' ? typeFilter : undefined,
      eraKey: eraFilter !== 'all' ? eraFilter : undefined,
      manufacturerKey: manufacturerFilter !== 'all' ? manufacturerFilter : undefined,
      isActive: showInactive ? undefined : true,
      includeManufacturer: true,
      includeEra: true,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: stats } = api.smallArmsEquipment.getStatistics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: manufacturers } = api.smallArmsEquipment.getAllManufacturers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: eras } = api.smallArmsEquipment.getAllEras.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createMutation = api.smallArmsEquipment.createEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment created successfully",
        type: "success"
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create equipment",
        type: "error"
      });
    }
  });

  const updateMutation = api.smallArmsEquipment.updateEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment updated successfully",
        type: "success"
      });
      refetch();
      setEditingEquipment(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update equipment",
        type: "error"
      });
    }
  });

  const deleteMutation = api.smallArmsEquipment.deleteEquipment.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Equipment deactivated successfully",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate equipment",
        type: "error"
      });
    }
  });

  const createManufacturerMutation = api.smallArmsEquipment.createManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer created successfully",
        type: "success"
      });
      refetch();
      setIsManufacturerDialogOpen(false);
      resetManufacturerForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create manufacturer",
        type: "error"
      });
    }
  });

  const updateManufacturerMutation = api.smallArmsEquipment.updateManufacturer.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manufacturer updated successfully",
        type: "success"
      });
      refetch();
      setIsManufacturerDialogOpen(false);
      setEditingManufacturer(null);
      resetManufacturerForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update manufacturer",
        type: "error"
      });
    }
  });

  const bulkImportMutation = api.smallArmsEquipment.bulkImportEquipment.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Imported ${data.imported} equipment items`,
        type: "success"
      });
      refetch();
      setBulkImportJson('');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import equipment",
        type: "error"
      });
    }
  });

  // Filtered equipment
  const filteredEquipment = useMemo(() => {
    if (!equipment) return [];

    return equipment.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.caliber && item.caliber.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [equipment, searchTerm]);

  // Form data
  const [formData, setFormData] = useState<EquipmentFormData>({
    key: '',
    name: '',
    manufacturerKey: '',
    category: '',
    equipmentType: 'pistols',
    eraKey: '',
    weight: 0,
    unitCost: 0,
    maintenanceCost: 0,
    imageUrl: '',
    caliber: '',
    capacity: null,
    effectiveRange: null,
    fireRate: null,
    protectionLevel: '',
    range: null,
    altitude: null,
    description: '',
  });

  const [manufacturerFormData, setManufacturerFormData] = useState<ManufacturerFormData>({
    key: '',
    name: '',
    country: '',
    specialty: [],
  });

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      manufacturerKey: '',
      category: '',
      equipmentType: 'pistols',
      eraKey: '',
      weight: 0,
      unitCost: 0,
      maintenanceCost: 0,
      imageUrl: '',
      caliber: '',
      capacity: null,
      effectiveRange: null,
      fireRate: null,
      protectionLevel: '',
      range: null,
      altitude: null,
      description: '',
    });
    setActiveEditorTab('general');
  };

  const resetManufacturerForm = () => {
    setManufacturerFormData({
      key: '',
      name: '',
      country: '',
      specialty: [],
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.key || !formData.manufacturerKey || !formData.eraKey) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        type: "error"
      });
      return;
    }

    createMutation.mutate({
      ...formData,
      imageUrl: formData.imageUrl || null,
      caliber: formData.caliber || null,
      capacity: formData.capacity,
      effectiveRange: formData.effectiveRange,
      fireRate: formData.fireRate,
      protectionLevel: formData.protectionLevel || null,
      range: formData.range,
      altitude: formData.altitude,
      description: formData.description || null,
    });
  };

  const handleUpdate = () => {
    if (!editingEquipment?.key) return;

    updateMutation.mutate({
      key: editingEquipment.key,
      data: {
        name: formData.name,
        manufacturerKey: formData.manufacturerKey,
        category: formData.category,
        equipmentType: formData.equipmentType,
        eraKey: formData.eraKey,
        weight: formData.weight,
        unitCost: formData.unitCost,
        maintenanceCost: formData.maintenanceCost,
        imageUrl: formData.imageUrl || null,
        caliber: formData.caliber || null,
        capacity: formData.capacity,
        effectiveRange: formData.effectiveRange,
        fireRate: formData.fireRate,
        protectionLevel: formData.protectionLevel || null,
        range: formData.range,
        altitude: formData.altitude,
        description: formData.description || null,
      },
    });
  };

  const handleDelete = (key: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteMutation.mutate({ key });
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      key: item.key,
      name: item.name,
      manufacturerKey: item.manufacturerKey,
      category: item.category,
      equipmentType: item.equipmentType,
      eraKey: item.eraKey,
      weight: item.weight,
      unitCost: item.unitCost,
      maintenanceCost: item.maintenanceCost,
      imageUrl: item.imageUrl || '',
      caliber: item.caliber || '',
      capacity: item.capacity,
      effectiveRange: item.effectiveRange,
      fireRate: item.fireRate,
      protectionLevel: item.protectionLevel || '',
      range: item.range,
      altitude: item.altitude,
      description: item.description || '',
    });
    setEditingEquipment(item);
    setActiveEditorTab('general');
  };

  const handleCreateManufacturer = () => {
    if (!manufacturerFormData.name || !manufacturerFormData.key) {
      toast({
        title: "Validation Error",
        description: "Name and key are required",
        type: "error"
      });
      return;
    }

    createManufacturerMutation.mutate(manufacturerFormData);
  };

  const handleUpdateManufacturer = () => {
    if (!editingManufacturer?.key) return;

    updateManufacturerMutation.mutate({
      key: editingManufacturer.key,
      data: {
        name: manufacturerFormData.name,
        country: manufacturerFormData.country,
        specialty: manufacturerFormData.specialty,
      },
    });
  };

  const handleEditManufacturer = (manufacturer: any) => {
    setManufacturerFormData({
      key: manufacturer.key,
      name: manufacturer.name,
      country: manufacturer.country,
      specialty: typeof manufacturer.specialty === 'string'
        ? JSON.parse(manufacturer.specialty)
        : manufacturer.specialty || [],
    });
    setEditingManufacturer(manufacturer);
    setIsManufacturerDialogOpen(true);
  };

  const handleBulkImport = () => {
    try {
      const parsed = JSON.parse(bulkImportJson);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of equipment objects');
      }
      bulkImportMutation.mutate({ equipment: parsed });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: error instanceof Error ? error.message : "Failed to parse JSON",
        type: "error"
      });
    }
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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
        <div className="glass-card-parent p-6 rounded-xl border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-500/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <Shield className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Small Arms Equipment
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage military equipment catalog and manufacturers
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
            <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
              <TabsTrigger value="catalog">
                <Target className="h-4 w-4 mr-2" />
                Equipment Catalog
              </TabsTrigger>
              <TabsTrigger value="manufacturers">
                <Factory className="h-4 w-4 mr-2" />
                Manufacturers
              </TabsTrigger>
              <TabsTrigger value="bulk-import">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content */}
        {activeMainTab === 'catalog' && (
          <>
            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="glass-card-child p-4">
                  <p className="text-sm text-muted-foreground">Total Equipment</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.totalEquipment}</p>
                </Card>
                <Card className="glass-card-child p-4">
                  <p className="text-sm text-muted-foreground">Equipment Types</p>
                  <p className="text-3xl font-bold text-blue-400 mt-2">{stats.equipmentByType.length}</p>
                </Card>
                <Card className="glass-card-child p-4">
                  <p className="text-sm text-muted-foreground">Manufacturers</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">{stats.totalManufacturers}</p>
                </Card>
                <Card className="glass-card-child p-4">
                  <p className="text-sm text-muted-foreground">Eras</p>
                  <p className="text-3xl font-bold text-purple-400 mt-2">{stats.equipmentByEra.length}</p>
                </Card>
              </div>
            )}

            {/* Filters */}
            <Card className="glass-card-parent p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {EQUIPMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={eraFilter} onValueChange={setEraFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Eras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Eras</SelectItem>
                    {eras?.map(era => (
                      <SelectItem key={era.key} value={era.key}>{era.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showInactive"
                    checked={showInactive}
                    onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                  />
                  <label htmlFor="showInactive" className="text-sm text-foreground cursor-pointer">
                    Show inactive
                  </label>
                </div>
              </div>
            </Card>

            {/* Equipment Grid */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading equipment...</p>
              </div>
            ) : filteredEquipment.length === 0 ? (
              <Card className="glass-card-parent p-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No equipment found matching your filters</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredEquipment.map(item => (
                  <EquipmentCard
                    key={item.key}
                    equipment={item}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item.key, item.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeMainTab === 'manufacturers' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Manufacturers</h2>
              <Button
                onClick={() => {
                  resetManufacturerForm();
                  setIsManufacturerDialogOpen(true);
                }}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Manufacturer
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {manufacturers?.map(manufacturer => (
                <ManufacturerCard
                  key={manufacturer.key}
                  manufacturer={manufacturer}
                  onEdit={() => handleEditManufacturer(manufacturer)}
                />
              ))}
            </div>
          </>
        )}

        {activeMainTab === 'bulk-import' && (
          <Card className="glass-card-parent p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Bulk Import Equipment</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Paste JSON array of equipment objects to import multiple items at once.
            </p>

            <Textarea
              value={bulkImportJson}
              onChange={(e) => setBulkImportJson(e.target.value)}
              placeholder='[{"key": "M4_CARBINE", "name": "M4 Carbine", ...}]'
              rows={15}
              className="font-mono text-xs mb-4"
            />

            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkImport}
                disabled={!bulkImportJson || bulkImportMutation.isPending}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
              >
                <Upload className="h-4 w-4 mr-2" />
                {bulkImportMutation.isPending ? 'Importing...' : 'Import Equipment'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setBulkImportJson('')}
              >
                Clear
              </Button>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-sm font-medium text-foreground mb-2">JSON Format Example</h4>
              <pre className="text-xs text-muted-foreground overflow-x-auto">
{`[
  {
    "key": "M4_CARBINE",
    "name": "M4 Carbine",
    "manufacturerKey": "COLT",
    "category": "Carbine",
    "equipmentType": "assault_rifles",
    "eraKey": "MODERN_2010S",
    "weight": 3.0,
    "unitCost": 750,
    "maintenanceCost": 50,
    "caliber": "5.56x45mm NATO",
    "capacity": 30,
    "effectiveRange": 500,
    "fireRate": 700
  }
]`}
              </pre>
            </div>
          </Card>
        )}

        {/* Equipment Editor Dialog */}
        {(isAddDialogOpen || editingEquipment) && (
          <EquipmentEditorDialog
            isOpen={isAddDialogOpen || !!editingEquipment}
            isEditing={!!editingEquipment}
            formData={formData}
            setFormData={setFormData}
            activeTab={activeEditorTab}
            setActiveTab={setActiveEditorTab}
            manufacturers={manufacturers || []}
            eras={eras || []}
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
        {isManufacturerDialogOpen && (
          <ManufacturerDialog
            isOpen={isManufacturerDialogOpen}
            isEditing={!!editingManufacturer}
            formData={manufacturerFormData}
            setFormData={setManufacturerFormData}
            onClose={() => {
              setIsManufacturerDialogOpen(false);
              setEditingManufacturer(null);
              resetManufacturerForm();
            }}
            onSave={editingManufacturer ? handleUpdateManufacturer : handleCreateManufacturer}
            isPending={createManufacturerMutation.isPending || updateManufacturerMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// Equipment Card Component
interface EquipmentCardProps {
  equipment: any;
  onEdit: () => void;
  onDelete: () => void;
}

function EquipmentCard({ equipment, onEdit, onDelete }: EquipmentCardProps) {
  const typeData = EQUIPMENT_TYPES.find(t => t.value === equipment.equipmentType);
  const Icon = typeData?.icon || Target;

  return (
    <Card className="glass-card-child p-4 hover:border-orange-500/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-foreground text-sm line-clamp-1">{equipment.name}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
              {typeData?.label || equipment.equipmentType}
            </span>
            {equipment.era && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {equipment.era.label}
              </span>
            )}
          </div>
        </div>
        {!equipment.isActive && (
          <EyeOff className="h-4 w-4 text-red-400" title="Inactive" />
        )}
      </div>

      {/* Image Preview */}
      {equipment.imageUrl ? (
        <div className="mb-3 h-32 rounded-lg overflow-hidden bg-black/30">
          <img
            src={equipment.imageUrl}
            alt={equipment.name}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="mb-3 h-32 rounded-lg bg-black/30 flex items-center justify-center">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Specifications */}
      <div className="space-y-2 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Manufacturer:</span>
          <span className="font-medium text-foreground">{equipment.manufacturer?.name || 'N/A'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Category:</span>
          <span className="font-medium text-foreground">{equipment.category}</span>
        </div>
        {equipment.caliber && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Caliber:</span>
            <span className="font-medium text-foreground">{equipment.caliber}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Weight:</span>
          <span className="font-medium text-foreground">{equipment.weight} kg</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Unit Cost:</span>
          <span className="font-medium text-green-400">${equipment.unitCost.toLocaleString()}</span>
        </div>
        {equipment.effectiveRange && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Range:</span>
            <span className="font-medium text-foreground">{equipment.effectiveRange}m</span>
          </div>
        )}
        {equipment.capacity && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Capacity:</span>
            <span className="font-medium text-foreground">{equipment.capacity} rds</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="flex-1 text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
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
  eras: any[];
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
  eras,
  onClose,
  onSave,
  isPending
}: EquipmentEditorDialogProps) {
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'specifications', label: 'Specifications', icon: Gauge },
    { id: 'costs', label: 'Costs', icon: DollarSign },
    { id: 'media', label: 'Media', icon: Image },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Equipment' : 'Add Equipment'}
          </DialogTitle>
          <DialogDescription>
            Configure equipment specifications and metadata
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2 shrink-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="general">
              <GeneralTab
                formData={formData}
                setFormData={setFormData}
                manufacturers={manufacturers}
                eras={eras}
              />
            </TabsContent>
            <TabsContent value="specifications">
              <SpecificationsTab formData={formData} setFormData={setFormData} />
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
        <DialogFooter className="border-t border-white/10 pt-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || !formData.key || isPending}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
          >
            {isPending ? "Saving..." : isEditing ? "Update Equipment" : "Create Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab Components
function GeneralTab({ formData, setFormData, manufacturers, eras }: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
  manufacturers: any[];
  eras: any[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Equipment Key *</label>
        <Input
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
          placeholder="e.g., M4_CARBINE"
        />
        <p className="text-xs text-muted-foreground mt-1">Unique identifier (uppercase, underscores)</p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., M4 Carbine"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Equipment Type *</label>
          <Select
            value={formData.equipmentType}
            onValueChange={(value) => setFormData({ ...formData, equipmentType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
          <Input
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="e.g., Carbine, Service Pistol"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Manufacturer *</label>
          <Select
            value={formData.manufacturerKey}
            onValueChange={(value) => setFormData({ ...formData, manufacturerKey: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select manufacturer" />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map(mfr => (
                <SelectItem key={mfr.key} value={mfr.key}>{mfr.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Era *</label>
          <Select
            value={formData.eraKey}
            onValueChange={(value) => setFormData({ ...formData, eraKey: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select era" />
            </SelectTrigger>
            <SelectContent>
              {eras.map(era => (
                <SelectItem key={era.key} value={era.key}>{era.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the equipment..."
          rows={3}
        />
      </div>
    </div>
  );
}

function SpecificationsTab({ formData, setFormData }: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Weight (kg)</label>
        <Input
          type="number"
          step="0.1"
          value={formData.weight}
          onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Caliber</label>
          <Input
            value={formData.caliber}
            onChange={(e) => setFormData({ ...formData, caliber: e.target.value })}
            placeholder="e.g., 5.56x45mm NATO"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Magazine Capacity (rounds)</label>
          <Input
            type="number"
            value={formData.capacity || ''}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value ? parseInt(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Effective Range (m)</label>
          <Input
            type="number"
            value={formData.effectiveRange || ''}
            onChange={(e) => setFormData({ ...formData, effectiveRange: e.target.value ? parseInt(e.target.value) : null })}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Fire Rate (RPM)</label>
          <Input
            type="number"
            value={formData.fireRate || ''}
            onChange={(e) => setFormData({ ...formData, fireRate: e.target.value ? parseInt(e.target.value) : null })}
          />
          <p className="text-xs text-muted-foreground mt-1">0 = semi-automatic</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Protection Level (for armor)</label>
        <Input
          value={formData.protectionLevel}
          onChange={(e) => setFormData({ ...formData, protectionLevel: e.target.value })}
          placeholder="e.g., Level IV, Level IIIA+"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Maximum Range (m)</label>
          <Input
            type="number"
            value={formData.range || ''}
            onChange={(e) => setFormData({ ...formData, range: e.target.value ? parseInt(e.target.value) : null })}
          />
          <p className="text-xs text-muted-foreground mt-1">For missiles/rockets</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Maximum Altitude (m)</label>
          <Input
            type="number"
            value={formData.altitude || ''}
            onChange={(e) => setFormData({ ...formData, altitude: e.target.value ? parseInt(e.target.value) : null })}
          />
          <p className="text-xs text-muted-foreground mt-1">For MANPADS</p>
        </div>
      </div>
    </div>
  );
}

function CostsTab({ formData, setFormData }: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Unit Cost (USD)</label>
        <Input
          type="number"
          step="0.01"
          value={formData.unitCost}
          onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
        />
        <p className="text-xs text-muted-foreground mt-1">Acquisition cost per unit</p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Annual Maintenance Cost (USD)</label>
        <Input
          type="number"
          step="0.01"
          value={formData.maintenanceCost}
          onChange={(e) => setFormData({ ...formData, maintenanceCost: parseFloat(e.target.value) || 0 })}
        />
        <p className="text-xs text-muted-foreground mt-1">Yearly maintenance and upkeep costs</p>
      </div>

      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <h4 className="text-sm font-medium text-foreground mb-2">Cost Summary</h4>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Unit Cost:</span>
            <span className="text-foreground font-medium">${formData.unitCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Annual Maintenance:</span>
            <span className="text-foreground font-medium">${formData.maintenanceCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-white/10">
            <span>5-Year Total Cost of Ownership:</span>
            <span className="text-green-400 font-medium">
              ${(formData.unitCost + formData.maintenanceCost * 5).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaTab({ formData, setFormData }: {
  formData: EquipmentFormData;
  setFormData: (data: EquipmentFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Image URL</label>
        <Input
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      {formData.imageUrl && (
        <div className="p-4 rounded-lg bg-black/20 border border-white/10">
          <p className="text-sm font-medium text-foreground mb-3">Image Preview</p>
          <div className="h-64 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
            <img
              src={formData.imageUrl}
              alt="Equipment preview"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<p class="text-red-400 text-sm">Failed to load image</p>';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Manufacturer Card Component
interface ManufacturerCardProps {
  manufacturer: any;
  onEdit: () => void;
}

function ManufacturerCard({ manufacturer, onEdit }: ManufacturerCardProps) {
  const specialty = typeof manufacturer.specialty === 'string'
    ? JSON.parse(manufacturer.specialty)
    : manufacturer.specialty || [];

  return (
    <Card className="glass-card-child p-4 hover:border-orange-500/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-foreground text-sm">{manufacturer.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            <span>{manufacturer.country}</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-2">Specialties:</p>
        <div className="flex flex-wrap gap-1">
          {specialty.map((spec: string, idx: number) => (
            <span key={idx} className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {spec}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-white/10">
        <span className="text-muted-foreground">
          Equipment: {manufacturer._count?.equipment || 0}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="text-xs"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      </div>
    </Card>
  );
}

// Manufacturer Dialog
interface ManufacturerDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ManufacturerFormData;
  setFormData: (data: ManufacturerFormData) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

function ManufacturerDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  onClose,
  onSave,
  isPending
}: ManufacturerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Manufacturer' : 'Add Manufacturer'}
          </DialogTitle>
          <DialogDescription>
            Configure manufacturer details and specialty areas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Manufacturer Key *</label>
            <Input
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
              placeholder="e.g., COLT, FN_HERSTAL"
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Colt's Manufacturing"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Country</label>
            <Input
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="e.g., United States"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Specialties</label>
            <Input
              value={formData.specialty.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                specialty: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., Rifles, Pistols, Carbines (comma-separated)"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list of specialties</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || !formData.key || isPending}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-500"
          >
            {isPending ? "Saving..." : isEditing ? "Update Manufacturer" : "Create Manufacturer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
