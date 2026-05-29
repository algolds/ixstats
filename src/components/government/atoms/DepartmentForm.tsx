"use client";

/**
 * Department Form Component (Refactored)
 *
 * Configures the parameters of a single government department.
 * Integrates contextual selection of Atomic Components directly relating to the department's category.
 */

import React, { useState, useRef, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import {
  Plus,
  X,
  Shield,
  GraduationCap,
  Heart,
  Briefcase,
  Truck,
  Leaf,
  Users,
  Building,
  Globe,
  Zap,
  Wifi,
  Palette,
  Beaker,
  Home,
  Medal,
  Eye,
  AlertTriangle,
  MoreHorizontal,
  Info,
  CheckCircle,
} from "lucide-react";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/atomic-government-data";
import { checkGovernmentConflict } from "~/lib/atomic-government-utils";
import type { DepartmentInput, DepartmentCategory, OrganizationalLevel } from "~/types/government";

interface DepartmentFormProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
  availableParents?: { id: string; name: string }[];
  errors?: Record<string, string[]>;
  governmentComponents?: ComponentType[];
  onGovernmentComponentsChange?: (components: ComponentType[]) => void;
}

const departmentCategories: DepartmentCategory[] = [
  "Defense",
  "Education",
  "Health",
  "Finance",
  "Foreign Affairs",
  "Interior",
  "Justice",
  "Transportation",
  "Agriculture",
  "Environment",
  "Labor",
  "Commerce",
  "Energy",
  "Communications",
  "Culture",
  "Science and Technology",
  "Social Services",
  "Housing",
  "Veterans Affairs",
  "Intelligence",
  "Emergency Management",
  "Other",
];

const organizationalLevels: OrganizationalLevel[] = [
  "Ministry",
  "Department",
  "Agency",
  "Bureau",
  "Office",
  "Commission",
];

const categoryIcons = {
  Defense: Shield,
  Education: GraduationCap,
  Health: Heart,
  Finance: Briefcase,
  "Foreign Affairs": Globe,
  Interior: Home,
  Justice: Users,
  Transportation: Truck,
  Agriculture: Leaf,
  Environment: Leaf,
  Labor: Users,
  Commerce: Building,
  Energy: Zap,
  Communications: Wifi,
  Culture: Palette,
  "Science and Technology": Beaker,
  "Social Services": Heart,
  Housing: Home,
  "Veterans Affairs": Medal,
  Intelligence: Eye,
  "Emergency Management": AlertTriangle,
  Other: MoreHorizontal,
};

const categoryColors = {
  Defense: "#dc2626",
  Education: "#2563eb",
  Health: "#059669",
  Finance: "#7c3aed",
  "Foreign Affairs": "#0891b2",
  Interior: "#ea580c",
  Justice: "#4338ca",
  Transportation: "#0d9488",
  Agriculture: "#65a30d",
  Environment: "#059669",
  Labor: "#7c2d12",
  Commerce: "#1d4ed8",
  Energy: "#eab308",
  Communications: "#6366f1",
  Culture: "#ec4899",
  "Science and Technology": "#8b5cf6",
  "Social Services": "#ef4444",
  Housing: "#f59e0b",
  "Veterans Affairs": "#10b981",
  Intelligence: "#374151",
  "Emergency Management": "#dc2626",
  Other: "#6b7280",
};

// Map department category to relevant atomic components
const categoryToComponents: Record<string, ComponentType[]> = {
  Defense: [
    ComponentType.MILITARY_ENFORCEMENT,
    ComponentType.MILITARY_ADMINISTRATION,
    ComponentType.SECURITY_ALLIANCES,
    ComponentType.CYBERSECURITY,
    ComponentType.COUNTER_TERRORISM,
  ],
  Health: [
    ComponentType.UNIVERSAL_HEALTHCARE,
    ComponentType.WELFARE_STATE,
    ComponentType.PANDEMIC_MANAGEMENT,
  ],
  Education: [ComponentType.PUBLIC_EDUCATION, ComponentType.KNOWLEDGE_ECONOMY],
  Interior: [
    ComponentType.SURVEILLANCE_SYSTEM,
    ComponentType.DISASTER_PREPAREDNESS,
    ComponentType.EMERGENCY_RESPONSE,
    ComponentType.RECOVERY_PLANNING,
    ComponentType.RESILIENCE_BUILDING,
  ],
  Justice: [
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.RULE_OF_LAW,
    ComponentType.ANTI_CORRUPTION,
    ComponentType.ETHICS_ENFORCEMENT,
    ComponentType.PUBLIC_OVERSIGHT,
  ],
  "Science and Technology": [
    ComponentType.RESEARCH_AND_DEVELOPMENT,
    ComponentType.INNOVATION_ECOSYSTEM,
    ComponentType.TECHNOLOGY_TRANSFER,
    ComponentType.ENTREPRENEURSHIP_SUPPORT,
    ComponentType.INTELLECTUAL_PROPERTY,
    ComponentType.STARTUP_INCUBATION,
    ComponentType.DIGITAL_INFRASTRUCTURE,
  ],
  Communications: [ComponentType.DIGITAL_INFRASTRUCTURE, ComponentType.CYBERSECURITY],
  "Social Services": [
    ComponentType.SOCIAL_SAFETY_NET,
    ComponentType.WORKER_PROTECTION,
    ComponentType.WELFARE_STATE,
    ComponentType.COMPREHENSIVE_WELFARE,
  ],
  Housing: [ComponentType.SOCIAL_SAFETY_NET, ComponentType.WELFARE_STATE],
  Finance: [
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.TECHNOCRATIC_AGENCIES,
    ComponentType.ACCOUNTABILITY_FRAMEWORK,
    ComponentType.TRANSPARENCY_INITIATIVE,
  ],
  "Foreign Affairs": [
    ComponentType.MULTILATERAL_DIPLOMACY,
    ComponentType.BILATERAL_RELATIONS,
    ComponentType.REGIONAL_INTEGRATION,
    ComponentType.INTERNATIONAL_LAW,
    ComponentType.DEVELOPMENT_AID,
  ],
  Environment: [ComponentType.ENVIRONMENTAL_PROTECTION, ComponentType.ENVIRONMENTAL_FOCUS],
  Agriculture: [ComponentType.ENVIRONMENTAL_PROTECTION, ComponentType.ENVIRONMENTAL_FOCUS],
  Culture: [
    ComponentType.CULTURAL_PRESERVATION,
    ComponentType.MINORITY_RIGHTS,
    ComponentType.CITIZEN_ENGAGEMENT,
  ],
};

