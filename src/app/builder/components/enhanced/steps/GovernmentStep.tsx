// Government Step - Atomic components and structure for Atomic Builder
// Refactored to align with macOS/iOS design language and contextual Atomic Components

"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  Shield,
  Info,
  HelpCircle,
  Settings,
  Crown,
  Coins,
  Eye,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Network,
  Users,
  Cpu,
  Handshake,
  Scale,
  Vote,
  Clock,
  TrendingUp,
  Star,
  Cross,
  Target,
  BarChart3,
  Heart,
  Building,
  Leaf,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { stepConfig } from "../builderConfig";
import { Label } from "~/components/ui/label";
import { GovernmentStructureForm } from "~/components/government/atoms/GovernmentStructureForm";
import { RevenueSourceForm } from "~/components/government/atoms/RevenueSourceForm";
import { DepartmentList } from "~/components/builder/government/DepartmentList";
import { BudgetAllocationList } from "~/components/builder/government/BudgetAllocationList";
import { GovernmentSpendingSection } from "~/app/builder/sections/GovernmentSpendingSection";
import { GovernmentStructurePreview } from "../GovernmentStructurePreview";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { ComponentType } from "@prisma/client";
import {
  detectSynergies,
  detectConflicts,
  calculateGovernmentEffectiveness,
} from "~/lib/atomic-government-utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

interface GovernmentStepProps {
  economicInputs: EconomicInputs;
  selectedCountry: RealCountryData | null;
  governmentComponents: ComponentType[];
  governmentStructure: any;
  activeGovernmentTab: string;
  onGovernmentComponentsChange: (components: ComponentType[]) => void;
  onGovernmentStructureChange: (structure: any) => void;
  onGovernmentStructureSave: (structure: any) => Promise<void>;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onTabChange: (tab: string) => void;
}

// Custom circular ring rendering
function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const radius = 28;
  const strokeWidth = 5.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg className="h-full w-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-100">
          {Math.round(value)}%
        </span>
      </div>
      <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">{label}</span>
    </div>
  );
}

