// src/components/defense/AssetManager.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import {
  Plus,
  Edit,
  Trash2,
  Plane,
  Ship,
  Truck,
  Radio,
  Target,
  DollarSign,
  Wrench,
  CheckCircle2,
  Search,
  Filter,
  Image,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { toast } from "sonner";
import {
  MILITARY_AIRCRAFT,
  MILITARY_SHIPS,
  MILITARY_VEHICLES,
  WEAPON_SYSTEMS,
  DEFENSE_MANUFACTURERS,
  MILITARY_ERAS,
  EXPANDED_MILITARY_DATABASE,
} from "~/lib/military-equipment";

// Define a more specific type for our asset
interface Asset {
  id: string;
  name: string;
  assetType: string;
  category: string;
  status: string;
  operational: number;
  quantity: number;
  acquisitionCost: number;
  maintenanceCost: number;
  modernizationLevel: number;
  capability: string | null;
  imageUrl?: string | null;
}

interface AssetManagerProps {
  branchId: string;
  branchType: string;
  assets: Asset[];
  onRefetch: () => void;
}

const ASSET_TYPE_CONFIG = {
  aircraft: { icon: Plane, color: "text-sky-600", label: "Aircraft" },
  ship: { icon: Ship, color: "text-blue-600", label: "Naval Vessel" },
  vehicle: { icon: Truck, color: "text-green-600", label: "Vehicle" },
  installation: { icon: Target, color: "text-purple-600", label: "Installation" },
  weapon_system: { icon: Radio, color: "text-red-600", label: "Weapon System" },
} as const;

const STATUS_CONFIG = {
  operational: { label: "Operational", color: "bg-green-500" },
  maintenance: { label: "Maintenance", color: "bg-yellow-500" },
  reserve: { label: "Reserve", color: "bg-blue-500" },
  retired: { label: "Retired", color: "bg-gray-500" },
} as const;

