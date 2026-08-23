"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
import { MultiSelect } from "~/components/ui/multi-select";
import { Settings, Dollar as DollarSign, Network, Trophy as Award, Palette } from "iconoir-react";
import { ComponentType } from "~/lib/enums";
import {
  type ComponentFormData,
  COMPONENT_CATEGORIES,
  COMPLEXITY_LEVELS,
  COLOR_OPTIONS,
} from "~/lib/admin/government-component-transforms";

interface GovernmentComponentFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}

export function GovernmentComponentFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  onClose,
  onSave,
  isPending,
}: GovernmentComponentFormDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "costs", label: "Costs", icon: DollarSign },
    { id: "synergies", label: "Synergies & Conflicts", icon: Network },
    { id: "metadata", label: "Metadata", icon: Award },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  const allComponentTypes = Object.values(ComponentType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Component" : "Add Component"}</DialogTitle>
          <DialogDescription>
            Configure the government component, its costs, capacity requirements, and synergy
            relationships
          </DialogDescription>
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
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`rounded px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                      : "hover:text-foreground text-[--intel-silver]"
                  }`}
                >
                  <Icon className="mr-1 inline h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <TabsContent value="general">
              <GeneralTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="costs">
              <CostsTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="synergies">
              <SynergiesTab
                formData={formData}
                setFormData={setFormData}
                allComponentTypes={allComponentTypes}
              />
            </TabsContent>
            <TabsContent value="metadata">
              <MetadataTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab formData={formData} setFormData={setFormData} />
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
            disabled={!formData.name || isPending}
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
          >
            {isPending ? "Saving..." : isEditing ? "Update Component" : "Create Component"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Component Type *</label>
        <Select
          value={formData.type}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, type: value as ComponentType }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ComponentType).map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Name *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Centralized Power"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of the component..."
          rows={3}
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Category</label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(COMPONENT_CATEGORIES).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Effectiveness Score: {formData.effectiveness}%
        </label>
        <Slider
          value={[formData.effectiveness]}
          onValueChange={([value]) => setFormData((prev) => ({ ...prev, effectiveness: value }))}
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}

function CostsTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Implementation Cost ($)
        </label>
        <Input
          type="number"
          value={formData.implementationCost}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              implementationCost: parseFloat(e.target.value) || 0,
            }))
          }
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Maintenance Cost ($ / year)
        </label>
        <Input
          type="number"
          value={formData.maintenanceCost}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              maintenanceCost: parseFloat(e.target.value) || 0,
            }))
          }
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Required Capacity: {formData.requiredCapacity}%
        </label>
        <Slider
          value={[formData.requiredCapacity]}
          onValueChange={([value]) =>
            setFormData((prev) => ({ ...prev, requiredCapacity: value }))
          }
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}

function SynergiesTab({
  formData,
  setFormData,
  allComponentTypes,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
  allComponentTypes: ComponentType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Synergies</label>
        <MultiSelect
          options={allComponentTypes as readonly string[]}
          value={formData.synergies}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, synergies: value as ComponentType[] }))
          }
          placeholder="Select components that synergize..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Components that work well together and provide bonus effectiveness
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Conflicts</label>
        <MultiSelect
          options={allComponentTypes as readonly string[]}
          value={formData.conflicts}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, conflicts: value as ComponentType[] }))
          }
          placeholder="Select conflicting components..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Components that conflict or cannot be used together
        </p>
      </div>
    </div>
  );
}

function MetadataTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Complexity</label>
        <Select
          value={formData.complexity}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, complexity: value as "Low" | "Medium" | "High" }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPLEXITY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Time to Implement</label>
        <Input
          value={formData.timeToImplement}
          onChange={(e) => setFormData((prev) => ({ ...prev, timeToImplement: e.target.value }))}
          placeholder="e.g., 12 months"
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Staff Required</label>
        <Input
          type="number"
          value={formData.staffRequired}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, staffRequired: parseInt(e.target.value) || 0 }))
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="technologyRequired"
          checked={formData.technologyRequired}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, technologyRequired: checked as boolean }))
          }
        />
        <label htmlFor="technologyRequired" className="text-foreground cursor-pointer text-sm">
          Requires advanced technology
        </label>
      </div>
    </div>
  );
}

function AppearanceTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Color Theme</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, color }))}
              className={`rounded-lg border-2 p-3 transition-all ${
                formData.color === color
                  ? `border-${color}-400 bg-${color}-500/20`
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className={`h-8 w-full rounded bg-${color}-500`} />
              <p className="mt-1 text-center text-xs capitalize">{color}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Icon Name</label>
        <Input
          value={formData.icon}
          onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
          placeholder="e.g., Building2, Users, Shield"
        />
        <p className="mt-1 text-xs text-[--intel-silver]">Icon name from iconoir-react library</p>
      </div>
    </div>
  );
}
