// src/app/admin/storyteller/_components/CountryInspector.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Search,
  Globe,
  Calculator,
  TrendingUp,
  TrendingDown,
  Calendar,
  Settings,
  Zap,
  Plus,
  Trash2,
  Info,
  Loader2,
  DollarSign,
  Users,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useAdminNavigation } from "./AdminNavigationContext";

// Economic configurations and tiers duplication
enum EconomicTier {
  IMPOVERISHED = "Impoverished",
  DEVELOPING = "Developing",
  DEVELOPED = "Developed",
  HEALTHY = "Healthy",
  STRONG = "Strong",
  VERY_STRONG = "Very Strong",
  EXTRAVAGANT = "Extravagant",
}

enum PopulationTier {
  TIER_1 = "1",
  TIER_2 = "2",
  TIER_3 = "3",
  TIER_4 = "4",
  TIER_5 = "5",
  TIER_6 = "6",
  TIER_7 = "7",
  TIER_X = "X",
}

interface MockEffect {
  id: string;
  type: string;
  value: number; // decimal form, e.g. 0.05
  description: string;
  duration: number; // years
}

const TIER_MAX_GROWTH: Record<EconomicTier, number> = {
  [EconomicTier.IMPOVERISHED]: 0.1,
  [EconomicTier.DEVELOPING]: 0.075,
  [EconomicTier.DEVELOPED]: 0.05,
  [EconomicTier.HEALTHY]: 0.035,
  [EconomicTier.STRONG]: 0.0275,
  [EconomicTier.VERY_STRONG]: 0.015,
  [EconomicTier.EXTRAVAGANT]: 0.005,
};

// Custom React Flow node
function CalcNode({ data, selected }: NodeProps) {
  const category = (data.category as string) || "baseline";
  const inputs = (data.inputs as string[]) || [];
  const outputs = (data.outputs as string[]) || [];

  const borderColors: Record<string, string> = {
    baseline: "border-sky-500/40 hover:border-sky-400 focus:border-sky-400",
    settings: "border-amber-500/40 hover:border-amber-400 focus:border-amber-400",
    storyteller: "border-indigo-500/40 hover:border-indigo-400 focus:border-indigo-400",
    popGrowth: "border-teal-500/40 hover:border-teal-400 focus:border-teal-400",
    gdpGrowth: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    rawGdpGrowth: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    diminishingReturns: "border-yellow-500/40 hover:border-yellow-400 focus:border-yellow-400",
    tierCap: "border-pink-500/40 hover:border-pink-400 focus:border-pink-400",
    progression: "border-orange-500/40 hover:border-orange-400 focus:border-orange-400",
    directModifiers: "border-red-500/40 hover:border-red-400 focus:border-red-400",
    output: "border-emerald-500/40 hover:border-emerald-400 focus:border-emerald-400",
    vitality: "border-emerald-500/40 hover:border-emerald-400 focus:border-emerald-400",
    wellbeing: "border-teal-500/40 hover:border-teal-400 focus:border-teal-400",
    efficiency: "border-purple-500/40 hover:border-purple-400 focus:border-purple-400",
    diplomatic: "border-indigo-500/40 hover:border-indigo-400 focus:border-indigo-400",
  };

  const bgGlows: Record<string, string> = {
    baseline: "rgba(14, 165, 233, 0.03)",
    settings: "rgba(245, 158, 11, 0.03)",
    storyteller: "rgba(99, 102, 241, 0.03)",
    popGrowth: "rgba(20, 184, 166, 0.03)",
    gdpGrowth: "rgba(168, 85, 247, 0.03)",
    rawGdpGrowth: "rgba(168, 85, 247, 0.03)",
    diminishingReturns: "rgba(234, 179, 8, 0.03)",
    tierCap: "rgba(236, 72, 153, 0.03)",
    progression: "rgba(249, 115, 22, 0.03)",
    directModifiers: "rgba(239, 68, 68, 0.03)",
    output: "rgba(16, 185, 129, 0.03)",
    vitality: "rgba(16, 185, 129, 0.03)",
    wellbeing: "rgba(20, 184, 166, 0.03)",
    efficiency: "rgba(168, 85, 247, 0.03)",
    diplomatic: "rgba(99, 102, 241, 0.03)",
  };

  const glowColors: Record<string, string> = {
    baseline: "shadow-sky-500/5",
    settings: "shadow-amber-500/5",
    storyteller: "shadow-indigo-500/5",
    popGrowth: "shadow-teal-500/5",
    gdpGrowth: "shadow-purple-500/5",
    rawGdpGrowth: "shadow-purple-500/5",
    diminishingReturns: "shadow-yellow-500/5",
    tierCap: "shadow-pink-500/5",
    progression: "shadow-orange-500/5",
    directModifiers: "shadow-red-500/5",
    output: "shadow-emerald-500/5",
    vitality: "shadow-emerald-500/5",
    wellbeing: "shadow-teal-500/5",
    efficiency: "shadow-purple-500/5",
    diplomatic: "shadow-indigo-500/5",
  };

  return (
    <div
      className={cn(
        "relative min-w-[210px] rounded-xl border bg-card/90 p-4 shadow-lg backdrop-blur-md transition-all duration-300 text-left",
        borderColors[category] || "border-border",
        glowColors[category],
        selected ? "scale-105 border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/30" : ""
      )}
      style={{
        backgroundColor: bgGlows[category],
      }}
    >
      {/* Handles */}
      {inputs.map((pos) => {
        let position = Position.Left;
        if (pos === "top") position = Position.Top;
        if (pos === "bottom") position = Position.Bottom;
        if (pos === "right") position = Position.Right;

        return (
          <Handle
            key={pos}
            type="target"
            id={pos}
            position={position}
            className="border-background !h-2.5 !w-2.5 border !bg-primary transition-all duration-200"
          />
        );
      })}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-wider">
            {data.title as string}
          </span>
          {selected && (
            <Badge className="text-[8px] px-1 h-3.5 bg-primary/20 text-primary border-0 select-none">
              Selected
            </Badge>
          )}
        </div>
        <div className="text-foreground text-sm font-extrabold truncate">
          {data.mainValue as string}
        </div>
        <div className="text-muted-foreground text-[10px] truncate">
          {data.subValue as string}
        </div>
      </div>

      {outputs.map((pos) => {
        let position = Position.Right;
        if (pos === "top") position = Position.Top;
        if (pos === "bottom") position = Position.Bottom;
        if (pos === "left") position = Position.Left;

        return (
          <Handle
            key={pos}
            type="source"
            id={pos}
            position={position}
            className="border-background !h-2.5 !w-2.5 border !bg-primary transition-all duration-200"
          />
        );
      })}
    </div>
  );
}

