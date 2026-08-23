"use client";

// src/components/admin/equipment/EquipmentFormDialog.tsx
// Equipment editor dialog with tabbed form (General, Specifications, Capabilities,
// Costs & Requirements, Media & Documentation).

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Settings, Page as FileText, Rocket, Dollar as DollarSign, MediaImage as Image } from "iconoir-react";
import {
  CATEGORIES,
  SUBCATEGORIES,
  ERAS,
  type EquipmentFormData,
} from "~/lib/military/catalog-utils";

interface EquipmentFormDialogProps {
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

export function EquipmentFormDialog({
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
}: EquipmentFormDialogProps) {
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