// macOS style selection card grid for core setup
function SelectionCardGrid({
  title,
  subtitle,
  options,
  selectedValues,
  onToggle,
  isReadOnly,
}: {
  title: string;
  subtitle: string;
  options: { value: ComponentType; label: string; desc: string; icon: any }[];
  selectedValues: ComponentType[];
  onToggle: (val: ComponentType) => void;
  isReadOnly: boolean;
  maxSelect?: number;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">{title}</h4>
        <p className="mt-0.5 text-[10px] text-zinc-500">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value);
          const Icon = opt.icon;
          return (
            <div
              key={opt.value}
              onClick={() => {
                if (isReadOnly) return;
                onToggle(opt.value);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all duration-150 select-none active:scale-[0.99]",
                isSelected
                  ? "border-amber-500/30 bg-amber-500/10 text-white shadow-[0_0_12px_rgba(245,158,11,0.04)]"
                  : "border-white/[0.04] bg-zinc-950/20 text-zinc-400 hover:border-white/10"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? "bg-amber-500/20 text-amber-400" : "bg-zinc-900 text-zinc-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isSelected ? "text-zinc-100" : "text-zinc-300"
                    )}
                  >
                    {opt.label}
                  </span>
                  {isSelected && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                </div>
                <p className="mt-1 text-[10px] leading-normal text-zinc-400">{opt.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// macOS Control Center-style volume/brightness slider component
function AttributeSlider({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400">
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-900/60 p-[1px]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${value}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}

export function GovernmentStep({
  economicInputs,
  selectedCountry,
  governmentComponents,
  governmentStructure,
  activeGovernmentTab,
  onGovernmentComponentsChange,
  onGovernmentStructureChange,
  onGovernmentStructureSave,
  onEconomicInputsChange,
  onTabChange,
}: GovernmentStepProps) {
  // Safety Lock state
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Verification checkpoint state
  const [isVerified, setIsVerified] = useState(false);

  // Capture initial budget values on mount to detect changes
  const initialBudget = useRef<number | null>(null);
  const initialCurrency = useRef<string | null>(null);

  useEffect(() => {
    if (governmentStructure?.structure?.totalBudget && initialBudget.current === null) {
      initialBudget.current = governmentStructure.structure.totalBudget;
    }
    if (governmentStructure?.structure?.budgetCurrency && initialCurrency.current === null) {
      initialCurrency.current = governmentStructure.structure.budgetCurrency;
    }
  }, [governmentStructure]);

  // Compute metrics dynamically
  const effectivenessMetrics = useMemo(() => {
    return calculateGovernmentEffectiveness(governmentComponents);
  }, [governmentComponents]);

  const synergies = useMemo(() => detectSynergies(governmentComponents), [governmentComponents]);
  const conflicts = useMemo(() => detectConflicts(governmentComponents), [governmentComponents]);

  // Legitimacy formula based on components: electoral, traditional, performance, religious, charismatic
  const legitimacyScore = useMemo(() => {
    let score = 50; // base
    if (governmentComponents.includes(ComponentType.ELECTORAL_LEGITIMACY)) score += 15;
    if (governmentComponents.includes(ComponentType.TRADITIONAL_LEGITIMACY)) score += 10;
    if (governmentComponents.includes(ComponentType.PERFORMANCE_LEGITIMACY)) score += 15;
    if (governmentComponents.includes(ComponentType.CHARISMATIC_LEGITIMACY)) score += 10;
    if (governmentComponents.includes(ComponentType.RELIGIOUS_LEGITIMACY)) score += 10;

    // penalties
    score -= conflicts.length * 5;
    if (governmentComponents.includes(ComponentType.MILITARY_ENFORCEMENT)) score -= 12;
    if (governmentComponents.includes(ComponentType.SURVEILLANCE_SYSTEM)) score -= 8;

    return Math.min(100, Math.max(0, score));
  }, [governmentComponents, conflicts]);

  // Budget allocations percent sum
  const totalAllocatedPercent = useMemo(() => {
    if (!governmentStructure?.budgetAllocations) return 0;
    return governmentStructure.budgetAllocations.reduce(
      (sum: number, a: any) => sum + (a.allocatedPercent || 0),
      0
    );
  }, [governmentStructure]);

  // Budget health: peaks at 100% allocation
  const budgetHealthScore = useMemo(() => {
    const diff = Math.abs(100 - totalAllocatedPercent);
    return Math.max(0, 100 - diff);
  }, [totalAllocatedPercent]);

  // Administrative Efficiency slider based on components
  const administrativeEfficiency = useMemo(() => {
    let score = 50;
    if (governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) score += 20;
    if (governmentComponents.includes(ComponentType.TECHNOCRATIC_AGENCIES)) score += 15;
    if (governmentComponents.includes(ComponentType.PARTISAN_INSTITUTIONS)) score -= 15;
    if (governmentComponents.includes(ComponentType.MILITARY_ADMINISTRATION)) score -= 10;
    if (governmentStructure?.departments?.length > 8) {
      score -= (governmentStructure.departments.length - 8) * 3; // overhead
    }
    return Math.min(100, Math.max(10, score));
  }, [governmentComponents, governmentStructure]);

  // Political Stability slider based on synergies, conflicts, and law
  const politicalStability = useMemo(() => {
    let score = 60;
    score += synergies.length * 8;
    score -= conflicts.length * 12;
    if (governmentComponents.includes(ComponentType.RULE_OF_LAW)) score += 15;
    if (governmentComponents.includes(ComponentType.MILITARY_ENFORCEMENT)) score += 10;
    return Math.min(100, Math.max(5, score));
  }, [governmentComponents, synergies, conflicts]);

  // Warnings / Critical Changes Check
  const deltaWarning = useMemo(() => {
    if (!governmentStructure?.structure?.totalBudget || !initialBudget.current) return null;
    const current = governmentStructure.structure.totalBudget;
    const deltaPct = Math.abs((current - initialBudget.current) / initialBudget.current) * 100;
    if (deltaPct > 25) {
      return `Budget Delta Alert: The proposed budget of ${current.toLocaleString()} has changed by ${deltaPct.toFixed(1)}% compared to the country's baseline. Ensure revenue channels are sufficient to avoid instability.`;
    }
    return null;
  }, [governmentStructure]);

  const currencyChangeWarning = useMemo(() => {
    if (!governmentStructure?.structure?.budgetCurrency || !initialCurrency.current) return null;
    if (governmentStructure.structure.budgetCurrency !== initialCurrency.current) {
      return `Currency Conversion: Budget currency has changed from "${initialCurrency.current}" to "${governmentStructure.structure.budgetCurrency}". Ensure this aligns with trade partners.`;
    }
    return null;
  }, [governmentStructure]);

  // GDP cap warning
  const gdpCapWarning = useMemo(() => {
    const budget = governmentStructure?.structure?.totalBudget || 0;
    const gdp = economicInputs?.coreIndicators?.nominalGDP || 0;
    if (budget > gdp && gdp > 0) {
      return `GDP Threshold Violated: Total budget cannot exceed your country's nominal GDP (${gdp.toLocaleString()}). Please adjust the budget allocation or structure.`;
    }
    return null;
  }, [governmentStructure, economicInputs]);

  // Handle core structure atomic components toggle
  const handleToggleCoreComponent = (compType: ComponentType) => {
    if (!isUnlocked) return;
    let newComponents = [...governmentComponents];

    // Core categories represent exclusive choices inside their family, except Legitimacy which can have up to 2
    const powerComps: ComponentType[] = [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.CONFEDERATE_SYSTEM,
      ComponentType.UNITARY_SYSTEM,
    ];
    const decisionComps: ComponentType[] = [
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.AUTOCRATIC_PROCESS,
      ComponentType.TECHNOCRATIC_PROCESS,
      ComponentType.CONSENSUS_PROCESS,
      ComponentType.OLIGARCHIC_PROCESS,
    ];

    if (powerComps.includes(compType)) {
      newComponents = newComponents.filter((c) => !powerComps.includes(c));
      newComponents.push(compType);
    } else if (decisionComps.includes(compType)) {
      newComponents = newComponents.filter((c) => !decisionComps.includes(c));
      newComponents.push(compType);
    } else {
      // Legitimacy selection
      if (newComponents.includes(compType)) {
        newComponents = newComponents.filter((c) => c !== compType);
      } else {
        const legitimacyComps: ComponentType[] = [
          ComponentType.ELECTORAL_LEGITIMACY,
          ComponentType.TRADITIONAL_LEGITIMACY,
          ComponentType.PERFORMANCE_LEGITIMACY,
          ComponentType.CHARISMATIC_LEGITIMACY,
          ComponentType.RELIGIOUS_LEGITIMACY,
        ];
        const activeLegitimacy = newComponents.filter((c) => legitimacyComps.includes(c));
        if (activeLegitimacy.length >= 2) {
          // Replace the first selected legitimacy component
          newComponents = newComponents.filter((c) => c !== activeLegitimacy[0]);
        }
        newComponents.push(compType);
      }
    }
    onGovernmentComponentsChange(newComponents);
  };

  // Core options lists
  const powerOptions = [
    {
      value: ComponentType.CENTRALIZED_POWER,
      label: "Centralized Power",
      desc: "Central government holds principal policy and executive decisions.",
      icon: Settings,
    },
    {
      value: ComponentType.FEDERAL_SYSTEM,
      label: "Federal Distribution",
      desc: "Sovereign power shared between regional states and central government.",
      icon: Building2,
    },
    {
      value: ComponentType.CONFEDERATE_SYSTEM,
      label: "Confederation",
      desc: "Loose assembly of sovereign states with weak federal oversight.",
      icon: Network,
    },
    {
      value: ComponentType.UNITARY_SYSTEM,
      label: "Unitary System",
      desc: "Single national system with regional offices as direct subsidiaries.",
      icon: Crown,
    },
  ];

  const decisionOptions = [
    {
      value: ComponentType.DEMOCRATIC_PROCESS,
      label: "Democratic Process",
      desc: "Decisions made via parliamentary representation or franchise.",
      icon: Users,
    },
    {
      value: ComponentType.AUTOCRATIC_PROCESS,
      label: "Autocratic Process",
      desc: "Decisions handled unilaterally by executive command.",
      icon: Shield,
    },
    {
      value: ComponentType.TECHNOCRATIC_PROCESS,
      label: "Technocratic Process",
      desc: "Decisions delegated to academic and technical expert agencies.",
      icon: Cpu,
    },
    {
      value: ComponentType.CONSENSUS_PROCESS,
      label: "Consensus Process",
      desc: "Decisions require absolute stake-holder negotiation.",
      icon: Handshake,
    },
    {
      value: ComponentType.OLIGARCHIC_PROCESS,
      label: "Oligarchic Process",
      desc: "Decisions directed by a wealthy ruling executive class.",
      icon: Scale,
    },
  ];

  const legitimacyOptions = [
    {
      value: ComponentType.ELECTORAL_LEGITIMACY,
      label: "Electoral Legitimacy",
      desc: "Authority earned from regular transparent popular franchise.",
      icon: Vote,
    },
    {
      value: ComponentType.TRADITIONAL_LEGITIMACY,
      label: "Traditional Legitimacy",
      desc: "Authority founded on dynastic history or cultural precedence.",
      icon: Clock,
    },
    {
      value: ComponentType.PERFORMANCE_LEGITIMACY,
      label: "Performance Legitimacy",
      desc: "Authority maintained through concrete GDP and indicator results.",
      icon: TrendingUp,
    },
    {
      value: ComponentType.CHARISMATIC_LEGITIMACY,
      label: "Charismatic Legitimacy",
      desc: "Authority anchored to the strong persona and support of the leader.",
      icon: Star,
    },
    {
      value: ComponentType.RELIGIOUS_LEGITIMACY,
      label: "Religious Legitimacy",
      desc: "Authority grounded on scripture or institutional endorsement.",
      icon: Cross,
    },
  ];

  const economicGovernanceOptions = [
    {
      value: ComponentType.FREE_MARKET_SYSTEM,
      label: "Free Market System",
      desc: "Market pricing drives capital and production with negligible intervention.",
      icon: TrendingUp,
    },
    {
      value: ComponentType.PLANNED_ECONOMY,
      label: "Planned Economy",
      desc: "Centralized planning directives govern production and resources.",
      icon: Target,
    },
    {
      value: ComponentType.MIXED_ECONOMY,
      label: "Mixed Economy",
      desc: "Private property works alongside targeted government infrastructure.",
      icon: BarChart3,
    },
    {
      value: ComponentType.CORPORATIST_SYSTEM,
      label: "Corporatist System",
      desc: "Capital and labor cartels negotiate regulatory policy via the state.",
      icon: Building2,
    },
    {
      value: ComponentType.SOCIAL_MARKET_ECONOMY,
      label: "Social Market Economy",
      desc: "Market principles integrated with high regulatory protections.",
      icon: Heart,
    },
    {
      value: ComponentType.STATE_CAPITALISM,
      label: "State Capitalism",
      desc: "Commercial enterprises owned and directed by central agencies.",
      icon: Building,
    },
    {
      value: ComponentType.RESOURCE_BASED_ECONOMY,
      label: "Resource Economy",
      desc: "National capital flows heavily from resource extraction exports.",
      icon: Leaf,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Dynamic Vitality Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/65 p-6 shadow-xl backdrop-blur-xl">
        <TextureOverlay texture="paperGrain" opacity={0.05} />
        <TextureOverlay texture="chevron" opacity={0.03} />

        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Section 1: Vitality Rings */}
          <div className="flex justify-around border-r border-white/5 pr-2 lg:col-span-5">
            <Ring value={legitimacyScore} color="#10b981" label="Legitimacy" />
            <Ring
              value={effectivenessMetrics.totalEffectiveness}
              color="#8b5cf6"
              label="Effectiveness"
            />
            <Ring value={budgetHealthScore} color="#f59e0b" label="Budget Health" />
          </div>

          {/* Section 2: Attribute Sliders */}
          <div className="space-y-3.5 border-r border-white/5 px-4 lg:col-span-4">
            <AttributeSlider
              label="Administrative Efficiency"
              value={administrativeEfficiency}
              color="#3b82f6"
            />
            <AttributeSlider
              label="Political Stability"
              value={politicalStability}
              color="#ec4899"
            />
          </div>

          {/* Section 3: Synergies and Conflicts overview */}
          <div className="space-y-3.5 pl-2 lg:col-span-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Synergies
                </span>
                <Badge className="border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  {synergies.length} Active
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {synergies.slice(0, 3).map((syn, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/5 text-[9px] text-emerald-300"
                  >
                    Synergy Detected
                  </Badge>
                ))}
                {synergies.length === 0 && (
                  <span className="text-[10px] text-zinc-500 italic">No synergies unlocked</span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Conflicts
                </span>
                <Badge
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-semibold",
                    conflicts.length > 0
                      ? "border-red-500/25 bg-red-500/10 text-red-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  {conflicts.length} Active
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {conflicts.slice(0, 3).map((con, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-red-500/20 bg-red-500/5 text-[9px] text-red-300"
                  >
                    Conflict Warning
                  </Badge>
                ))}
                {conflicts.length === 0 && (
                  <span className="text-[10px] text-zinc-500 italic">No conflicts present</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Lock Switch */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-zinc-950/20 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-lg p-2",
              isUnlocked ? "bg-amber-500/15 text-amber-400" : "bg-zinc-900 text-zinc-500"
            )}
          >
            {isUnlocked ? <Unlock className="h-4.5 w-4.5" /> : <Lock className="h-4.5 w-4.5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Modify Core Governance</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Toggle this switch to unlock budget numbers, structures, and atomic component links
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
            {isUnlocked ? "Unlocked" : "Locked"}
          </span>
          <Switch
            checked={isUnlocked}
            onCheckedChange={setIsUnlocked}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>
      </div>

      {/* Main Tabs interface */}
      <Tabs value={activeGovernmentTab} onValueChange={onTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-4 rounded-xl border border-white/10 bg-zinc-950/60 p-1">
          <TabsTrigger
            value="components"
            className="py-2 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400"
          >
            Core Setup
          </TabsTrigger>
          <TabsTrigger
            value="structure"
            className="py-2 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400"
          >
            Departments
          </TabsTrigger>
          <TabsTrigger
            value="spending"
            className="py-2 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400"
          >
            Budget & Revenue
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="py-2 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400"
          >
            Verify & Preview
          </TabsTrigger>
        </TabsList>

        {/* CORE SETUP TAB */}
        <TabsContent value="components" className="mt-4 focus-visible:outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Structure Form details wrapper */}
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-5">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <GovernmentStructureForm
                  data={governmentStructure.structure}
                  onChange={(structure) => {
                    if (isUnlocked) {
                      onGovernmentStructureChange({
                        ...governmentStructure,
                        structure,
                      });
                    }
                  }}
                  isReadOnly={!isUnlocked}
                  gdpData={{
                    nominalGDP: economicInputs?.coreIndicators?.nominalGDP || 0,
                    countryName: selectedCountry?.name,
                  }}
                />
              </div>

              {/* Core Governance Selection cards */}
              <div className="relative space-y-6 overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <h3 className="flex items-center gap-2 text-base font-bold text-zinc-100">
                  <Settings className="h-5 w-5 text-amber-400" />
                  Core Governance Principles
                </h3>

                <SelectionCardGrid
                  title="Power Distribution (Select 1)"
                  subtitle="Defines how authority is partitioned between central and regional offices"
                  options={powerOptions}
                  selectedValues={governmentComponents}
                  onToggle={handleToggleCoreComponent}
                  isReadOnly={!isUnlocked}
                />

                <SelectionCardGrid
                  title="Decision Processes (Select 1)"
                  subtitle="Governs the active mechanism by which national policy laws are passed"
                  options={decisionOptions}
                  selectedValues={governmentComponents}
                  onToggle={handleToggleCoreComponent}
                  isReadOnly={!isUnlocked}
                />

                <SelectionCardGrid
                  title="Legitimacy Sources (Select up to 2)"
                  subtitle="Represents how popular authority is recognized and maintained"
                  options={legitimacyOptions}
                  selectedValues={governmentComponents}
                  onToggle={handleToggleCoreComponent}
                  isReadOnly={!isUnlocked}
                  maxSelect={2}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-5">
                <h4 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">
                  Setup Instructions
                </h4>
                <ul className="mt-3 list-inside list-disc space-y-2 text-xs text-zinc-400">
                  <li>Define the formal ceremonial and executive names of your administration.</li>
                  <li>
                    Unlock editing using the{" "}
                    <span className="font-semibold text-amber-400">Modify Core Governance</span>{" "}
                    switch above.
                  </li>
                  <li>Pick exactly one Power Distribution model.</li>
                  <li>Select the primary Decision Process philosophy.</li>
                  <li>
                    Select up to two Legitimacy pillars to secure your administration's mandate.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* DEPARTMENTS TAB */}
        <TabsContent value="structure" className="mt-4 focus-visible:outline-none">
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
            <TextureOverlay texture="chevron" opacity={0.02} />
            <DepartmentList
              departments={governmentStructure.departments}
              onAddDepartment={() => {
                if (!isUnlocked) return;
                const newDept = {
                  name: "",
                  category: "Other" as const,
                  description: "",
                  ministerTitle: "Minister",
                  organizationalLevel: "Ministry" as const,
                  color: "#6366f1",
                  priority: 50,
                  functions: [],
                };
                onGovernmentStructureChange({
                  ...governmentStructure,
                  departments: [...governmentStructure.departments, newDept],
                });
              }}
              onUpdateDepartment={(idx, updated) => {
                if (!isUnlocked) return;
                const newDepts = [...governmentStructure.departments];
                newDepts[idx] = updated;
                onGovernmentStructureChange({
                  ...governmentStructure,
                  departments: newDepts,
                });
              }}
              onRemoveDepartment={(idx) => {
                if (!isUnlocked) return;
                onGovernmentStructureChange({
                  ...governmentStructure,
                  departments: governmentStructure.departments.filter(
                    (_: any, i: number) => i !== idx
                  ),
                });
              }}
              isReadOnly={!isUnlocked}
              governmentComponents={governmentComponents}
              onGovernmentComponentsChange={onGovernmentComponentsChange}
            />
          </div>
        </TabsContent>

        {/* BUDGET & REVENUE TAB */}
        <TabsContent value="spending" className="mt-4 focus-visible:outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              {/* GDP Cap Alert Banner */}
              {gdpCapWarning && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-400" />
                  <div className="leading-relaxed">{gdpCapWarning}</div>
                </div>
              )}

              {/* Budget Allocations list */}
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <BudgetAllocationList
                  departments={governmentStructure.departments}
                  budgetAllocations={governmentStructure.budgetAllocations}
                  budgetSummary={{
                    totalAllocated:
                      governmentStructure.budgetAllocations?.reduce(
                        (sum: number, a: any) => sum + (a.allocatedAmount || 0),
                        0
                      ) || 0,
                    totalAllocatedPercent: totalAllocatedPercent,
                    remaining:
                      (governmentStructure.structure?.totalBudget || 0) -
                      (governmentStructure.budgetAllocations?.reduce(
                        (sum: number, a: any) => sum + (a.allocatedAmount || 0),
                        0
                      ) || 0),
                    remainingPercent: 100 - totalAllocatedPercent,
                    isOverBudget: totalAllocatedPercent > 100,
                    isUnderBudget: totalAllocatedPercent < 100,
                  }}
                  totalBudget={governmentStructure.structure.totalBudget}
                  currency={governmentStructure.structure.budgetCurrency || "USD"}
                  onUpdateAllocation={(idx, updated) => {
                    if (!isUnlocked) return;
                    const newAllocations = [...(governmentStructure.budgetAllocations || [])];
                    const existingIndex = newAllocations.findIndex(
                      (a) => a.departmentId === idx.toString()
                    );
                    if (existingIndex >= 0) {
                      newAllocations[existingIndex] = updated;
                    } else {
                      newAllocations.push(updated);
                    }
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      budgetAllocations: newAllocations,
                    });
                  }}
                  onFixAllocations={() => {
                    if (!isUnlocked) return;
                    // Auto distribute allocations evenly
                    const totalBudgetVal = governmentStructure.structure.totalBudget;
                    const numDepts = governmentStructure.departments.length;
                    if (numDepts === 0) return;
                    const evenPercent = 100 / numDepts;
                    const fixedAllocations = governmentStructure.departments.map(
                      (_: any, idx: number) => ({
                        departmentId: idx.toString(),
                        budgetYear: new Date().getFullYear(),
                        allocatedPercent: evenPercent,
                        allocatedAmount: Math.round((totalBudgetVal * evenPercent) / 100),
                        notes: "Even redistribution",
                      })
                    );
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      budgetAllocations: fixedAllocations,
                    });
                  }}
                  isReadOnly={!isUnlocked}
                  budgetAllocationsCollapsed={{}}
                  onToggleCollapse={() => {}}
                  onExpandAll={() => {}}
                  onCollapseAll={() => {}}
                />
              </div>

              {/* Revenue Sources form */}
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">Revenue Channels</h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Configure sources of public capital funding
                  </p>
                </div>
                <RevenueSourceForm
                  data={governmentStructure.revenueSources}
                  onChange={(revenueSources) => {
                    if (isUnlocked) {
                      onGovernmentStructureChange({
                        ...governmentStructure,
                        revenueSources,
                      });
                    }
                  }}
                  totalRevenue={governmentStructure.structure.totalBudget}
                  currency={governmentStructure.structure.budgetCurrency || "USD"}
                  isReadOnly={!isUnlocked}
                  availableDepartments={governmentStructure.departments.map(
                    (d: any, idx: number) => ({
                      id: idx.toString(),
                      name: d.name,
                    })
                  )}
                />
              </div>
            </div>

            <div className="space-y-6 lg:col-span-4">
              {/* Economic Governance Atomic components */}
              <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-900/10 p-5">
                <h4 className="text-sm font-bold text-zinc-200">Economic Philosophy</h4>
                <p className="text-[11px] text-zinc-400">
                  Select components outlining your economic governance direction
                </p>
                <div className="space-y-2">
                  {economicGovernanceOptions.map((opt) => {
                    const isSelected = governmentComponents.includes(opt.value);
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => {
                          if (!isUnlocked) return;
                          if (isSelected) {
                            onGovernmentComponentsChange(
                              governmentComponents.filter((c) => c !== opt.value)
                            );
                          } else {
                            if (governmentComponents.length >= 15) return;
                            // Exclusive filter: clear other economic governance selections
                            const econComps = economicGovernanceOptions.map(
                              (o) => o.value
                            ) as ComponentType[];
                            const cleaned = governmentComponents.filter(
                              (c) => !econComps.includes(c)
                            );
                            onGovernmentComponentsChange([...cleaned, opt.value]);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3.5 transition-all duration-200 select-none",
                          isSelected
                            ? "border-amber-500/40 bg-amber-500/10 text-white"
                            : "border-white/[0.04] bg-zinc-950/20 text-zinc-400 hover:border-white/10"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            isSelected
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-zinc-900 text-zinc-500"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "block text-[11px] font-bold",
                              isSelected ? "text-zinc-100" : "text-zinc-300"
                            )}
                          >
                            {opt.label}
                          </span>
                          <p className="mt-0.5 text-[9.5px] leading-normal text-zinc-400">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* VERIFY & PREVIEW TAB */}
        <TabsContent value="preview" className="mt-4 focus-visible:outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              {/* Policies spending section */}
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <GovernmentSpendingSection
                  inputs={economicInputs}
                  onInputsChange={onEconomicInputsChange}
                  selectedAtomicComponents={governmentComponents}
                  governmentBuilderData={governmentStructure}
                  countryId={selectedCountry?.countryCode || undefined}
                />
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              {/* Safety Rails Checkpoint and Verification Box */}
              <div className="relative space-y-4 overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-5">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                  <Shield className="h-4.5 w-4.5 text-amber-500" />
                  Verification Checkpoint
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Review critical adjustments compared to initial setup before authorization
                </p>

                <div className="space-y-2.5">
                  {deltaWarning && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
                      <span>{deltaWarning}</span>
                    </div>
                  )}

                  {currencyChangeWarning && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                      <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
                      <span>{currencyChangeWarning}</span>
                    </div>
                  )}

                  {!deltaWarning && !currencyChangeWarning && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-200">
                      <CheckCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-400" />
                      <span>
                        No high-risk adjustments detected. Structural variables are within safe
                        boundaries.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2.5 pt-2 select-none">
                  <Checkbox
                    id="verify-checkbox"
                    checked={isVerified}
                    onCheckedChange={(checked) => setIsVerified(checked === true)}
                    className="mt-0.5 border-zinc-700 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                  />
                  <Label
                    htmlFor="verify-checkbox"
                    className="cursor-pointer text-xs leading-normal text-zinc-400"
                  >
                    I verify these governance adjustments are intentional and authorization should
                    be finalized.
                  </Label>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={async () => {
                      if (!isVerified || gdpCapWarning) return;
                      await onGovernmentStructureSave(governmentStructure);
                    }}
                    disabled={!isVerified || !!gdpCapWarning}
                    className="h-9 w-full rounded-lg bg-amber-500 text-xs font-semibold text-black hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    Save & Finalize Governance
                  </Button>
                </div>
              </div>

              {/* Government Structure Preview */}
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-900/10 p-6">
                <TextureOverlay texture="chevron" opacity={0.02} />
                <GovernmentStructurePreview
                  governmentStructure={governmentStructure}
                  governmentComponents={governmentComponents}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