const nodeTypes = {
  calcNode: CalcNode,
};

export function CountryInspector() {
  const { sidebarHidden, setSidebarHidden } = useAdminNavigation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset sidebar navigation state when navigating away
  useEffect(() => {
    return () => {
      setSidebarHidden(false);
    };
  }, [setSidebarHidden]);

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Sandbox controls state
  const [yearsElapsed, setYearsElapsed] = useState<number>(0);
  const [localMultiplier, setLocalMultiplier] = useState<number>(1.0);
  const [mockEffects, setMockEffects] = useState<MockEffect[]>([]);
  const [disabledEffects, setDisabledEffects] = useState<Record<string, boolean>>({});

  // Mock effect form state
  const [newEffectType, setNewEffectType] = useState<string>("gdp_adjustment");
  const [newEffectValue, setNewEffectValue] = useState<string>("5"); // in %
  const [newEffectDesc, setNewEffectDesc] = useState<string>("");
  const [newEffectDuration, setNewEffectDuration] = useState<number>(5);

  // Selected node tracking
  const [selectedNodeId, setSelectedNodeId] = useState<string>("baseline");

  // Fetch list of countries
  const { data: countryList } = api.countries.getSelectList.useQuery(
    { limit: 250 },
    { refetchOnWindowFocus: false }
  );

  // Filter country selection list
  const filteredCountries = useMemo(() => {
    if (!countryList) return [];
    if (!searchQuery) return countryList;
    const q = searchQuery.toLowerCase();
    return countryList.filter((c) => c.name.toLowerCase().includes(q));
  }, [countryList, searchQuery]);

  // Fetch full details of selected country
  const { data: countryData, isLoading: isCountryLoading } =
    api.countries.getByIdWithEconomicData.useQuery(
      { id: selectedCountryId },
      { enabled: !!selectedCountryId, refetchOnWindowFocus: false }
    );

  // Fetch global config constants
  const { data: globalConfig } = api.admin.getConfig.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Set default selected country on load
  useEffect(() => {
    if (countryList && countryList.length > 0 && !selectedCountryId) {
      setSelectedCountryId(countryList[0]!.id);
    }
  }, [countryList, selectedCountryId]);

  // Reset sandbox when switching countries
  useEffect(() => {
    setYearsElapsed(0);
    setLocalMultiplier(1.0);
    setMockEffects([]);
    setDisabledEffects({});
  }, [selectedCountryId]);

  // Format helper functions
  const fmtBig = (n: number) => {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const fmtPop = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const getEconTier = (gdpPerCapita: number): EconomicTier => {
    if (gdpPerCapita >= 65000) return EconomicTier.EXTRAVAGANT;
    if (gdpPerCapita >= 55000) return EconomicTier.VERY_STRONG;
    if (gdpPerCapita >= 45000) return EconomicTier.STRONG;
    if (gdpPerCapita >= 35000) return EconomicTier.HEALTHY;
    if (gdpPerCapita >= 25000) return EconomicTier.DEVELOPED;
    if (gdpPerCapita >= 10000) return EconomicTier.DEVELOPING;
    return EconomicTier.IMPOVERISHED;
  };

  const getPopTier = (population: number): PopulationTier => {
    if (population >= 500_000_000) return PopulationTier.TIER_X;
    if (population >= 350_000_000) return PopulationTier.TIER_7;
    if (population >= 120_000_000) return PopulationTier.TIER_6;
    if (population >= 80_000_000) return PopulationTier.TIER_5;
    if (population >= 50_000_000) return PopulationTier.TIER_4;
    if (population >= 30_000_000) return PopulationTier.TIER_3;
    if (population >= 10_000_000) return PopulationTier.TIER_2;
    return PopulationTier.TIER_1;
  };

  // Perform full calculation steps client-side based on the sliders & effects state
  const calculation = useMemo(() => {
    if (!countryData) return null;

    const basePop = countryData.baselinePopulation || 1000000;
    const baseGdpPerCapita = countryData.baselineGdpPerCapita || 5000;
    const baseGdp = basePop * baseGdpPerCapita;
    const landArea = countryData.landArea || 100000;

    // Settings
    const cfgGlobalGrowthFactor = globalConfig?.globalGrowthFactor || 1.0321;
    const cfgDiminishingThreshold = globalConfig?.diminishingReturnsThreshold || 60000;
    const cfgDiminishingFactor = globalConfig?.diminishingReturnsFactor || 0.5;
    const cfgMinGrowthFloor = globalConfig?.minGrowthFloor || -0.1;

    // Base rates
    const popBaseRate = countryData.populationGrowthRate || 0.01;
    const gdpBaseRate = countryData.adjustedGdpGrowth || 0.02;

    const currentEconTier = getEconTier(baseGdpPerCapita);
    const tierModifier = globalConfig?.tierGrowthModifiers?.[currentEconTier] || 1.0;

    // Process storyteller effects (DB + mock)
    const activeDbEffects = (countryData.storytellerEffects || [])
      .filter((eff: any) => !disabledEffects[eff.id])
      .map((eff: any) => ({
        id: eff.id,
        name: eff.description || `${eff.inputType} effect`,
        type: eff.inputType,
        value: eff.value,
        duration: eff.duration || 99,
        mock: false,
      }));

    const activeMockEffects = mockEffects.map((eff) => ({
      id: eff.id,
      name: eff.description,
      type: eff.type,
      value: eff.value,
      duration: eff.duration,
      mock: true,
    }));

    const allEffects = [...activeDbEffects, ...activeMockEffects];

    // Calculate Pop Growth Modifier
    let popAdjustVal = 0;
    allEffects.forEach((eff) => {
      if (eff.type === "population_adjustment") {
        popAdjustVal += eff.value;
      }
    });

    const finalPopGrowthRate = popBaseRate + popAdjustVal;

    // Calculate GDP GDPPC growth rate modifiers
    let gdpAdjustVal = 0;
    let gdpMultiplierVal = 1.0;

    allEffects.forEach((eff) => {
      if (eff.type === "gdp_adjustment") {
        gdpAdjustVal += eff.value;
      } else if (eff.type === "growth_rate_modifier") {
        gdpMultiplierVal *= 1.0 + eff.value;
      }
    });

    // Compute effective GDP growth rate before cap and floor
    let rawGdpGrowth = gdpBaseRate;
    rawGdpGrowth *= cfgGlobalGrowthFactor;
    rawGdpGrowth *= localMultiplier;
    rawGdpGrowth *= tierModifier;
    rawGdpGrowth += gdpAdjustVal;
    rawGdpGrowth *= gdpMultiplierVal;

    // Check Diminishing Returns
    let drReducedVal = rawGdpGrowth;
    const isDrActive = baseGdpPerCapita > cfgDiminishingThreshold;
    if (isDrActive) {
      const diminishingFactor =
        Math.log(baseGdpPerCapita / cfgDiminishingThreshold + 1) / Math.log(2);
      drReducedVal = rawGdpGrowth / (1.0 + diminishingFactor * cfgDiminishingFactor);
    }

    // Apply Tier Cap Check
    const tierMaxCap = TIER_MAX_GROWTH[currentEconTier] || 0.05;
    const isCapped = drReducedVal > tierMaxCap;
    let finalGdpGrowthRate = isCapped ? tierMaxCap : drReducedVal;

    // Apply floor
    finalGdpGrowthRate = Math.max(finalGdpGrowthRate, cfgMinGrowthFloor);

    // Apply progression calculations over years elapsed
    let finalPop = basePop * Math.pow(1.0 + finalPopGrowthRate, yearsElapsed);
    let finalGdpPerCapita = baseGdpPerCapita * Math.pow(1.0 + finalGdpGrowthRate, yearsElapsed);

    // Apply special direct multipliers to outputs
    let directPopMult = 1.0;
    let directGdpMult = 1.0;

    allEffects.forEach((eff) => {
      if (eff.type === "natural_disaster") {
        // Disasters reduce population and GDP
        directPopMult *= 1.0 + eff.value;
        directGdpMult *= 1.0 + eff.value * 1.5;
      } else if (eff.type === "trade_agreement") {
        directGdpMult *= 1.0 + eff.value;
      } else if (eff.type === "special_event") {
        directPopMult *= 1.0 + eff.value * 0.5;
        directGdpMult *= 1.0 + eff.value * 0.8;
      }
    });

    finalPop *= directPopMult;
    finalGdpPerCapita *= directGdpMult;
    const finalGdpVal = finalPop * finalGdpPerCapita;

    const finalEconTier = getEconTier(finalGdpPerCapita);
    const finalPopTier = getPopTier(finalPop);

    // Secondary indicators formulas
    const gdpScore = Math.min(100, (finalGdpPerCapita / 50000) * 100);
    const growthBonus = Math.min(20, Math.max(-20, finalGdpGrowthRate * 400));
    const vitalityVal = Math.min(100, Math.max(0, gdpScore * 0.7 + growthBonus + 30));

    const growthHealth = finalPopGrowthRate > 0 ? 70 : 40;
    const finalPopDensity = landArea > 0 ? finalPop / landArea : 0;
    const densityFactor = finalPopDensity > 0 ? Math.max(50, 100 - finalPopDensity / 500) : 60;
    const wellbeingVal = (growthHealth + densityFactor) / 2;

    const tierScores: Record<EconomicTier, number> = {
      [EconomicTier.EXTRAVAGANT]: 95,
      [EconomicTier.VERY_STRONG]: 85,
      [EconomicTier.STRONG]: 75,
      [EconomicTier.HEALTHY]: 65,
      [EconomicTier.DEVELOPED]: 50,
      [EconomicTier.DEVELOPING]: 35,
      [EconomicTier.IMPOVERISHED]: 25,
    };
    const economicTierScore = tierScores[finalEconTier] || 25;
    const efficiencyVal = economicTierScore * 0.8;

    const influence = (countryData as any).globalDiplomaticInfluence ?? 50;
    const tradeStrength = (countryData as any).tradeRelationshipStrength ?? 25;
    const allianceStrength = (countryData as any).allianceStrength ?? 15;
    const tensions = (countryData as any).diplomaticTensions ?? 5;
    const diplomaticVal = Math.min(100, Math.max(40, influence + tradeStrength + allianceStrength - tensions));

    return {
      baseline: {
        pop: basePop,
        gdppc: baseGdpPerCapita,
        gdp: baseGdp,
        date: countryData.baselineDate ? new Date(countryData.baselineDate) : new Date(),
        tier: currentEconTier,
        popTier: getPopTier(basePop),
        landArea,
      },
      settings: {
        globalGrowthFactor: cfgGlobalGrowthFactor,
        localGrowthFactor: localMultiplier,
        tierModifier,
      },
      effects: {
        active: allEffects,
        popAdjust: popAdjustVal,
        gdpAdjust: gdpAdjustVal,
        gdpMultiplier: gdpMultiplierVal - 1.0,
      },
      popGrowth: {
        baseRate: popBaseRate,
        storytellerAdjust: popAdjustVal,
        finalRate: finalPopGrowthRate,
      },
      gdpGrowth: {
        baseRate: gdpBaseRate,
        withGlobalFactor: gdpBaseRate * cfgGlobalGrowthFactor,
        withLocalFactor: gdpBaseRate * cfgGlobalGrowthFactor * localMultiplier,
        withTierModifier: gdpBaseRate * cfgGlobalGrowthFactor * localMultiplier * tierModifier,
        withStorytellerAdjust: rawGdpGrowth,
        beforeCap: drReducedVal,
        finalRate: finalGdpGrowthRate,
        isCapped,
        tierMax: tierMaxCap,
        diminishingReturns: {
          active: isDrActive,
          originalRate: rawGdpGrowth,
          factor: cfgDiminishingFactor,
          reducedRate: drReducedVal,
        },
      },
      progression: {
        years: yearsElapsed,
        popGrowthCompound: Math.pow(1.0 + finalPopGrowthRate, yearsElapsed),
        gdpGrowthCompound: Math.pow(1.0 + finalGdpGrowthRate, yearsElapsed),
        directPopModifier: directPopMult - 1.0,
        directGdpModifier: directGdpMult - 1.0,
      },
      output: {
        pop: finalPop,
        gdppc: finalGdpPerCapita,
        gdp: finalGdpVal,
        tier: finalEconTier,
        popTier: finalPopTier,
        popDensity: landArea > 0 ? finalPop / landArea : undefined,
        gdpDensity: landArea > 0 ? finalGdpVal / landArea : undefined,
      },
      secondary: {
        vitality: vitalityVal,
        wellbeing: wellbeingVal,
        efficiency: efficiencyVal,
        diplomatic: diplomaticVal,
        details: {
          gdpScore,
          growthBonus,
          densityFactor,
          growthHealth,
          influence,
          tradeStrength,
          allianceStrength,
          tensions,
        },
      },
    };
  }, [countryData, globalConfig, localMultiplier, mockEffects, disabledEffects, yearsElapsed]);

  // Build React Flow nodes and edges
  const flowData = useMemo(() => {
    if (!calculation || !countryData) return { nodes: [], edges: [] };

    const nodes = [
      {
        id: "baseline",
        type: "calcNode",
        data: {
          category: "baseline",
          title: "Baseline State",
          mainValue: `GDP PC: $${calculation.baseline.gdppc.toLocaleString()}`,
          subValue: `Pop: ${fmtPop(calculation.baseline.pop)} | Area: ${calculation.baseline.landArea.toLocaleString()} km²`,
          inputs: [],
          outputs: ["right"],
        },
        position: { x: 30, y: 150 },
      },
      {
        id: "settings",
        type: "calcNode",
        data: {
          category: "settings",
          title: "Simulation Modifiers",
          mainValue: `Local Multiplier: ${calculation.settings.localGrowthFactor.toFixed(2)}x`,
          subValue: `Global Growth: ${calculation.settings.globalGrowthFactor.toFixed(4)} (${((calculation.settings.globalGrowthFactor - 1) * 100).toFixed(2)}%)`,
          inputs: [],
          outputs: ["right"],
        },
        position: { x: 30, y: 10 },
      },
      {
        id: "storyteller",
        type: "calcNode",
        data: {
          category: "storyteller",
          title: "Storyteller Effects",
          mainValue: `${calculation.effects.active.length} Active Effects`,
          subValue: `GDP modifier: ${calculation.effects.gdpAdjust >= 0 ? "+" : ""}${(calculation.effects.gdpAdjust * 100).toFixed(1)}%`,
          inputs: [],
          outputs: ["right"],
        },
        position: { x: 30, y: 290 },
      },
      {
        id: "popGrowth",
        type: "calcNode",
        data: {
          category: "popGrowth",
          title: "Effective Pop Growth",
          mainValue: `${(calculation.popGrowth.finalRate * 100).toFixed(2)}% Annual`,
          subValue: `Base Rate: ${(calculation.popGrowth.baseRate * 100).toFixed(2)}%`,
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 320, y: 50 },
      },
      {
        id: "gdpGrowth",
        type: "calcNode",
        data: {
          category: "gdpGrowth",
          title: "Raw GDPPC Growth",
          mainValue: `${(calculation.gdpGrowth.withStorytellerAdjust * 100).toFixed(2)}% Raw`,
          subValue: `Base Rate: ${(calculation.gdpGrowth.baseRate * 100).toFixed(2)}%`,
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 320, y: 220 },
      },
      {
        id: "diminishingReturns",
        type: "calcNode",
        data: {
          category: "diminishingReturns",
          title: "Diminishing Returns",
          mainValue: `${(calculation.gdpGrowth.beforeCap * 100).toFixed(2)}% Reduced`,
          subValue: calculation.gdpGrowth.diminishingReturns.active
            ? "⚠️ DR: Active (Exceeds $60k)"
            : "✓ DR: Inactive (Normal)",
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 610, y: 220 },
      },
      {
        id: "tierCap",
        type: "calcNode",
        data: {
          category: "tierCap",
          title: "Tier Cap Check",
          mainValue: `Cap: ${(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%`,
          subValue: calculation.gdpGrowth.isCapped ? "⚠️ Capped: Limit Reached" : "✓ Uncapped",
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 900, y: 220 },
      },
      {
        id: "progression",
        type: "calcNode",
        data: {
          category: "progression",
          title: "Compound Progression",
          mainValue: `${yearsElapsed.toFixed(1)} Years Elapsed`,
          subValue: `Compounds growth over selected years`,
          inputs: ["left", "bottom"],
          outputs: ["right"],
        },
        position: { x: 900, y: 50 },
      },
      {
        id: "directModifiers",
        type: "calcNode",
        data: {
          category: "directModifiers",
          title: "Direct Modifiers",
          mainValue: `Direct Pop: ${calculation.progression.directPopModifier >= 0 ? "+" : ""}${(calculation.progression.directPopModifier * 100).toFixed(1)}%`,
          subValue: `Direct GDP: ${calculation.progression.directGdpModifier >= 0 ? "+" : ""}${(calculation.progression.directGdpModifier * 100).toFixed(1)}%`,
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 1190, y: 130 },
      },
      {
        id: "output",
        type: "calcNode",
        data: {
          category: "output",
          title: "Projected Output",
          mainValue: `GDP: ${fmtBig(calculation.output.gdp)}`,
          subValue: `GDPPC: $${Math.round(calculation.output.gdppc).toLocaleString()} (${calculation.output.tier})`,
          inputs: ["left"],
          outputs: ["right"],
        },
        position: { x: 1480, y: 130 },
      },
      {
        id: "vitality",
        type: "calcNode",
        data: {
          category: "vitality",
          title: "Economic Vitality",
          mainValue: `${Math.round(calculation.secondary.vitality)} / 100`,
          subValue: `GDP Score: ${calculation.secondary.details.gdpScore.toFixed(1)} | Bonus: ${calculation.secondary.details.growthBonus.toFixed(1)}`,
          inputs: ["left"],
          outputs: [],
        },
        position: { x: 1770, y: 10 },
      },
      {
        id: "wellbeing",
        type: "calcNode",
        data: {
          category: "wellbeing",
          title: "Population Wellbeing",
          mainValue: `${Math.round(calculation.secondary.wellbeing)} / 100`,
          subValue: `Growth Health: ${calculation.secondary.details.growthHealth} | Density Factor: ${calculation.secondary.details.densityFactor.toFixed(1)}`,
          inputs: ["left"],
          outputs: [],
        },
        position: { x: 1770, y: 110 },
      },
      {
        id: "efficiency",
        type: "calcNode",
        data: {
          category: "efficiency",
          title: "Gov Efficiency",
          mainValue: `${Math.round(calculation.secondary.efficiency)} / 100`,
          subValue: `Based on Tier: ${calculation.output.tier}`,
          inputs: ["left"],
          outputs: [],
        },
        position: { x: 1770, y: 210 },
      },
      {
        id: "diplomatic",
        type: "calcNode",
        data: {
          category: "diplomatic",
          title: "Diplomatic Standing",
          mainValue: `${Math.round(calculation.secondary.diplomatic)} / 100`,
          subValue: `Inf: ${calculation.secondary.details.influence} | Trade: ${calculation.secondary.details.tradeStrength} | Alliance: ${calculation.secondary.details.allianceStrength}`,
          inputs: ["left"],
          outputs: [],
        },
        position: { x: 1770, y: 310 },
      },
    ];

    const edges = [
      {
        id: "e-settings-gdpgrowth",
        source: "settings",
        target: "gdpGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#f59e0b", strokeWidth: 1.5 },
      },
      {
        id: "e-baseline-gdpgrowth",
        source: "baseline",
        target: "gdpGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#0ea5e9", strokeWidth: 1.5 },
      },
      {
        id: "e-baseline-popgrowth",
        source: "baseline",
        target: "popGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#0ea5e9", strokeWidth: 1.5 },
      },
      {
        id: "e-storyteller-gdpgrowth",
        source: "storyteller",
        target: "gdpGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
      },
      {
        id: "e-storyteller-popgrowth",
        source: "storyteller",
        target: "popGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
      },
      {
        id: "e-popgrowth-progression",
        source: "popGrowth",
        target: "progression",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#14b8a6", strokeWidth: 1.5 },
      },
      {
        id: "e-gdpgrowth-dr",
        source: "gdpGrowth",
        target: "diminishingReturns",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#a855f7", strokeWidth: 1.5 },
      },
      {
        id: "e-dr-tiercap",
        source: "diminishingReturns",
        target: "tierCap",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#eab308", strokeWidth: 1.5 },
      },
      {
        id: "e-tiercap-progression",
        source: "tierCap",
        target: "progression",
        sourceHandle: "right",
        targetHandle: "bottom",
        animated: true,
        style: { stroke: "#ec4899", strokeWidth: 1.5 },
      },
      {
        id: "e-progression-directmodifiers",
        source: "progression",
        target: "directModifiers",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#f97316", strokeWidth: 2 },
      },
      {
        id: "e-directmodifiers-output",
        source: "directModifiers",
        target: "output",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#ef4444", strokeWidth: 2 },
      },
      {
        id: "e-output-vitality",
        source: "output",
        target: "vitality",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 1.5 },
      },
      {
        id: "e-output-wellbeing",
        source: "output",
        target: "wellbeing",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#14b8a6", strokeWidth: 1.5 },
      },
      {
        id: "e-output-efficiency",
        source: "output",
        target: "efficiency",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#a855f7", strokeWidth: 1.5 },
      },
      {
        id: "e-output-diplomatic",
        source: "output",
        target: "diplomatic",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
      },
    ];

    return { nodes, edges };
  }, [calculation, countryData, yearsElapsed]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (flowData.nodes.length > 0) {
      setNodes(flowData.nodes.map(n => ({ ...n, selected: n.id === selectedNodeId })));
      setEdges(flowData.edges);
    }
  }, [flowData.nodes, flowData.edges, selectedNodeId, setNodes, setEdges]);

  // Handle mock effect creation
  const handleAddMockEffect = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVal = parseFloat(newEffectValue) / 100;
    if (isNaN(parsedVal)) return;

    const mock: MockEffect = {
      id: `mock-${Date.now()}`,
      type: newEffectType,
      value: parsedVal,
      description: newEffectDesc || `Mock ${newEffectType.replace("_", " ")} (${newEffectValue}%)`,
      duration: newEffectDuration,
    };

    setMockEffects((prev) => [...prev, mock]);
    setNewEffectDesc("");
  };

  // Remove mock effect
  const handleRemoveMockEffect = (id: string) => {
    setMockEffects((prev) => prev.filter((eff) => eff.id !== id));
  };

  // Toggle database effect active state in simulation
  const handleToggleDbEffect = (id: string) => {
    setDisabledEffects((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Node description details card contents helper
  const renderNodeDetails = () => {
    if (!calculation) return null;

    switch (selectedNodeId) {
      case "baseline":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-500" />
              Baseline State
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              These are the baseline values retrieved from the roster sheet, which represent the country's starting parameters.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-border/40 bg-muted/20 rounded-lg p-2.5">
                <span className="text-muted-foreground block text-[10px]">Baseline Population</span>
                <span className="font-mono font-bold text-foreground">
                  {calculation.baseline.pop.toLocaleString()}
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2.5">
                <span className="text-muted-foreground block text-[10px]">Baseline GDP PC</span>
                <span className="font-mono font-bold text-foreground">
                  ${calculation.baseline.gdppc.toLocaleString()}
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2.5 col-span-2">
                <span className="text-muted-foreground block text-[10px]">Baseline Total GDP</span>
                <span className="font-mono font-bold text-foreground">
                  ${calculation.baseline.gdp.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-500" />
              Simulation Modifiers
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Global parameters stored in system configuration along with custom sandbox multipliers.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Global Growth Factor</span>
                <span className="font-mono font-bold">
                  {calculation.settings.globalGrowthFactor.toFixed(4)} (
                  {((calculation.settings.globalGrowthFactor - 1) * 100).toFixed(2)}%)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Local Multiplier Slider</span>
                <span className="font-mono font-bold text-amber-500">
                  {calculation.settings.localGrowthFactor.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier Modifer ({calculation.baseline.tier})</span>
                <span className="font-mono font-bold">
                  {calculation.settings.tierModifier.toFixed(2)}x
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Base rate × Global × Local × Tier</code>
            </div>
          </div>
        );

      case "storyteller":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-500" />
              Storyteller Effects
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Aggregate of active database storyteller effects and sandboxed mock events.
            </p>
            {calculation.effects.active.length === 0 ? (
              <p className="text-muted-foreground italic text-xs">No active storyteller modifiers.</p>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                {calculation.effects.active.map((eff, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-2 rounded border border-border/40",
                      eff.mock ? "bg-indigo-500/5 border-indigo-500/20" : "bg-muted/20"
                    )}
                  >
                    <div>
                      <div className="font-medium truncate max-w-[150px]">{eff.name}</div>
                      <div className="text-[9px] text-muted-foreground">
                        {eff.type.replace("_", " ")} {eff.mock ? "(Sandbox)" : "(DB)"}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {eff.value >= 0 ? "+" : ""}
                      {(eff.value * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "popGrowth":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" />
              Effective Population Growth
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Computes the annual growth rate used to project future populations.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Baseline Pop Growth Rate</span>
                <span className="font-mono font-bold">
                  {(calculation.popGrowth.baseRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Storyteller Adjustments</span>
                <span className="font-mono font-bold text-indigo-500">
                  {calculation.popGrowth.storytellerAdjust >= 0 ? "+" : ""}
                  {(calculation.popGrowth.storytellerAdjust * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Final Pop Growth Rate</span>
                <span className="font-mono">
                  {(calculation.popGrowth.finalRate * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Final Rate = Base Rate + Adjustments</code>
            </div>
          </div>
        );

      case "gdpGrowth":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              Raw GDPPC Growth
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Calculates the raw annual GDP per capita growth rate after combining baseline rates, global multipliers, sandbox controls, and storyteller effects (before diminishing returns and caps).
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Baseline Growth Rate</span>
                <span className="font-mono">{(calculation.gdpGrowth.baseRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">× Global Factor ({calculation.settings.globalGrowthFactor.toFixed(4)})</span>
                <span className="font-mono">{(calculation.gdpGrowth.withGlobalFactor * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">× Local Multiplier ({calculation.settings.localGrowthFactor}x)</span>
                <span className="font-mono">{(calculation.gdpGrowth.withLocalFactor * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">× Tier Modifier ({calculation.settings.tierModifier}x)</span>
                <span className="font-mono">{(calculation.gdpGrowth.withTierModifier * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">+ Storyteller Adjustments</span>
                <span className="font-mono text-indigo-500">{(calculation.effects.gdpAdjust * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">× Storyteller Multipliers</span>
                <span className="font-mono text-indigo-500">{(calculation.effects.gdpMultiplier >= 0 ? "+" : "")}{(calculation.effects.gdpMultiplier * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Raw Growth Rate</span>
                <span className="font-mono">{(calculation.gdpGrowth.withStorytellerAdjust * 100).toFixed(2)}%</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Raw Growth = (Base × Global × Local × Tier + Adjustments) × Multipliers</code>
            </div>
          </div>
        );

      case "diminishingReturns":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Info className="h-4 w-4 text-yellow-500" />
              Diminishing Returns Calculator
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Applies diminishing returns to wealthier economies (exceeding threshold) using logarithmic decay. This slows down growth rates for extravagant nations.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Current GDP Per Capita</span>
                <span className="font-mono font-bold">${Math.round(calculation.baseline.gdppc).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Diminishing Threshold</span>
                <span className="font-mono font-bold">$60,000</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Status</span>
                {calculation.gdpGrowth.diminishingReturns.active ? (
                  <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-[10px]">
                    ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-500 text-[10px]">
                    INACTIVE
                  </Badge>
                )}
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Incoming Raw Growth</span>
                <span className="font-mono">{(calculation.gdpGrowth.diminishingReturns.originalRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Reduced Rate</span>
                <span className="font-mono">{(calculation.gdpGrowth.diminishingReturns.reducedRate * 100).toFixed(2)}%</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
              <div>Formula: <code className="font-mono font-semibold">Reduced = Raw / (1 + DiminishingFactor × 0.5)</code></div>
              <div>• Factor: <code className="font-mono font-semibold">DiminishingFactor = log2(GDPC / 60,000 + 1)</code></div>
            </div>
          </div>
        );

      case "tierCap":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-500" />
              Economic Tier Growth Cap
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Limits the maximum annual growth rate based on the country's current economic tier to prevent hyper-growth at high wealth.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Current Tier</span>
                <span className="font-bold text-foreground">{calculation.baseline.tier}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Max Tier Growth Cap</span>
                <span className="font-mono font-bold text-pink-500">
                  {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cap Status</span>
                {calculation.gdpGrowth.isCapped ? (
                  <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500 text-[10px]">
                    CAPPED
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-500 text-[10px]">
                    UNCAPPED
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              {calculation.baseline.tier} limits annual GDPPC growth to{" "}
              {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%.
            </div>
          </div>
        );

      case "progression":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              Time Progression Engine
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Compounds growth rates over the target timeline. Also applies one-time special modifiers (like natural disaster reductions).
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Years Projected</span>
                <span className="font-mono font-bold text-orange-500">
                  {calculation.progression.years.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Compound Pop Growth Factor</span>
                <span className="font-mono">
                  {calculation.progression.popGrowthCompound.toFixed(4)}x
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Compound GDP Growth Factor</span>
                <span className="font-mono">
                  {calculation.progression.gdpGrowthCompound.toFixed(4)}x
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Value_t = Value_0 × (1 + r)^N</code>
            </div>
          </div>
        );

      case "directModifiers":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-500" />
              Direct Special Modifiers
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Applies one-time direct modifiers to outputs at the end of simulation (e.g. natural disasters, trade agreements). These are not compounded annually.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Direct Population Modifier</span>
                <span className="font-mono font-bold text-red-500">
                  {calculation.progression.directPopModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directPopModifier * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Direct GDP Modifier</span>
                <span className="font-mono font-bold text-red-500">
                  {calculation.progression.directGdpModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directGdpModifier * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
              Formula: <code className="font-mono font-semibold">Output = CompoundedState × (1 + DirectModifier)</code>
            </div>
          </div>
        );

      case "output":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Projected Output
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              The final calculated state of the country after running all simulation adjustments.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-border/40 bg-muted/20 rounded-lg p-2">
                <span className="text-muted-foreground block text-[9px]">Projected Population</span>
                <span className="font-mono font-bold text-foreground">
                  {Math.round(calculation.output.pop).toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground block">
                  (Tier {calculation.output.popTier})
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2">
                <span className="text-muted-foreground block text-[9px]">Projected GDP PC</span>
                <span className="font-mono font-bold text-foreground">
                  ${Math.round(calculation.output.gdppc).toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground block">
                  ({calculation.output.tier})
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2 col-span-2">
                <span className="text-muted-foreground block text-[9px]">Projected Total GDP</span>
                <span className="font-mono font-bold text-emerald-500">
                  {fmtBig(calculation.output.gdp)}
                </span>
              </div>
              {calculation.output.popDensity !== undefined && (
                <div className="border-border/40 bg-muted/20 rounded-lg p-2 col-span-2">
                  <span className="text-muted-foreground block text-[9px]">Population Density</span>
                  <span className="font-mono text-foreground font-medium">
                    {calculation.output.popDensity.toFixed(1)} / km²
                  </span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded mt-2">
              Formula: <code className="font-mono font-semibold">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "vitality":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-500" />
              Economic Vitality Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Calculates index reflecting GDP wealth and growth rate.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">GDP Score Component</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.gdpScore.toFixed(1)} / 100
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Growth Bonus</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.growthBonus.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Final Economic Vitality</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.vitality)} / 100
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
              <div>Formula: <code className="font-mono font-semibold">Vitality = (GDP Score × 0.7) + Growth Bonus + 30</code></div>
              <div>• GDP Score: <code className="font-mono font-semibold">Min(100, (GDPPC / 50,000) × 100)</code></div>
              <div>• Growth Bonus: <code className="font-mono font-semibold">Clamp(Growth Rate × 400, -20, 20)</code></div>
            </div>
          </div>
        );

      case "wellbeing":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" />
              Population Wellbeing Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Combines growth health status and population density factors.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Growth Health</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.growthHealth}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Density Factor</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.densityFactor.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Final Wellbeing</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.wellbeing)} / 100
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
              <div>Formula: <code className="font-mono font-semibold">Wellbeing = (Growth Health + Density Factor) / 2</code></div>
              <div>• Growth Health: <code className="font-mono font-semibold">Pop Growth &gt; 0 ? 70 : 40</code></div>
              <div>• Density Factor: <code className="font-mono font-semibold">Max(50, 100 - Density / 500)</code></div>
            </div>
          </div>
        );

      case "efficiency":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Settings className="h-4 w-4 text-pink-500" />
              Governmental Efficiency Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Computed based on the economic tier category score multiplier.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Economic Tier</span>
                <span className="font-bold">{calculation.output.tier}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1.5">
                <span className="text-muted-foreground">Tier Base Score</span>
                <span className="font-mono font-bold">
                  {Math.round(calculation.secondary.efficiency / 0.8)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Final Efficiency</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.efficiency)} / 100
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
              <div>Formula: <code className="font-mono font-semibold">Efficiency = Tier Score × 0.8</code></div>
              <div>• Tier Scores: <code className="font-mono text-[9px]">Extravagant=95, VeryStrong=85, Strong=75, Healthy=65, Developed=50, Developing=35, Impoverished=25</code></div>
            </div>
          </div>
        );

      case "diplomatic":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-bold flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              Diplomatic Standing Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Derived from influence, alliances, and trade strength offsets against tensions.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Global Influence</span>
                <span className="font-mono">{calculation.secondary.details.influence}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Trade Relationship Strength</span>
                <span className="font-mono">+{calculation.secondary.details.tradeStrength}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Alliance Strength</span>
                <span className="font-mono">+{calculation.secondary.details.allianceStrength}</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Diplomatic Tensions</span>
                <span className="font-mono text-red-500">-{calculation.secondary.details.tensions}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Final Diplomatic Standing</span>
                <span className="font-mono">{Math.round(calculation.secondary.diplomatic)} / 100</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
              <div>Formula: <code className="font-mono font-semibold">Standing = Clamp(Influence + Trade + Alliance - Tensions, 40, 100)</code></div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleNodeClick = (_event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-border/30 pb-5">
        <div className="space-y-1">
          <h3 className="text-foreground text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-500" />
            Country Calculation Pipeline Inspector
          </h3>
          <p className="text-muted-foreground text-xs">
            Select a nation to analyze base metrics, growth configurations, caps, and storyteller adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search Input Searchable Single-select */}
          <div className="relative w-full sm:w-[240px]">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Select country..."
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                className="pl-9 h-9"
              />
            </div>

            {showDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-lg border border-border/40 bg-popover text-popover-foreground shadow-lg backdrop-blur-md">
                <ScrollArea className="h-[220px]">
                  <div className="p-1 space-y-0.5">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCountryId(c.id);
                          setSearchQuery(c.name);
                          setShowDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                          selectedCountryId === c.id ? "bg-accent text-accent-foreground" : ""
                        )}
                      >
                        <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="xs" />
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="text-muted-foreground text-[10px] ml-auto">
                          {c.economicTier}
                        </span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <div className="text-muted-foreground py-3 text-center text-xs">
                        No matching countries.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setSidebarHidden(!sidebarHidden);
            }}
            className="bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all h-9 shrink-0"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </button>
        </div>
      </div>

      {isCountryLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-3 text-xs">Loading Country Parameters...</p>
        </div>
      ) : countryData && calculation ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Controls Column */}
          <div className="space-y-6 lg:col-span-4">
            {/* Country info header */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/15 flex items-center gap-3">
              <UnifiedCountryFlag countryName={countryData.name} flagUrl={countryData.flag} size="lg" />
              <div>
                <h4 className="text-foreground text-sm font-extrabold">{countryData.name}</h4>
                <div className="text-muted-foreground text-[10px] space-y-0.5">
                  <div>Region: {countryData.region || "Global"}</div>
                  <div>Baseline: {calculation.baseline.date.toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/5 space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-foreground">Target Projection Timeline</Label>
                  <span className="text-orange-500 font-mono">+{yearsElapsed.toFixed(1)} yrs</span>
                </div>
                <Slider
                  value={[yearsElapsed]}
                  onValueChange={([v]) => setYearsElapsed(v!)}
                  min={0}
                  max={20}
                  step={0.5}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Baseline ({calculation.baseline.date.getFullYear()})</span>
                  <span>+{yearsElapsed.toFixed(1)} yrs ({calculation.baseline.date.getFullYear() + Math.floor(yearsElapsed)})</span>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border/30 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-foreground">Local Growth Multiplier</Label>
                  <span className="text-amber-500 font-mono">{localMultiplier.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[localMultiplier]}
                  onValueChange={([v]) => setLocalMultiplier(v!)}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>0.50x Penalty</span>
                  <span>1.0x Normal</span>
                  <span>2.00x Boost</span>
                </div>
              </div>
            </div>

            {/* Active database storyteller effects */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/5 space-y-3">
              <Label className="text-foreground text-xs font-bold block">Active Database Effects</Label>
              {countryData.storytellerEffects && countryData.storytellerEffects.length > 0 ? (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {countryData.storytellerEffects.map((eff: any) => {
                    const isDisabled = !!disabledEffects[eff.id];
                    return (
                      <div
                        key={eff.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border transition-colors",
                          isDisabled
                            ? "bg-muted/10 border-border/20 opacity-50"
                            : "bg-muted/30 border-border/50"
                        )}
                      >
                        <div className="text-xs truncate max-w-[170px]">
                          <div className="font-semibold truncate">{eff.description || `${eff.inputType} effect`}</div>
                          <div className="text-[9px] text-muted-foreground">
                            {eff.inputType.replace("_", " ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">
                            {eff.value >= 0 ? "+" : ""}
                            {(eff.value * 100).toFixed(1)}%
                          </span>
                          <button
                            onClick={() => handleToggleDbEffect(eff.id)}
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-bold border transition-all",
                              isDisabled
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            {isDisabled ? "Enable" : "Disable"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-[11px] italic">
                  No active database storyteller events found for this country.
                </p>
              )}
            </div>

            {/* Mock Sandbox effects form */}
            <div className="border border-border/40 rounded-xl p-4 bg-muted/5 space-y-4">
              <Label className="text-foreground text-xs font-bold block">Mock Sandbox Event</Label>
              <form onSubmit={handleAddMockEffect} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Effect Type</Label>
                    <Select value={newEffectType} onValueChange={setNewEffectType}>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gdp_adjustment" className="text-xs">GDP Adjustment</SelectItem>
                        <SelectItem value="population_adjustment" className="text-xs">Pop Adjustment</SelectItem>
                        <SelectItem value="growth_rate_modifier" className="text-xs">Growth Rate Mult</SelectItem>
                        <SelectItem value="natural_disaster" className="text-xs">Natural Disaster (Direct)</SelectItem>
                        <SelectItem value="trade_agreement" className="text-xs">Trade Agreement (Direct)</SelectItem>
                        <SelectItem value="special_event" className="text-xs">Special Event (Direct)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Value (%)</Label>
                    <Input
                      type="number"
                      value={newEffectValue}
                      onChange={(e) => setNewEffectValue(e.target.value)}
                      className="h-8 text-xs font-mono"
                      step="0.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Description / Label</Label>
                  <Input
                    placeholder="e.g. Technology Boom"
                    value={newEffectDesc}
                    onChange={(e) => setNewEffectDesc(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Sandbox Event
                </Button>
              </form>

              {mockEffects.length > 0 && (
                <div className="border-t border-border/30 pt-3 space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">
                    Added Mock Effects
                  </div>
                  {mockEffects.map((eff) => (
                    <div
                      key={eff.id}
                      className="flex items-center justify-between p-2 rounded border border-indigo-500/20 bg-indigo-500/5 text-xs"
                    >
                      <div className="truncate max-w-[160px]">
                        <div className="font-semibold truncate">{eff.description}</div>
                        <div className="text-[9px] text-indigo-400">
                          {eff.type.replace("_", " ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">
                          {eff.value >= 0 ? "+" : ""}
                          {(eff.value * 100).toFixed(1)}%
                        </span>
                        <button
                          onClick={() => handleRemoveMockEffect(eff.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right React Flow + Details Inspector Column */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/* React Flow Board */}
            <div className="relative h-[480px] w-full rounded-xl border border-border/40 bg-card/30 overflow-hidden shadow-inner">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                nodesDraggable={true}
                nodesConnectable={false}
                zoomOnDoubleClick={false}
                selectNodesOnDrag={false}
                minZoom={0.5}
                maxZoom={1.5}
              >
                <Background color="#444" gap={16} size={1} />
                <Controls
                  showInteractive={false}
                  className="bg-popover border-border text-foreground border"
                />
                <Panel
                  position="top-left"
                  className="bg-background/80 border-border/55 text-muted-foreground rounded-lg border px-3 py-1.5 text-[9px] shadow-sm backdrop-blur-sm select-none"
                >
                  <span className="mr-1 font-bold text-indigo-500">💡 Formula Map:</span>
                  Click nodes to inspect formulas and values in the details panel below.
                </Panel>
              </ReactFlow>
            </div>

            {/* Selected Node Details Card */}
            <div className="border border-border/40 bg-card/40 rounded-xl p-5 shadow-sm backdrop-blur-sm">
              {renderNodeDetails()}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border/40 rounded-xl border-dashed py-24 text-center">
          <Calculator className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-60 animate-pulse" />
          <h4 className="text-foreground text-sm font-bold">No Country Loaded</h4>
          <p className="text-muted-foreground text-xs mt-1">
            Search and select a country from the dropdown to start inspecting calculations.
          </p>
        </div>
      )}
    </div>
  );
}
