"use client";

/**
 * Department Form Component (Refactored)
 *
 * Configures the parameters of a single government department.
 * Integrates contextual selection of Atomic Components directly relating to the department's category.
 */

import React, { useState, useRef, useCallback } from "react";
import { cn } from "~/lib/utils";
import { useTheme } from "~/context/theme-context";
import { Input } from "~/components/ui/input";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { Label } from "~/components/ui/label";
import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
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
  Upload,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { checkGovernmentConflict } from "~/lib/government/atomic-utils";
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

export function isImageIconSource(value: string | undefined): value is string {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/")
  );
}

export function resolveNamedDepartmentIcon(iconName: string | undefined): LucideIcon | null {
  if (!iconName || isImageIconSource(iconName)) return null;
  const icon = (LucideIcons as Record<string, unknown>)[iconName];
  return typeof icon === "function" ? (icon as LucideIcon) : null;
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

export const categoryIcons = {
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

export const categoryColors = {
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

const getPriorityDetails = (level: number) => {
  if (level <= 3) {
    return {
      label: "Low (Reactive)",
      desc: "Vulnerability to crises increased by +15%. Emergent sector issues resolve slowly. Operational capability is restricted.",
      color: "text-red-400 bg-red-500/10 border-red-500/20",
    };
  }
  if (level <= 6) {
    return {
      label: "Standard (Active)",
      desc: "Balanced operational stance. Baseline event occurrence. Regular response times to national and regional issues.",
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    };
  }
  if (level <= 8) {
    return {
      label: "High (Strategic)",
      desc: "Vulnerability to crises reduced by -20%. Fast resolution of events. Elevated operational preparedness.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    };
  }
  return {
    label: "Critical (Executive)",
    desc: "Vulnerability to crises reduced by -50%. Instant crisis resolution. High frequency of breakthrough events, but potential administrative exhaustion.",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };
};

// Map department category to relevant atomic components
export const categoryToComponents: Record<string, ComponentType[]> = {
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

export const fallbackComponents: ComponentType[] = [
  ComponentType.PROFESSIONAL_BUREAUCRACY,
  ComponentType.RULE_OF_LAW,
  ComponentType.CITIZEN_ENGAGEMENT,
];

export const categorySuggestions: Record<string, string[]> = {
  Defense: [
    "National Defense Operations",
    "Border Security & Control",
    "Military Readiness & Training",
    "Counter-Terrorism Operations",
    "Cyber Warfare & Cyber Defense",
    "Strategic Intelligence Gathering",
  ],
  Education: [
    "K-12 Curriculum Development",
    "Teacher Licensing & Certification",
    "School Infrastructure Funding",
    "Higher Education Support",
    "Vocational & Technical Training",
    "Student Loan Administration",
  ],
  Health: [
    "Disease Surveillance & Control",
    "Public Hospital Management",
    "Medical Research Funding",
    "Healthcare Subsidy Programs",
    "Pharmaceutical Safety Regulation",
    "Mental Health Support Services",
  ],
  Finance: [
    "National Budget Preparation",
    "Taxation & Revenue Policy",
    "Macroeconomic Forecasting",
    "Public Debt Management",
    "Financial Sector Regulation",
    "Treasury & Cash Management",
  ],
  "Foreign Affairs": [
    "Bilateral Diplomatic Relations",
    "Consular & Visa Services",
    "International Treaty Negotiation",
    "Foreign Development Aid",
    "Representation in Global Bodies",
    "Trade Agreement Advocacy",
  ],
  Interior: [
    "Local Government Liaison",
    "National Parks & Public Lands",
    "Electoral Registry & Elections",
    "Civil Registration & Records",
    "Domestic Resource Management",
    "Border Entry Infrastructure",
  ],
  Justice: [
    "Prosecution of Federal Crimes",
    "Court System Administration",
    "Correctional Facility Management",
    "Civil Rights Enforcement",
    "Anti-Corruption Investigations",
    "Legal Counsel to the Executive",
  ],
  Transportation: [
    "Highway System Maintenance",
    "Aviation Safety & Regulation",
    "Public Transit Subsidies",
    "Railway Network Planning",
    "Maritime Port Infrastructure",
    "Vehicle License & Registration",
  ],
  Agriculture: [
    "Crop Subsidy Administration",
    "Food Safety Inspections",
    "Agricultural Trade Support",
    "Livestock Health Monitoring",
    "Rural Development Programs",
    "Soil & Water Conservation",
  ],
  Environment: [
    "Air & Water Quality Monitoring",
    "Climate Mitigation Programs",
    "Wildlife & Habitat Protection",
    "Waste Management Regulation",
    "Renewable Energy Permitting",
    "Environmental Impact Auditing",
  ],
  Labor: [
    "Workplace Safety Inspections",
    "Minimum Wage Enforcement",
    "Unemployment Benefits",
    "Job Training Programs",
    "Labor Dispute Mediation",
    "Collective Bargaining Oversight",
  ],
  Commerce: [
    "Domestic Business Support",
    "Intellectual Property & Patents",
    "Census & Economic Data Collection",
    "Consumer Protection Standards",
    "Export Promotion Programs",
    "Industrial Sector Subsidies",
  ],
  Energy: [
    "Electrical Grid Reliability",
    "Nuclear Energy Safety Regulation",
    "Fossil Fuel Sector Permitting",
    "Clean Energy Research Funding",
    "Strategic Fuel Reserve Management",
    "Energy Efficiency Standards",
  ],
  Communications: [
    "Telecom Spectrum Allocation",
    "Broadband Infrastructure Grants",
    "Media Broadcast Licensing",
    "Consumer Telecom Protections",
    "Postal Service Administration",
    "Cybersecurity Infrastructure Standards",
  ],
  Culture: [
    "Historical Site Preservation",
    "Arts & Humanities Grants",
    "National Library & Archives",
    "Cultural Export Promotion",
    "Public Broadcasting Subsidies",
    "Indigenous Heritage Protection",
  ],
  "Science and Technology": [
    "Scientific Research Grants",
    "Space Exploration Programs",
    "Emerging Technology Standards",
    "STEM Education Initiatives",
    "Supercomputing & AI Infrastructure",
    "Technology Transfer Operations",
  ],
  "Social Services": [
    "Poverty Relief Programs",
    "Child Welfare & Protection",
    "Disability Benefit Auditing",
    "Elderly Care Support Services",
    "Food Security Assistance",
    "Community Development Block Grants",
  ],
  Housing: [
    "Affordable Housing Construction",
    "Mortgage Insurance Programs",
    "Fair Housing Law Enforcement",
    "Urban Renewal Initiatives",
    "Homelessness Support Grants",
    "Public Housing Maintenance",
  ],
  "Veterans Affairs": [
    "Veterans Healthcare System",
    "Disability Compensation Audits",
    "GI Bill Education Benefits",
    "Veterans Cemetery Administration",
    "Transition Assistance Programs",
    "Home Loan Guarantee Systems",
  ],
  Intelligence: [
    "Foreign Espionage Operations",
    "Signals Intelligence (SIGINT)",
    "Counter-Intelligence Operations",
    "Cyber Intelligence Ops",
    "Terrorist Threat Analysis",
    "Satellite Imagery Processing",
  ],
  "Emergency Management": [
    "Disaster Relief Operations",
    "Early Warning Alert Systems",
    "Emergency Shelter Logistics",
    "Hazard Mitigation Grants",
    "First Responder Training",
    "Critical Infrastructure Protection",
  ],
  Other: [
    "Inter-agency Policy Planning",
    "Regulatory Compliance Auditing",
    "Public Communication & Press",
    "Information Technology Support",
    "Administrative Record Keeping",
    "Internal Operations Oversight",
  ],
};

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
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === "dark";
  const [newFunction, setNewFunction] = useState("");
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const handleAddSuggestion = (text: string) => {
    const currentFunctions = data.functions || [];
    if (!currentFunctions.includes(text)) {
      handleChange("functions", [...currentFunctions, text]);
    }
  };

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
          <Label htmlFor="name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Department Name *
          </Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g., Ministry of Defense"
            disabled={isReadOnly}
            className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="shortName"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Short Name / Acronym
          </Label>
          <Input
            id="shortName"
            value={data.shortName || ""}
            onChange={(e) => handleChange("shortName", e.target.value)}
            placeholder="e.g., MoD"
            disabled={isReadOnly}
            className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="category"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
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
            <SelectTrigger className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950 dark:text-white">
              {departmentCategories.map((category) => {
                const Icon =
                  categoryIcons[category as keyof typeof categoryIcons] || MoreHorizontal;
                return (
                  <SelectItem
                    key={category}
                    value={category}
                    className="hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
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
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Theme Color & Symbol
          </Label>
          <div className="flex items-center gap-2">
            {(() => {
              const isValidColor = (c: string) => {
                if (!c) return false;
                return (
                  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ||
                  c.startsWith("rgba(") ||
                  c.startsWith("rgb(")
                );
              };
              const safeColor = isValidColor(data.color)
                ? data.color
                : categoryColors[data.category as keyof typeof categoryColors] || "#06b6d4";

              return (
                <ColorPickerInput
                  value={safeColor}
                  onChange={(val: string) => handleChange("color", val)}
                  disabled={isReadOnly}
                />
              );
            })()}

            {/* Logo/Symbol Upload Button (Brings standard MediaSearchModal) */}
            <div className="relative shrink-0">
              {data.icon ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-zinc-900/60">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-950">
                    {(() => {
                      const IconComponent = resolveNamedDepartmentIcon(data.icon);
                      if (IconComponent) {
                        return (
                          <IconComponent className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                        );
                      }
                      if (isImageIconSource(data.icon)) {
                        return (
                          <img src={data.icon} alt="Logo" className="h-full w-full object-cover" />
                        );
                      }
                      return <Info className="h-4 w-4 text-zinc-500" />;
                    })()}
                  </div>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange("icon", undefined)}
                      className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      title="Remove Logo"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMediaModalOpen(true)}
                  disabled={isReadOnly}
                  className="flex h-9 items-center gap-1 border-zinc-200 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Logo</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <Label
          htmlFor="description"
          className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Role & Description
        </Label>
        <Textarea
          id="description"
          value={data.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Brief description of the department's role and responsibilities..."
          disabled={isReadOnly}
          rows={3}
          className="border-zinc-200 bg-white text-sm text-zinc-900 transition-all focus:scale-[1.01] dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
        />
      </div>

      {/* Minister info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="ministerTitle"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Ministerial Title
          </Label>
          <Input
            id="ministerTitle"
            value={data.ministerTitle}
            onChange={(e) => handleChange("ministerTitle", e.target.value)}
            placeholder="e.g., Minister, Secretary"
            disabled={isReadOnly}
            className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="minister"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {data.ministerTitle || "Minister"} Name
          </Label>
          <Input
            id="minister"
            value={data.minister || ""}
            onChange={(e) => handleChange("minister", e.target.value)}
            placeholder="e.g., Jane Doe"
            disabled={isReadOnly}
            className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Priority Level Slider */}
      {(() => {
        const uiPriority = Math.max(1, Math.min(10, Math.round((data.priority || 50) / 10)));
        const priorityInfo = getPriorityDetails(uiPriority);

        return (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-100/50 p-4 dark:border-white/5 dark:bg-zinc-900/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Priority Level
                </Label>
                <p className="text-zinc-550 text-[10px] dark:text-zinc-400">
                  Determines sector crisis resistance and resolution speed
                </p>
              </div>
              <Badge
                className={cn(
                  "border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase transition-all",
                  priorityInfo.color
                )}
              >
                Level {uiPriority} • {priorityInfo.label}
              </Badge>
            </div>
            <Slider
              value={[uiPriority]}
              onValueChange={(val) => handleChange("priority", val[0] * 10)}
              min={1}
              max={10}
              step={1}
              disabled={isReadOnly}
              className="py-2"
            />
            <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200/40 p-2.5 text-[10px] leading-relaxed text-zinc-600 dark:border-white/5 dark:bg-black/30 dark:text-zinc-400">
              <TextureOverlay texture="chevron" opacity={0.03} />
              <div className="relative z-10">
                <span className="mb-0.5 block font-semibold text-zinc-800 dark:text-zinc-300">
                  Calculation Outcomes:
                </span>
                {priorityInfo.desc}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hierarchy: Organizational Level & Parent Department */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label
              htmlFor="organizationalLevel"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Organizational Level
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  <Info className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-[220px] border-zinc-200 bg-white p-2 text-[11px] text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              >
                Determines the bureaucratic tier and administrative status of this unit.
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={data.organizationalLevel}
            onValueChange={(value: OrganizationalLevel) =>
              handleChange("organizationalLevel", value)
            }
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent className="z-[100030] border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950 dark:text-white">
              {organizationalLevels.map((level) => {
                const levelDescriptions: Record<OrganizationalLevel, string> = {
                  Ministry:
                    "Primary cabinet-level executive organ led by a minister. Designs sector-wide policy.",
                  Department:
                    "Major branch of government with a specific, broad area of jurisdiction.",
                  Agency:
                    "Semi-autonomous specialized body with authority to execute policies & regulations.",
                  Bureau:
                    "Sub-division of a department handling specific regulatory or technical duties.",
                  Office: "Focused administrative or service unit dedicated to specific tasks.",
                  Commission:
                    "Independent regulatory or advisory body, typically led by multiple commissioners.",
                };

                return (
                  <Tooltip key={level}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <SelectItem
                          value={level}
                          className="w-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {level}
                        </SelectItem>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="z-[100040] max-w-xs border-zinc-200 bg-white p-2 text-[11px] text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                    >
                      {levelDescriptions[level]}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="parentDepartment"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Parent Department
          </Label>
          <Select
            value={data.parentDepartmentId || "no-parent"}
            onValueChange={(value) =>
              handleChange("parentDepartmentId", value === "no-parent" ? undefined : value)
            }
            disabled={isReadOnly || availableParents.length === 0}
          >
            <SelectTrigger className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100">
              <SelectValue placeholder="Select parent" />
            </SelectTrigger>
            <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950 dark:text-white">
              <SelectItem value="no-parent" className="hover:bg-zinc-100 dark:hover:bg-zinc-800">
                No Parent
              </SelectItem>
              {availableParents.map((parent) => (
                <SelectItem
                  key={parent.id}
                  value={parent.id}
                  className="hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {parent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableParents.length === 0 && (
            <p className="text-zinc-550 text-[10px] italic dark:text-zinc-400">
              Create other departments first to establish hierarchy.
            </p>
          )}
        </div>
      </div>

      {/* Functions Tags */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Responsibilities & Functions
        </Label>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Input
              value={newFunction}
              onChange={(e) => setNewFunction(e.target.value)}
              placeholder="e.g., Maintain national cybersecurity networks"
              onKeyDown={(e) => e.key === "Enter" && addFunction()}
              className="h-9 border-zinc-200 bg-white text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
            />
            <Button
              onClick={addFunction}
              size="sm"
              className="h-9 bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Suggested popular functions based on category */}
        {!isReadOnly && (
          <div className="space-y-1.5 rounded-lg border border-zinc-200/50 bg-zinc-100/50 p-2.5 dark:border-white/[0.03] dark:bg-black/10">
            <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Popular Suggested Functions ({data.category})
            </div>
            <div className="flex max-h-[120px] scrollbar-thin flex-wrap gap-1.5 overflow-y-auto pr-1">
              {(categorySuggestions[data.category] || categorySuggestions.Other).map(
                (suggestion) => {
                  const isSelected = (data.functions || []).includes(suggestion);
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => !isSelected && handleAddSuggestion(suggestion)}
                      disabled={isSelected}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-0.5 text-left text-[10px] transition-all select-none",
                        isSelected
                          ? "cursor-default border-emerald-500/20 bg-emerald-500/10 text-emerald-400 opacity-60"
                          : "text-zinc-650 border-zinc-200 bg-zinc-100 hover:border-zinc-300 hover:bg-zinc-200 hover:text-zinc-800 dark:border-white/5 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-white/10 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      )}
                    >
                      <span>{suggestion}</span>
                      {!isSelected && <Plus className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                      {isSelected && <CheckCircle className="h-2.5 w-2.5 shrink-0" />}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(data.functions || []).map((func, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-300"
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
        <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10">
          <div>
            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Linked Governance Infrastructure
            </h4>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
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

              const cardColor = data.color || "#06b6d4";

              return (
                <div
                  key={compType}
                  onClick={() => handleToggleComponent(compType)}
                  style={{
                    ["--hover-border-color" as any]: `${cardColor}40`,
                    ["--hover-bg-color" as any]: `${cardColor}08`,
                    ...(isSelected
                      ? {
                          borderColor: `${cardColor}50`,
                          backgroundColor: `${cardColor}12`,
                          boxShadow: `0 0 12px ${cardColor}08`,
                        }
                      : {}),
                  }}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-lg border p-3 transition-all duration-200 select-none",
                    isSelected
                      ? "text-zinc-900 dark:text-white"
                      : "border-zinc-200 bg-zinc-50/50 text-zinc-500 hover:border-[var(--hover-border-color)] hover:bg-[var(--hover-bg-color)] dark:border-white/[0.05] dark:bg-zinc-950/40 dark:text-zinc-400",
                    isConflicting && isSelected && "border-red-500/40 bg-red-500/5"
                  )}
                >
                  <TextureOverlay texture="chevron" opacity={0.02} />
                  <div
                    className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? `${cardColor}25`
                        : isDark
                          ? "rgba(24, 24, 27, 0.5)"
                          : "rgba(240, 240, 245, 0.8)",
                      color: isSelected ? cardColor : "#71717a",
                    }}
                  >
                    <CompIcon className="h-4 w-4" />
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isSelected
                            ? "text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        {comp.name}
                      </span>
                      {isSelected && (
                        <CheckCircle
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: cardColor }}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] leading-normal text-zinc-600 dark:text-zinc-400">
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
        <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-white/10">
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

      {/* Media Search Modal Portal */}
      <MediaSearchModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onImageSelect={(imageUrl) => {
          handleChange("icon", imageUrl);
          setIsMediaModalOpen(false);
        }}
      />
    </div>
  );
}
