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
import {
  Settings,
  DollarSign,
  Network,
  TrendingUp,
  Target,
  Users,
  Award,
  Palette,
  Briefcase,
  Zap,
  Factory,
  Leaf,
  Building2,
} from "lucide-react";
import { EconomicComponentType, ComponentType } from "~/lib/enums";
import {
  type ComponentFormData,
  COMPONENT_CATEGORIES,
  COMPLEXITY_LEVELS,
  COLOR_OPTIONS,
} from "~/lib/admin/economic-component-transforms";

interface EconomicComponentFormDialogProps {
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

export function EconomicComponentFormDialog({
  isOpen,
  isEditing,
  formData,
  setFormData,
  activeTab,
  setActiveTab,
  onClose,
  onSave,
  isPending,
}: EconomicComponentFormDialogProps) {
  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "costs", label: "Costs", icon: DollarSign },
    { id: "relationships", label: "Relationships", icon: Network },
    { id: "taxImpact", label: "Tax Impact", icon: TrendingUp },
    { id: "sectorImpact", label: "Sector Impact", icon: Target },
    { id: "employmentImpact", label: "Employment Impact", icon: Users },
    { id: "metadata", label: "Metadata", icon: Award },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  const allEconomicComponentTypes = Object.values(EconomicComponentType);
  const allGovernmentComponentTypes = Object.values(ComponentType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Component" : "Add Component"}</DialogTitle>
          <DialogDescription>
            Configure the economic component and its impact calculations
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
            <TabsContent value="relationships">
              <RelationshipsTab
                formData={formData}
                setFormData={setFormData}
                allEconomicComponentTypes={allEconomicComponentTypes}
                allGovernmentComponentTypes={allGovernmentComponentTypes}
              />
            </TabsContent>
            <TabsContent value="taxImpact">
              <TaxImpactTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="sectorImpact">
              <SectorImpactTab formData={formData} setFormData={setFormData} />
            </TabsContent>
            <TabsContent value="employmentImpact">
              <EmploymentImpactTab formData={formData} setFormData={setFormData} />
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
            setFormData((prev) => ({ ...prev, type: value as EconomicComponentType }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(EconomicComponentType).map((type) => (
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
          placeholder="e.g., Free Market System"
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

function RelationshipsTab({
  formData,
  setFormData,
  allEconomicComponentTypes,
  allGovernmentComponentTypes,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
  allEconomicComponentTypes: EconomicComponentType[];
  allGovernmentComponentTypes: ComponentType[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Economic Synergies</label>
        <MultiSelect
          options={allEconomicComponentTypes as readonly string[]}
          value={formData.synergies}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, synergies: value as EconomicComponentType[] }))
          }
          placeholder="Select components that synergize..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Economic components that work well together for multiplied effectiveness
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Economic Conflicts</label>
        <MultiSelect
          options={allEconomicComponentTypes as readonly string[]}
          value={formData.conflicts}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, conflicts: value as EconomicComponentType[] }))
          }
          placeholder="Select conflicting components..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Economic components that conflict or reduce effectiveness when combined
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Government Synergies
        </label>
        <MultiSelect
          options={allGovernmentComponentTypes as readonly string[]}
          value={formData.governmentSynergies}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, governmentSynergies: value as string[] }))
          }
          placeholder="Select government components that synergize..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Government components that enhance this economic component
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Government Conflicts
        </label>
        <MultiSelect
          options={allGovernmentComponentTypes as readonly string[]}
          value={formData.governmentConflicts}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, governmentConflicts: value as string[] }))
          }
          placeholder="Select government components that conflict..."
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Government components that reduce this economic component's effectiveness
        </p>
      </div>
    </div>
  );
}