const fallbackComponents: ComponentType[] = [
  ComponentType.PROFESSIONAL_BUREAUCRACY,
  ComponentType.RULE_OF_LAW,
  ComponentType.CITIZEN_ENGAGEMENT,
];

export function DepartmentForm({
  data,
  onChange,
  onDelete,
  isReadOnly = false,
  availableParents = [],
  errors = {},
  governmentComponents = [],
  onGovernmentComponentsChange,
}: DepartmentFormProps) {
  const [newFunction, setNewFunction] = useState("");

  const dataRef = useRef(data);
  dataRef.current = data;

  const handleChange = useCallback(
    (field: keyof DepartmentInput, value: any) => {
      onChange({
        ...dataRef.current,
        [field]: value,
      });
    },
    [onChange]
  );

  const addFunction = () => {
    if (newFunction.trim()) {
      const currentFunctions = data.functions || [];
      handleChange("functions", [...currentFunctions, newFunction.trim()]);
      setNewFunction("");
    }
  };

  const removeFunction = (index: number) => {
    const currentFunctions = data.functions || [];
    handleChange(
      "functions",
      currentFunctions.filter((_, i) => i !== index)
    );
  };

  // Get active components linked to this category
  const relevantComponentTypes = categoryToComponents[data.category] || fallbackComponents;

  const handleToggleComponent = (compType: ComponentType) => {
    if (isReadOnly || !onGovernmentComponentsChange) return;

    if (governmentComponents.includes(compType)) {
      onGovernmentComponentsChange(governmentComponents.filter((c) => c !== compType));
    } else {
      if (governmentComponents.length >= 15) return; // Limit
      onGovernmentComponentsChange([...governmentComponents, compType]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold text-zinc-300">
            Department Name *
          </Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g., Ministry of Defense"
            disabled={isReadOnly}
            className="h-9 text-sm"
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shortName" className="text-xs font-semibold text-zinc-300">
            Short Name / Acronym
          </Label>
          <Input
            id="shortName"
            value={data.shortName || ""}
            onChange={(e) => handleChange("shortName", e.target.value)}
            placeholder="e.g., MoD"
            disabled={isReadOnly}
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs font-semibold text-zinc-300">
            Category *
          </Label>
          <Select
            value={data.category}
            onValueChange={(value: DepartmentCategory) => {
              onChange({
                ...data,
                category: value,
                color: categoryColors[value],
              });
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9 border-white/10 bg-zinc-900/60 text-sm">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-zinc-950 text-white">
              {departmentCategories.map((category) => {
                const Icon =
                  categoryIcons[category as keyof typeof categoryIcons] || MoreHorizontal;
                return (
                  <SelectItem key={category} value={category} className="hover:bg-zinc-800">
                    <div className="flex items-center">
                      <Icon
                        className="mr-2 h-4 w-4"
                        style={{ color: categoryColors[category as keyof typeof categoryColors] }}
                      />
                      {category}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="organizationalLevel" className="text-xs font-semibold text-zinc-300">
            Organizational Level
          </Label>
          <Select
            value={data.organizationalLevel}
            onValueChange={(value: OrganizationalLevel) =>
              handleChange("organizationalLevel", value)
            }
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9 border-white/10 bg-zinc-900/60 text-sm">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-zinc-950 text-white">
              {organizationalLevels.map((level) => (
                <SelectItem key={level} value={level} className="hover:bg-zinc-800">
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs font-semibold text-zinc-300">
          Role & Description
        </Label>
        <Textarea
          id="description"
          value={data.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Brief description of the department's role and responsibilities..."
          disabled={isReadOnly}
          rows={3}
          className="border-white/10 bg-zinc-900/60 text-sm transition-all focus:scale-[1.01]"
        />
      </div>

      {/* Minister info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ministerTitle" className="text-xs font-semibold text-zinc-300">
            Ministerial Title
          </Label>
          <Input
            id="ministerTitle"
            value={data.ministerTitle}
            onChange={(e) => handleChange("ministerTitle", e.target.value)}
            placeholder="e.g., Minister, Secretary"
            disabled={isReadOnly}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minister" className="text-xs font-semibold text-zinc-300">
            {data.ministerTitle || "Minister"} Name
          </Label>
          <Input
            id="minister"
            value={data.minister || ""}
            onChange={(e) => handleChange("minister", e.target.value)}
            placeholder="e.g., Jane Doe"
            disabled={isReadOnly}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Priority Level Slider */}
      <div className="space-y-2 rounded-xl border border-white/5 bg-zinc-900/20 p-4">
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs font-semibold text-zinc-300">Priority Level</Label>
          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-400">
            {data.priority}%
          </Badge>
        </div>
        <Slider
          value={[data.priority]}
          onValueChange={(val) => handleChange("priority", val[0])}
          min={1}
          max={100}
          step={1}
          disabled={isReadOnly}
          className="py-2"
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Low Priority</span>
          <span>High Priority</span>
        </div>
      </div>

      {/* Theme Color & Parent */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-300">Theme Color</Label>
          <ColorPickerInput
            value={data.color}
            onChange={(val) => handleChange("color", val)}
            disabled={isReadOnly}
          />
        </div>

        {availableParents.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="parentDepartment" className="text-xs font-semibold text-zinc-300">
              Parent Department
            </Label>
            <Select
              value={data.parentDepartmentId || "no-parent"}
              onValueChange={(value) =>
                handleChange("parentDepartmentId", value === "no-parent" ? undefined : value)
              }
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-9 border-white/10 bg-zinc-900/60 text-sm">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-950 text-white">
                <SelectItem value="no-parent" className="hover:bg-zinc-800">
                  No Parent
                </SelectItem>
                {availableParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id} className="hover:bg-zinc-800">
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Functions Tags */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-zinc-300">Responsibilities & Functions</Label>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Input
              value={newFunction}
              onChange={(e) => setNewFunction(e.target.value)}
              placeholder="e.g., Maintain national cybersecurity networks"
              onKeyDown={(e) => e.key === "Enter" && addFunction()}
              className="h-9 text-sm"
            />
            <Button
              onClick={addFunction}
              size="sm"
              className="h-9 bg-zinc-800 text-white hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(data.functions || []).map((func, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 border-white/5 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
            >
              {func}
              {!isReadOnly && (
                <X
                  className="h-3 w-3 cursor-pointer hover:text-red-400"
                  onClick={() => removeFunction(index)}
                />
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Contextual Atomic Components selection section */}
      {onGovernmentComponentsChange && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <h4 className="text-sm font-bold text-zinc-200">Linked Governance Infrastructure</h4>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Toggle atomic components directly related to this ministry
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {relevantComponentTypes.map((compType) => {
              const comp = ATOMIC_COMPONENTS[compType];
              if (!comp) return null;

              const isSelected = governmentComponents.includes(compType);
              const CompIcon = comp.icon || Info;

              // Check if selecting this causes a conflict with anything selected
              const isConflicting = governmentComponents.some(
                (active) => active !== compType && checkGovernmentConflict(compType, active)
              );

              return (
                <div
                  key={compType}
                  onClick={() => handleToggleComponent(compType)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all duration-200 select-none",
                    isSelected
                      ? "border-amber-500/40 bg-amber-500/10 text-white shadow-[0_0_12px_rgba(245,158,11,0.05)]"
                      : "border-white/[0.05] bg-zinc-950/40 text-zinc-400 hover:border-white/15",
                    isConflicting && isSelected && "border-red-500/40 bg-red-500/5"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      isSelected ? "bg-amber-500/20 text-amber-400" : "bg-zinc-900 text-zinc-500"
                    )}
                  >
                    <CompIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isSelected ? "text-zinc-100" : "text-zinc-300"
                        )}
                      >
                        {comp.name}
                      </span>
                      {isSelected && (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] leading-normal text-zinc-400">
                      {comp.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[9px] font-medium text-zinc-500">
                      <span>Maint: ${comp.maintenanceCost.toLocaleString()}/yr</span>
                      <span>•</span>
                      <span>Complexity: {comp.metadata.complexity}</span>
                    </div>
                    {isConflicting && isSelected && (
                      <span className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Incompatible with other active selections
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete / Actions */}
      {onDelete && !isReadOnly && (
        <div className="flex justify-end border-t border-white/10 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="rounded-lg border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            Delete Department
          </Button>
        </div>
      )}
    </div>
  );
}