export function AssetManager({ branchId, branchType, assets, onRefetch }: AssetManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);

  const createAsset = api.security.createMilitaryAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset created successfully");
      setShowDialog(false);
      setEditingAsset(null);
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });

  const updateAsset = api.security.updateMilitaryAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      setShowDialog(false);
      setEditingAsset(null);
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });

  const deleteAsset = api.security.deleteMilitaryAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset deleted successfully");
      onRefetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete asset: ${error.message}`);
    },
  });

  const handleCreate = () => {
    setEditingAsset(null);
    setShowDialog(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setShowDialog(true);
  };

  const handleDelete = (assetId: string) => {
    if (confirm("Are you sure you want to delete this asset?")) {
      deleteAsset.mutate({ id: assetId });
    }
  };

  const filteredAssets =
    filterType === "all" ? assets : assets.filter((a) => a.assetType === filterType);

  // Group assets by type
  const assetsByType = filteredAssets.reduce(
    (acc, asset) => {
      if (!acc[asset.assetType]) {
        acc[asset.assetType] = [];
      }
      acc[asset.assetType].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4" />
            Assets ({assets.length})
          </h4>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-3 w-3" />
          Add Asset
        </Button>
      </div>

      {filteredAssets.length > 0 ? (
        <div className="space-y-3">
          {Object.entries(assetsByType).map(([type, typeAssets]) => {
            const config = ASSET_TYPE_CONFIG[type as keyof typeof ASSET_TYPE_CONFIG];
            const Icon = config?.icon ?? Target;

            return (
              <div key={type} className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <Icon className={`h-4 w-4 ${config?.color}`} />
                  {config?.label} ({typeAssets.length})
                </div>

                <div className="space-y-2 pl-6">
                  {typeAssets.map((asset: Asset) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`relative overflow-hidden rounded-lg border transition-all hover:shadow-lg ${asset.imageUrl ? "cursor-pointer hover:border-orange-400" : ""}`}
                      onClick={(e) => {
                        // Only trigger if clicking the card itself, not buttons
                        const target = e.target as HTMLElement;
                        if (
                          !target.closest("button") &&
                          asset.imageUrl
                        ) {
                          console.log("Opening image modal for:", asset.name, asset.imageUrl);
                          setViewingImage({ url: asset.imageUrl, name: asset.name });
                        }
                      }}
                    >
                      {/* Background image with red/orange overlay */}
                      {asset.imageUrl && (
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-10 transition-opacity hover:opacity-15"
                          style={{
                            backgroundImage: `linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(249, 115, 22, 0.05)), url(${asset.imageUrl})`,
                          }}
                        />
                      )}

                      <div className="bg-card/90 relative flex items-start justify-between p-3 backdrop-blur-sm">
                        {/* Equipment image thumbnail */}
                        {asset.imageUrl ? (
                          <div className="group/img relative mr-4 h-28 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 border-orange-400 shadow-md transition-all hover:border-orange-500 hover:shadow-lg dark:border-orange-700">
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              className="h-full w-full object-cover transition-transform group-hover/img:scale-110"
                              onError={(e) => {
                                // Hide broken images gracefully
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover/img:bg-black/60">
                              <div className="flex flex-col items-center gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
                                <Image className="h-6 w-6 text-white" />
                                <span className="text-xs font-medium text-white">View Full Size</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted mr-4 flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed">
                            <div className="flex flex-col items-center gap-1 text-center">
                              <Image className="text-muted-foreground h-8 w-8" />
                              <span className="text-muted-foreground text-xs">No image</span>
                            </div>
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h5 className="text-sm font-medium">{asset.name}</h5>
                            <Badge variant="outline" className="text-xs">
                              {asset.category}
                            </Badge>
                            <Badge
                              className={
                                STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.color
                              }
                            >
                              {STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.label}
                            </Badge>
                            {asset.imageUrl && (
                              <Badge variant="secondary" className="text-xs">
                                <Image className="mr-1 h-3 w-3" />
                                Click to view
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Quantity:</span>
                              <span className="ml-1 font-medium">
                                <NumberFlowDisplay value={asset.operational} /> /{" "}
                                <NumberFlowDisplay value={asset.quantity} />
                              </span>
                            </div>
                            {asset.acquisitionCost > 0 && (
                              <div>
                                <span className="text-muted-foreground">Unit Cost:</span>
                                <span className="ml-1 font-medium">
                                  $
                                  <NumberFlowDisplay
                                    value={asset.acquisitionCost}
                                    format="compact"
                                  />
                                </span>
                              </div>
                            )}
                            {asset.maintenanceCost > 0 && (
                              <div>
                                <span className="text-muted-foreground">Maintenance:</span>
                                <span className="ml-1 font-medium">
                                  $
                                  <NumberFlowDisplay
                                    value={asset.maintenanceCost}
                                    format="compact"
                                  />
                                  /yr
                                </span>
                              </div>
                            )}
                          </div>

                          {asset.capability && (
                            <p className="text-muted-foreground mt-2 line-clamp-1 text-xs">
                              {asset.capability}
                            </p>
                          )}

                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Modernization</span>
                              <span className="font-medium">{asset.modernizationLevel}%</span>
                            </div>
                            <Progress value={asset.modernizationLevel} className="h-1" />
                          </div>
                        </div>

                        <div className="ml-2 flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(asset);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(asset.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
          No assets yet. Add your first asset to get started.
        </div>
      )}

      {/* Image Viewing Modal */}
      {viewingImage && (
        <Dialog open={true} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingImage.name}</DialogTitle>
              <DialogDescription>
                Equipment Image - Click outside to close
              </DialogDescription>
            </DialogHeader>
            <div className="relative w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
              <img
                src={viewingImage.url}
                alt={viewingImage.name}
                className="h-auto w-full object-contain"
                style={{ maxHeight: "70vh" }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AssetDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        asset={editingAsset}
        branchId={branchId}
        branchType={branchType}
        onCreate={(data) => createAsset.mutate({ branchId, asset: data })}
        onUpdate={(id, data) => updateAsset.mutate({ id, asset: data })}
      />
    </div>
  );
}

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any | null;
  branchId: string;
  branchType: string;
  onCreate: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
}

function AssetDialog({
  open,
  onOpenChange,
  asset,
  branchId,
  branchType,
  onCreate,
  onUpdate,
}: AssetDialogProps) {
  const [activeTab, setActiveTab] = useState("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEra, setSelectedEra] = useState<string>("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");

  const [formData, setFormData] = useState({
    assetType: asset?.assetType ?? "aircraft",
    category: asset?.category ?? "",
    name: asset?.name ?? "",
    quantity: asset?.quantity ?? 1,
    operational: asset?.operational ?? 1,
    capability: asset?.capability ?? "",
    range: asset?.range ?? 0,
    payload: asset?.payload ?? 0,
    status: asset?.status ?? "operational",
    modernizationLevel: asset?.modernizationLevel ?? 50,
    acquisitionCost: asset?.acquisitionCost ?? 0,
    maintenanceCost: asset?.maintenanceCost ?? 0,
    imageUrl: asset?.imageUrl || "",
  });

  React.useEffect(() => {
    if (asset) {
      setFormData({
        ...asset,
        imageUrl: asset.imageUrl || "",
      });
    }
  }, [asset, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    if (asset) {
      onUpdate(asset.id, formData);
    } else {
      onCreate(formData);
    }
  };

  const loadEquipment = (equipment: any) => {
    setFormData({
      ...formData,
      name: equipment.name,
      category: equipment.category,
      capability: equipment.role ?? equipment.category,
      range: equipment.range ?? 0,
      payload: equipment.payload ?? 0,
      acquisitionCost: equipment.acquisitionCost ?? 0,
      maintenanceCost: equipment.maintenanceCost ?? 0,
      modernizationLevel:
        MILITARY_ERAS[equipment.era as keyof typeof MILITARY_ERAS]?.techLevel ?? 50,
      imageUrl: equipment.imageUrl || "",
    });
    setActiveTab("manual");
    toast.success("Equipment template loaded" + (equipment.imageUrl ? " with image" : ""));
  };

  // Filter equipment database - now includes all 150+ items from expanded database
  const allEquipment = [
    // Expanded database with 250+ items and images
    ...Object.entries(EXPANDED_MILITARY_DATABASE.fighters_gen5 ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.fighters_gen4_5 ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.attack_aircraft ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.bombers ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.transport ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.helicopters ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "aircraft",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.naval_ships ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "ship",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.ground_vehicles ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "vehicle",
    })),
    ...Object.entries(EXPANDED_MILITARY_DATABASE.weapon_systems ?? {}).map(([key, value]) => ({
      ...value,
      key,
      type: "weapon_system",
    })),
  ];

  const filteredEquipment = allEquipment.filter((eq) => {
    const matchesSearch = !searchQuery || eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEra = selectedEra === "all" || eq.era === selectedEra;
    const matchesManufacturer =
      selectedManufacturer === "all" || eq.manufacturer === selectedManufacturer;
    const matchesType = formData.assetType === eq.type;

    return matchesSearch && matchesEra && matchesManufacturer && matchesType;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
          <DialogDescription>
            Browse real-world military equipment or create custom assets
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Equipment</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {/* Search and Filters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search equipment..."
                  className="pl-9"
                />
              </div>
              <Select value={selectedEra} onValueChange={setSelectedEra}>
                <SelectTrigger>
                  <SelectValue placeholder="All Eras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Eras</SelectItem>
                  {Object.entries(MILITARY_ERAS).map(([key, era]) => (
                    <SelectItem key={key} value={key}>
                      {era.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                <SelectTrigger>
                  <SelectValue placeholder="All Manufacturers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Manufacturers</SelectItem>
                  {Object.entries(DEFENSE_MANUFACTURERS).map(([key, mfg]) => (
                    <SelectItem key={key} value={key}>
                      {mfg.name} ({mfg.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Equipment List */}
            <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto">
              {filteredEquipment.map((equipment) => {
                const manufacturer =
                  DEFENSE_MANUFACTURERS[
                    equipment.manufacturer as keyof typeof DEFENSE_MANUFACTURERS
                  ];
                const era = MILITARY_ERAS[equipment.era as keyof typeof MILITARY_ERAS];
                const imageUrl = (equipment as any).imageUrl;

                return (
                  <div
                    key={equipment.key}
                    className="hover:border-primary/50 group relative cursor-pointer overflow-hidden rounded-lg border transition-all"
                    onClick={() => loadEquipment(equipment)}
                  >
                    {/* Background Image with Glass Blur Effect */}
                    {imageUrl && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-20 transition-opacity group-hover:opacity-30"
                        style={{
                          backgroundImage: `url(${imageUrl})`,
                        }}
                      />
                    )}

                    {/* Glass Overlay */}
                    <div className="bg-background/80 relative p-3 backdrop-blur-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h5 className="text-sm font-medium">{equipment.name}</h5>
                            <Badge variant="outline" className="text-xs">
                              {equipment.category}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {era?.label.split(" ")[0]}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {manufacturer?.name} • {manufacturer?.country}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs">
                            <span>
                              <span className="text-muted-foreground">Cost:</span> $
                              <NumberFlowDisplay
                                value={equipment.acquisitionCost}
                                format="compact"
                              />
                            </span>
                            {(equipment as any).range && (
                              <span>
                                <span className="text-muted-foreground">Range:</span>{" "}
                                {(equipment as any).range} km
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Select
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredEquipment.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No equipment found matching your criteria
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            {/* Asset Type */}
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select
                value={formData.assetType}
                onValueChange={(value) => setFormData({ ...formData, assetType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., F-35 Lightning II"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Multirole Fighter"
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Operational</Label>
                <Input
                  type="number"
                  value={formData.operational}
                  onChange={(e) =>
                    setFormData({ ...formData, operational: parseInt(e.target.value) || 1 })
                  }
                  max={formData.quantity}
                />
              </div>
            </div>

            {/* Capability */}
            <div className="space-y-2">
              <Label>Capability / Description (Optional)</Label>
              <Input
                value={formData.capability}
                onChange={(e) => setFormData({ ...formData, capability: e.target.value })}
                placeholder="Brief description of capabilities"
              />
            </div>

            {/* Performance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Range (km) (Optional)</Label>
                <Input
                  type="number"
                  value={formData.range}
                  onChange={(e) =>
                    setFormData({ ...formData, range: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Payload (kg) (Optional)</Label>
                <Input
                  type="number"
                  value={formData.payload}
                  onChange={(e) =>
                    setFormData({ ...formData, payload: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modernization Level */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Modernization Level</Label>
                <span className="text-sm font-medium">{formData.modernizationLevel}%</span>
              </div>
              <Slider
                value={[formData.modernizationLevel]}
                onValueChange={([value]) => setFormData({ ...formData, modernizationLevel: value })}
                max={100}
                step={1}
              />
            </div>

            <Separator />

            {/* Costs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Acquisition Cost ($)</Label>
                <Input
                  type="number"
                  value={formData.acquisitionCost}
                  onChange={(e) =>
                    setFormData({ ...formData, acquisitionCost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Maintenance ($)</Label>
                <Input
                  type="number"
                  value={formData.maintenanceCost}
                  onChange={(e) =>
                    setFormData({ ...formData, maintenanceCost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Equipment Image */}
            <div className="space-y-2">
              <Label>Equipment Image</Label>
              {formData.imageUrl ? (
                <div className="relative overflow-hidden rounded-lg border-2 border-orange-200 dark:border-orange-900">
                  <img
                    src={formData.imageUrl}
                    alt="Equipment preview"
                    className="h-48 w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const url = window.prompt("Enter image URL:", formData.imageUrl || "");
                        if (url !== null) {
                          setFormData({ ...formData, imageUrl: url });
                        }
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Change Image
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setFormData({ ...formData, imageUrl: "" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-32 w-full border-2 border-dashed"
                  onClick={() => {
                    const url = window.prompt(
                      "Enter image URL from Wikimedia Commons:",
                      "https://upload.wikimedia.org/wikipedia/commons/"
                    );
                    if (url) {
                      setFormData({ ...formData, imageUrl: url });
                    }
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Image className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium">Add Equipment Image</span>
                    <span className="text-xs text-muted-foreground">
                      Click to enter image URL
                    </span>
                  </div>
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Template equipment includes images automatically. Custom assets can add images from Wikimedia Commons.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {asset ? "Update Asset" : "Add Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