function TaxImpactTab({
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
          Optimal Corporate Tax Rate: {formData.taxImpact.optimalCorporateRate}%
        </label>
        <Slider
          value={[formData.taxImpact.optimalCorporateRate]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              taxImpact: { ...prev.taxImpact, optimalCorporateRate: value },
            }))
          }
          min={0}
          max={50}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Recommended corporate tax rate for this economic model (0-50%)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Optimal Income Tax Rate: {formData.taxImpact.optimalIncomeRate}%
        </label>
        <Slider
          value={[formData.taxImpact.optimalIncomeRate]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              taxImpact: { ...prev.taxImpact, optimalIncomeRate: value },
            }))
          }
          min={0}
          max={60}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Recommended income tax rate for this economic model (0-60%)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Revenue Efficiency: {formData.taxImpact.revenueEfficiency}%
        </label>
        <Slider
          value={[formData.taxImpact.revenueEfficiency]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              taxImpact: { ...prev.taxImpact, revenueEfficiency: value },
            }))
          }
          min={0}
          max={100}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Tax collection efficiency for this economic model (0-100%)
        </p>
      </div>
    </div>
  );
}

function SectorImpactTab({
  formData,
  setFormData,
}: {
  formData: ComponentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ComponentFormData>>;
}) {
  const sectors = [
    { key: "services", label: "Services Sector", icon: Briefcase },
    { key: "finance", label: "Finance Sector", icon: DollarSign },
    { key: "technology", label: "Technology Sector", icon: Zap },
    { key: "manufacturing", label: "Manufacturing Sector", icon: Factory },
    { key: "agriculture", label: "Agriculture Sector", icon: Leaf },
    { key: "government", label: "Government Sector", icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <p className="mb-4 text-sm text-[--intel-silver]">
        Set multipliers for each economic sector (0.0 = no impact, 1.0 = neutral, 2.0 = doubled
        impact)
      </p>
      {sectors.map((sector) => {
        const Icon = sector.icon;
        return (
          <div key={sector.key}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-[--intel-gold]" />
              <label className="text-foreground text-sm font-medium">
                {sector.label}:{" "}
                {formData.sectorImpact[sector.key as keyof typeof formData.sectorImpact].toFixed(1)}
                x
              </label>
            </div>
            <Slider
              value={[formData.sectorImpact[sector.key as keyof typeof formData.sectorImpact]]}
              onValueChange={([value]) =>
                setFormData((prev) => ({
                  ...prev,
                  sectorImpact: { ...prev.sectorImpact, [sector.key]: value },
                }))
              }
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        );
      })}
    </div>
  );
}

function EmploymentImpactTab({
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
          Unemployment Modifier: {formData.employmentImpact.unemploymentModifier.toFixed(1)}
        </label>
        <Slider
          value={[formData.employmentImpact.unemploymentModifier]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              employmentImpact: { ...prev.employmentImpact, unemploymentModifier: value },
            }))
          }
          min={-2}
          max={2}
          step={0.1}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Effect on unemployment rate (negative = reduces unemployment, positive = increases)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Participation Modifier: {formData.employmentImpact.participationModifier.toFixed(1)}x
        </label>
        <Slider
          value={[formData.employmentImpact.participationModifier]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              employmentImpact: { ...prev.employmentImpact, participationModifier: value },
            }))
          }
          min={0.5}
          max={2}
          step={0.1}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Multiplier for labor force participation rate (0.5-2.0x)
        </p>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">
          Wage Growth Modifier: {formData.employmentImpact.wageGrowthModifier.toFixed(1)}x
        </label>
        <Slider
          value={[formData.employmentImpact.wageGrowthModifier]}
          onValueChange={([value]) =>
            setFormData((prev) => ({
              ...prev,
              employmentImpact: { ...prev.employmentImpact, wageGrowthModifier: value },
            }))
          }
          min={0.5}
          max={2}
          step={0.1}
        />
        <p className="mt-1 text-xs text-[--intel-silver]">
          Multiplier for wage growth rate (0.5-2.0x)
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
          placeholder="e.g., Factory, Building2, Users"
        />
        <p className="mt-1 text-xs text-[--intel-silver]">Icon name from lucide-react library</p>
      </div>
    </div>
  );
}
