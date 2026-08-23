// src/app/admin/storyteller/_components/CountryInspector.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";

const CountryFormulaFlow = dynamic(() => import("./CountryFormulaFlow"), {
  ssr: false,
  loading: () => (
    <div className="border-border/40 bg-card/30 flex h-[480px] w-full items-center justify-center rounded-xl border shadow-inner">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  ),
});


import { Search, Globe, Calculator, StatUp as TrendingUp, Calendar, Settings, Flash as Zap, Plus, Trash as Trash2, InfoCircle as Info, SystemRestart as Loader2, Dollar as DollarSign, Group as Users, Expand as Maximize2, Compress as Minimize2 } from "iconoir-react";

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
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
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
  const [newEffectDuration, _setNewEffectDuration] = useState<number>(5);

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
    const diplomaticVal = Math.min(
      100,
      Math.max(40, influence + tradeStrength + allianceStrength - tensions)
    );

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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (flowData.nodes.length > 0) {
      setNodes(flowData.nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId })));
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
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-sky-500" />
              Baseline State
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              These are the baseline values retrieved from the roster sheet, which represent the
              country's starting parameters.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-border/40 bg-muted/20 rounded-lg p-2.5">
                <span className="text-muted-foreground block text-[10px]">Baseline Population</span>
                <span className="text-foreground font-mono font-bold">
                  {calculation.baseline.pop.toLocaleString()}
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2.5">
                <span className="text-muted-foreground block text-[10px]">Baseline GDP PC</span>
                <span className="text-foreground font-mono font-bold">
                  ${calculation.baseline.gdppc.toLocaleString()}
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 col-span-2 rounded-lg p-2.5">
                <span className="text-muted-foreground block text-[10px]">Baseline Total GDP</span>
                <span className="text-foreground font-mono font-bold">
                  ${calculation.baseline.gdp.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Settings className="h-4 w-4 text-amber-500" />
              Simulation Modifiers
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Global parameters stored in system configuration along with custom sandbox
              multipliers.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Global Growth Factor</span>
                <span className="font-mono font-bold">
                  {calculation.settings.globalGrowthFactor.toFixed(4)} (
                  {((calculation.settings.globalGrowthFactor - 1) * 100).toFixed(2)}%)
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Local Multiplier Slider</span>
                <span className="font-mono font-bold text-amber-500">
                  {calculation.settings.localGrowthFactor.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tier Modifer ({calculation.baseline.tier})
                </span>
                <span className="font-mono font-bold">
                  {calculation.settings.tierModifier.toFixed(2)}x
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">Base rate × Global × Local × Tier</code>
            </div>
          </div>
        );

      case "storyteller":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-indigo-500" />
              Storyteller Effects
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Aggregate of active database storyteller effects and sandboxed mock events.
            </p>
            {calculation.effects.active.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No active storyteller modifiers.
              </p>
            ) : (
              <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1 text-xs">
                {calculation.effects.active.map((eff, index) => (
                  <div
                    key={index}
                    className={cn(
                      "border-border/40 flex items-center justify-between rounded border p-2",
                      eff.mock ? "border-indigo-500/20 bg-indigo-500/5" : "bg-muted/20"
                    )}
                  >
                    <div>
                      <div className="max-w-[150px] truncate font-medium">{eff.name}</div>
                      <div className="text-muted-foreground text-[9px]">
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
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-teal-500" />
              Effective Population Growth
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Computes the annual growth rate used to project future populations.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Baseline Pop Growth Rate</span>
                <span className="font-mono font-bold">
                  {(calculation.popGrowth.baseRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Storyteller Adjustments</span>
                <span className="font-mono font-bold text-indigo-500">
                  {calculation.popGrowth.storytellerAdjust >= 0 ? "+" : ""}
                  {(calculation.popGrowth.storytellerAdjust * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Final Pop Growth Rate</span>
                <span className="font-mono">
                  {(calculation.popGrowth.finalRate * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">Final Rate = Base Rate + Adjustments</code>
            </div>
          </div>
        );

      case "gdpGrowth":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <DollarSign className="h-4 w-4 text-purple-500" />
              Raw GDPPC Growth
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Calculates the raw annual GDP per capita growth rate after combining baseline rates,
              global multipliers, sandbox controls, and storyteller effects (before diminishing
              returns and caps).
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Baseline Growth Rate</span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.baseRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">
                  × Global Factor ({calculation.settings.globalGrowthFactor.toFixed(4)})
                </span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.withGlobalFactor * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">
                  × Local Multiplier ({calculation.settings.localGrowthFactor}x)
                </span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.withLocalFactor * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">
                  × Tier Modifier ({calculation.settings.tierModifier}x)
                </span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.withTierModifier * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">+ Storyteller Adjustments</span>
                <span className="font-mono text-indigo-500">
                  {(calculation.effects.gdpAdjust * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">× Storyteller Multipliers</span>
                <span className="font-mono text-indigo-500">
                  {calculation.effects.gdpMultiplier >= 0 ? "+" : ""}
                  {(calculation.effects.gdpMultiplier * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Raw Growth Rate</span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.withStorytellerAdjust * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">
                Raw Growth = (Base × Global × Local × Tier + Adjustments) × Multipliers
              </code>
            </div>
          </div>
        );

      case "diminishingReturns":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Info className="h-4 w-4 text-yellow-500" />
              Diminishing Returns Calculator
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Applies diminishing returns to wealthier economies (exceeding threshold) using
              logarithmic decay. This slows down growth rates for extravagant nations.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Current GDP Per Capita</span>
                <span className="font-mono font-bold">
                  ${Math.round(calculation.baseline.gdppc).toLocaleString()}
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Diminishing Threshold</span>
                <span className="font-mono font-bold">$60,000</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Status</span>
                {calculation.gdpGrowth.diminishingReturns.active ? (
                  <Badge
                    variant="outline"
                    className="border-yellow-500/30 bg-yellow-500/10 text-[10px] text-yellow-500"
                  >
                    ACTIVE
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-green-500/30 bg-green-500/10 text-[10px] text-green-500"
                  >
                    INACTIVE
                  </Badge>
                )}
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Incoming Raw Growth</span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.diminishingReturns.originalRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Reduced Rate</span>
                <span className="font-mono">
                  {(calculation.gdpGrowth.diminishingReturns.reducedRate * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 space-y-1 rounded p-2 text-[10px]">
              <div>
                Formula:{" "}
                <code className="font-mono font-semibold">
                  Reduced = Raw / (1 + DiminishingFactor × 0.5)
                </code>
              </div>
              <div>
                • Factor:{" "}
                <code className="font-mono font-semibold">
                  DiminishingFactor = log2(GDPC / 60,000 + 1)
                </code>
              </div>
            </div>
          </div>
        );

      case "tierCap":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="h-4 w-4 text-pink-500" />
              Economic Tier Growth Cap
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Limits the maximum annual growth rate based on the country's current economic tier to
              prevent hyper-growth at high wealth.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Current Tier</span>
                <span className="text-foreground font-bold">{calculation.baseline.tier}</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Max Tier Growth Cap</span>
                <span className="font-mono font-bold text-pink-500">
                  {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cap Status</span>
                {calculation.gdpGrowth.isCapped ? (
                  <Badge
                    variant="outline"
                    className="border-red-500/30 bg-red-500/10 text-[10px] text-red-500"
                  >
                    CAPPED
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-green-500/30 bg-green-500/10 text-[10px] text-green-500"
                  >
                    UNCAPPED
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              {calculation.baseline.tier} limits annual GDPPC growth to{" "}
              {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%.
            </div>
          </div>
        );

      case "progression":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Calendar className="h-4 w-4 text-orange-500" />
              Time Progression Engine
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Compounds growth rates over the target timeline. Also applies one-time special
              modifiers (like natural disaster reductions).
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Years Projected</span>
                <span className="font-mono font-bold text-orange-500">
                  {calculation.progression.years.toFixed(1)}
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Compound Pop Growth Factor</span>
                <span className="font-mono">
                  {calculation.progression.popGrowthCompound.toFixed(4)}x
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Compound GDP Growth Factor</span>
                <span className="font-mono">
                  {calculation.progression.gdpGrowthCompound.toFixed(4)}x
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">Value_t = Value_0 × (1 + r)^N</code>
            </div>
          </div>
        );

      case "directModifiers":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-red-500" />
              Direct Special Modifiers
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Applies one-time direct modifiers to outputs at the end of simulation (e.g. natural
              disasters, trade agreements). These are not compounded annually.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Direct Population Modifier</span>
                <span className="font-mono font-bold text-red-500">
                  {calculation.progression.directPopModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directPopModifier * 100).toFixed(1)}%
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Direct GDP Modifier</span>
                <span className="font-mono font-bold text-red-500">
                  {calculation.progression.directGdpModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directGdpModifier * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">
                Output = CompoundedState × (1 + DirectModifier)
              </code>
            </div>
          </div>
        );

      case "output":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Projected Output
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              The final calculated state of the country after running all simulation adjustments.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-border/40 bg-muted/20 rounded-lg p-2">
                <span className="text-muted-foreground block text-[9px]">Projected Population</span>
                <span className="text-foreground font-mono font-bold">
                  {Math.round(calculation.output.pop).toLocaleString()}
                </span>
                <span className="text-muted-foreground block text-[9px]">
                  (Tier {calculation.output.popTier})
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 rounded-lg p-2">
                <span className="text-muted-foreground block text-[9px]">Projected GDP PC</span>
                <span className="text-foreground font-mono font-bold">
                  ${Math.round(calculation.output.gdppc).toLocaleString()}
                </span>
                <span className="text-muted-foreground block text-[9px]">
                  ({calculation.output.tier})
                </span>
              </div>
              <div className="border-border/40 bg-muted/20 col-span-2 rounded-lg p-2">
                <span className="text-muted-foreground block text-[9px]">Projected Total GDP</span>
                <span className="font-mono font-bold text-emerald-500">
                  {fmtBig(calculation.output.gdp)}
                </span>
              </div>
              {calculation.output.popDensity !== undefined && (
                <div className="border-border/40 bg-muted/20 col-span-2 rounded-lg p-2">
                  <span className="text-muted-foreground block text-[9px]">Population Density</span>
                  <span className="text-foreground font-mono font-medium">
                    {calculation.output.popDensity.toFixed(1)} / km²
                  </span>
                </div>
              )}
            </div>
            <div className="text-muted-foreground bg-muted/30 mt-2 rounded p-2 text-[10px]">
              Formula:{" "}
              <code className="font-mono font-semibold">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "vitality":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Calculator className="h-4 w-4 text-emerald-500" />
              Economic Vitality Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Calculates index reflecting GDP wealth and growth rate.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">GDP Score Component</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.gdpScore.toFixed(1)} / 100
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Growth Bonus</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.growthBonus.toFixed(1)}
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Final Economic Vitality</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.vitality)} / 100
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 space-y-1 rounded p-2 text-[10px]">
              <div>
                Formula:{" "}
                <code className="font-mono font-semibold">
                  Vitality = (GDP Score × 0.7) + Growth Bonus + 30
                </code>
              </div>
              <div>
                • GDP Score:{" "}
                <code className="font-mono font-semibold">Min(100, (GDPPC / 50,000) × 100)</code>
              </div>
              <div>
                • Growth Bonus:{" "}
                <code className="font-mono font-semibold">Clamp(Growth Rate × 400, -20, 20)</code>
              </div>
            </div>
          </div>
        );

      case "wellbeing":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-teal-500" />
              Population Wellbeing Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Combines growth health status and population density factors.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Growth Health</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.growthHealth}
                </span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Density Factor</span>
                <span className="font-mono font-bold">
                  {calculation.secondary.details.densityFactor.toFixed(1)}
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Final Wellbeing</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.wellbeing)} / 100
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 space-y-1 rounded p-2 text-[10px]">
              <div>
                Formula:{" "}
                <code className="font-mono font-semibold">
                  Wellbeing = (Growth Health + Density Factor) / 2
                </code>
              </div>
              <div>
                • Growth Health:{" "}
                <code className="font-mono font-semibold">Pop Growth &gt; 0 ? 70 : 40</code>
              </div>
              <div>
                • Density Factor:{" "}
                <code className="font-mono font-semibold">Max(50, 100 - Density / 500)</code>
              </div>
            </div>
          </div>
        );

      case "efficiency":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Settings className="h-4 w-4 text-pink-500" />
              Governmental Efficiency Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Computed based on the economic tier category score multiplier.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Economic Tier</span>
                <span className="font-bold">{calculation.output.tier}</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Tier Base Score</span>
                <span className="font-mono font-bold">
                  {Math.round(calculation.secondary.efficiency / 0.8)}
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Final Efficiency</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.efficiency)} / 100
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 space-y-1 rounded p-2 text-[10px]">
              <div>
                Formula:{" "}
                <code className="font-mono font-semibold">Efficiency = Tier Score × 0.8</code>
              </div>
              <div>
                • Tier Scores:{" "}
                <code className="font-mono text-[9px]">
                  Extravagant=95, VeryStrong=85, Strong=75, Healthy=65, Developed=50, Developing=35,
                  Impoverished=25
                </code>
              </div>
            </div>
          </div>
        );

      case "diplomatic":
        return (
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-indigo-500" />
              Diplomatic Standing Formula
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Derived from influence, alliances, and trade strength offsets against tensions.
            </p>
            <div className="space-y-2 text-xs">
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Global Influence</span>
                <span className="font-mono">{calculation.secondary.details.influence}</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Trade Relationship Strength</span>
                <span className="font-mono">+{calculation.secondary.details.tradeStrength}</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Alliance Strength</span>
                <span className="font-mono">+{calculation.secondary.details.allianceStrength}</span>
              </div>
              <div className="border-border/30 flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Diplomatic Tensions</span>
                <span className="font-mono text-red-500">
                  -{calculation.secondary.details.tensions}
                </span>
              </div>
              <div className="text-foreground flex justify-between font-bold">
                <span>Final Diplomatic Standing</span>
                <span className="font-mono">
                  {Math.round(calculation.secondary.diplomatic)} / 100
                </span>
              </div>
            </div>
            <div className="text-muted-foreground bg-muted/30 space-y-1 rounded p-2 text-[10px]">
              <div>
                Formula:{" "}
                <code className="font-mono font-semibold">
                  Standing = Clamp(Influence + Trade + Alliance - Tensions, 40, 100)
                </code>
              </div>
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
      <div className="border-border/30 flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <Calculator className="h-5 w-5 text-indigo-500" />
            Country Calculation Pipeline Inspector
          </h3>
          <p className="text-muted-foreground text-xs">
            Select a nation to analyze base metrics, growth configurations, caps, and storyteller
            adjustments.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
                className="h-9 pl-9"
              />
            </div>

            {showDropdown && (
              <div className="border-border/40 bg-popover text-popover-foreground absolute right-0 left-0 z-50 mt-1.5 rounded-lg border shadow-lg backdrop-blur-md">
                <ScrollArea className="h-[220px]">
                  <div className="space-y-0.5 p-1">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCountryId(c.id);
                          setSearchQuery(c.name);
                          setShowDropdown(false);
                        }}
                        className={cn(
                          "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                          selectedCountryId === c.id ? "bg-accent text-accent-foreground" : ""
                        )}
                      >
                        <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="xs" />
                        <span className="text-foreground font-semibold">{c.name}</span>
                        <span className="text-muted-foreground ml-auto text-[10px]">
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
            className="bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
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
            <div className="border-border/40 bg-muted/15 flex items-center gap-3 rounded-xl border p-4">
              <UnifiedCountryFlag
                countryName={countryData.name}
                flagUrl={countryData.flag}
                size="lg"
              />
              <div>
                <h4 className="text-foreground text-sm font-extrabold">{countryData.name}</h4>
                <div className="text-muted-foreground space-y-0.5 text-[10px]">
                  <div>Region: {countryData.region || "Global"}</div>
                  <div>Baseline: {calculation.baseline.date.toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <div className="border-border/40 bg-muted/5 space-y-5 rounded-xl border p-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-foreground">Target Projection Timeline</Label>
                  <span className="font-mono text-orange-500">+{yearsElapsed.toFixed(1)} yrs</span>
                </div>
                <Slider
                  value={[yearsElapsed]}
                  onValueChange={([v]) => setYearsElapsed(v!)}
                  min={0}
                  max={20}
                  step={0.5}
                />
                <div className="text-muted-foreground flex justify-between text-[9px]">
                  <span>Baseline ({calculation.baseline.date.getFullYear()})</span>
                  <span>
                    +{yearsElapsed.toFixed(1)} yrs (
                    {calculation.baseline.date.getFullYear() + Math.floor(yearsElapsed)})
                  </span>
                </div>
              </div>

              <div className="border-border/30 space-y-1.5 border-t pt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-foreground">Local Growth Multiplier</Label>
                  <span className="font-mono text-amber-500">{localMultiplier.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[localMultiplier]}
                  onValueChange={([v]) => setLocalMultiplier(v!)}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                />
                <div className="text-muted-foreground flex justify-between text-[9px]">
                  <span>0.50x Penalty</span>
                  <span>1.0x Normal</span>
                  <span>2.00x Boost</span>
                </div>
              </div>
            </div>

            {/* Active database storyteller effects */}
            <div className="border-border/40 bg-muted/5 space-y-3 rounded-xl border p-4">
              <Label className="text-foreground block text-xs font-bold">
                Active Database Effects
              </Label>
              {countryData.storytellerEffects && countryData.storytellerEffects.length > 0 ? (
                <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                  {countryData.storytellerEffects.map((eff: any) => {
                    const isDisabled = !!disabledEffects[eff.id];
                    return (
                      <div
                        key={eff.id}
                        className={cn(
                          "flex items-center justify-between rounded border p-2 transition-colors",
                          isDisabled
                            ? "bg-muted/10 border-border/20 opacity-50"
                            : "bg-muted/30 border-border/50"
                        )}
                      >
                        <div className="max-w-[170px] truncate text-xs">
                          <div className="truncate font-semibold">
                            {eff.description || `${eff.inputType} effect`}
                          </div>
                          <div className="text-muted-foreground text-[9px]">
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
                              "rounded border px-1.5 py-0.5 text-[9px] font-bold transition-all",
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
            <div className="border-border/40 bg-muted/5 space-y-4 rounded-xl border p-4">
              <Label className="text-foreground block text-xs font-bold">Mock Sandbox Event</Label>
              <form onSubmit={handleAddMockEffect} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">Effect Type</Label>
                    <Select value={newEffectType} onValueChange={setNewEffectType}>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gdp_adjustment" className="text-xs">
                          GDP Adjustment
                        </SelectItem>
                        <SelectItem value="population_adjustment" className="text-xs">
                          Pop Adjustment
                        </SelectItem>
                        <SelectItem value="growth_rate_modifier" className="text-xs">
                          Growth Rate Mult
                        </SelectItem>
                        <SelectItem value="natural_disaster" className="text-xs">
                          Natural Disaster (Direct)
                        </SelectItem>
                        <SelectItem value="trade_agreement" className="text-xs">
                          Trade Agreement (Direct)
                        </SelectItem>
                        <SelectItem value="special_event" className="text-xs">
                          Special Event (Direct)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">Value (%)</Label>
                    <Input
                      type="number"
                      value={newEffectValue}
                      onChange={(e) => setNewEffectValue(e.target.value)}
                      className="h-8 font-mono text-xs"
                      step="0.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-[10px]">Description / Label</Label>
                  <Input
                    placeholder="e.g. Technology Boom"
                    value={newEffectDesc}
                    onChange={(e) => setNewEffectDesc(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <Button type="submit" size="sm" className="h-8 w-full text-xs font-semibold">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Sandbox Event
                </Button>
              </form>

              {mockEffects.length > 0 && (
                <div className="border-border/30 max-h-[140px] space-y-2 overflow-y-auto border-t pt-3 pr-1">
                  <div className="text-[10px] font-bold tracking-wider text-indigo-500 uppercase">
                    Added Mock Effects
                  </div>
                  {mockEffects.map((eff) => (
                    <div
                      key={eff.id}
                      className="flex items-center justify-between rounded border border-indigo-500/20 bg-indigo-500/5 p-2 text-xs"
                    >
                      <div className="max-w-[160px] truncate">
                        <div className="truncate font-semibold">{eff.description}</div>
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
                          className="p-0.5 text-red-400 transition-colors hover:text-red-300"
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
            <CountryFormulaFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
            />


            {/* Selected Node Details Card */}
            <div className="border-border/40 bg-card/40 rounded-xl border p-5 shadow-sm backdrop-blur-sm">
              {renderNodeDetails()}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-border/40 rounded-xl border border-dashed py-24 text-center">
          <Calculator className="text-muted-foreground mx-auto mb-3 h-10 w-10 animate-pulse opacity-60" />
          <h4 className="text-foreground text-sm font-bold">No Country Loaded</h4>
          <p className="text-muted-foreground mt-1 text-xs">
            Search and select a country from the dropdown to start inspecting calculations.
          </p>
        </div>
      )}
    </div>
  );
}
