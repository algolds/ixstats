"use client";
// src/app/admin/storyteller/_components/CountryInspector.tsx

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useNodesState, useEdgesState, type Node, type Edge } from "@xyflow/react";

const CountryFormulaFlow = dynamic(() => import("./CountryFormulaFlow"), {
  ssr: false,
  loading: () => (
    <div className="border-separator bg-surface rounded-row flex h-[480px] w-full items-center justify-center border">
      <div className="border-indigo h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  ),
});

import {
  Search,
  Globe,
  Calculator,
  StatUp as TrendingUp,
  Calendar,
  Settings,
  Flash as Zap,
  Plus,
  Trash as Trash2,
  InfoCircle as Info,
  SystemRestart as Loader2,
  Dollar as DollarSign,
  Group as Users,
  Expand as Maximize2,
  Compress as Minimize2,
} from "iconoir-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { ScrollArea } from "~/components/ui/scroll-area";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { cn } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";
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
    { limit: 250, realm: ALL_REALMS },
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
    // oxlint-disable-next-line
  }, [selectedCountryId]);

  const fmtBig = (n: number) => `$${formatCompact(n)}`;

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
          subValue: `Pop: ${formatCompact(calculation.baseline.pop)} | Area: ${calculation.baseline.landArea.toLocaleString()} km²`,
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
        style: { stroke: "var(--color-chart-2)", strokeWidth: 1.5 },
      },
      {
        id: "e-baseline-gdpgrowth",
        source: "baseline",
        target: "gdpGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-6)", strokeWidth: 1.5 },
      },
      {
        id: "e-baseline-popgrowth",
        source: "baseline",
        target: "popGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-6)", strokeWidth: 1.5 },
      },
      {
        id: "e-storyteller-gdpgrowth",
        source: "storyteller",
        target: "gdpGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-indigo)", strokeWidth: 1.5 },
      },
      {
        id: "e-storyteller-popgrowth",
        source: "storyteller",
        target: "popGrowth",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-indigo)", strokeWidth: 1.5 },
      },
      {
        id: "e-popgrowth-progression",
        source: "popGrowth",
        target: "progression",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-6)", strokeWidth: 1.5 },
      },
      {
        id: "e-gdpgrowth-dr",
        source: "gdpGrowth",
        target: "diminishingReturns",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-4)", strokeWidth: 1.5 },
      },
      {
        id: "e-dr-tiercap",
        source: "diminishingReturns",
        target: "tierCap",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-7)", strokeWidth: 1.5 },
      },
      {
        id: "e-tiercap-progression",
        source: "tierCap",
        target: "progression",
        sourceHandle: "right",
        targetHandle: "bottom",
        animated: true,
        style: { stroke: "var(--color-chart-5)", strokeWidth: 1.5 },
      },
      {
        id: "e-progression-directmodifiers",
        source: "progression",
        target: "directModifiers",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-2)", strokeWidth: 2 },
      },
      {
        id: "e-directmodifiers-output",
        source: "directModifiers",
        target: "output",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-8)", strokeWidth: 2 },
      },
      {
        id: "e-output-vitality",
        source: "output",
        target: "vitality",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-3)", strokeWidth: 1.5 },
      },
      {
        id: "e-output-wellbeing",
        source: "output",
        target: "wellbeing",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-6)", strokeWidth: 1.5 },
      },
      {
        id: "e-output-efficiency",
        source: "output",
        target: "efficiency",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-chart-4)", strokeWidth: 1.5 },
      },
      {
        id: "e-output-diplomatic",
        source: "output",
        target: "diplomatic",
        sourceHandle: "right",
        targetHandle: "left",
        animated: true,
        style: { stroke: "var(--color-indigo)", strokeWidth: 1.5 },
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
            <h4 className="text-label text-headline flex items-center gap-2">
              <Globe className="text-blue h-4 w-4" />
              Baseline State
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              These are the baseline values retrieved from the roster sheet, which represent the
              country's starting parameters.
            </p>
            <div className="text-footnote grid grid-cols-2 gap-2">
              <div className="border-separator bg-fill-4 rounded-control p-3">
                <span className="text-label-secondary text-footnote block">
                  Baseline Population
                </span>
                <span className="text-label font-semibold tabular-nums">
                  {calculation.baseline.pop.toLocaleString()}
                </span>
              </div>
              <div className="border-separator bg-fill-4 rounded-control p-3">
                <span className="text-label-secondary text-footnote block">Baseline GDP PC</span>
                <span className="text-label font-semibold tabular-nums">
                  ${calculation.baseline.gdppc.toLocaleString()}
                </span>
              </div>
              <div className="border-separator bg-fill-4 rounded-control col-span-2 p-3">
                <span className="text-label-secondary text-footnote block">Baseline Total GDP</span>
                <span className="text-label font-semibold tabular-nums">
                  ${calculation.baseline.gdp.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Settings className="text-yellow h-4 w-4" />
              Simulation Modifiers
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Global parameters stored in system configuration along with custom sandbox
              multipliers.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Global Growth Factor</span>
                <span className="font-semibold tabular-nums">
                  {calculation.settings.globalGrowthFactor.toFixed(4)} (
                  {((calculation.settings.globalGrowthFactor - 1) * 100).toFixed(2)}%)
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Local Multiplier Slider</span>
                <span className="text-yellow font-semibold tabular-nums">
                  {calculation.settings.localGrowthFactor.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-label-secondary">
                  Tier Modifer ({calculation.baseline.tier})
                </span>
                <span className="font-semibold tabular-nums">
                  {calculation.settings.tierModifier.toFixed(2)}x
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">Base rate × Global × Local × Tier</code>
            </div>
          </div>
        );

      case "storyteller":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Zap className="text-indigo h-4 w-4" />
              Storyteller Effects
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Aggregate of active database storyteller effects and sandboxed mock events.
            </p>
            {calculation.effects.active.length === 0 ? (
              <p className="text-label-secondary text-footnote italic">
                No active storyteller modifiers.
              </p>
            ) : (
              <div className="text-footnote max-h-[160px] space-y-2 overflow-y-auto pr-1">
                {calculation.effects.active.map((eff, index) => (
                  <div
                    key={index}
                    className={cn(
                      "border-separator rounded-control-sm flex items-center justify-between border p-2",
                      eff.mock ? "border-indigo/20 bg-indigo/5" : "bg-fill-4"
                    )}
                  >
                    <div>
                      <div className="max-w-[150px] truncate font-medium">{eff.name}</div>
                      <div className="text-label-secondary text-footnote">
                        {eff.type.replace("_", " ")} {eff.mock ? "(Sandbox)" : "(DB)"}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums">
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
            <h4 className="text-label text-headline flex items-center gap-2">
              <Users className="text-teal h-4 w-4" />
              Effective Population Growth
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Computes the annual growth rate used to project future populations.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Baseline Pop Growth Rate</span>
                <span className="font-semibold tabular-nums">
                  {(calculation.popGrowth.baseRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Storyteller Adjustments</span>
                <span className="text-indigo font-semibold tabular-nums">
                  {calculation.popGrowth.storytellerAdjust >= 0 ? "+" : ""}
                  {(calculation.popGrowth.storytellerAdjust * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Final Pop Growth Rate</span>
                <span className="tabular-nums">
                  {(calculation.popGrowth.finalRate * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">
                Final Rate = Base Rate + Adjustments
              </code>
            </div>
          </div>
        );

      case "gdpGrowth":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <DollarSign className="text-purple h-4 w-4" />
              Raw GDPPC Growth
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Calculates the raw annual GDP per capita growth rate after combining baseline rates,
              global multipliers, sandbox controls, and storyteller effects (before diminishing
              returns and caps).
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Baseline Growth Rate</span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.baseRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">
                  × Global Factor ({calculation.settings.globalGrowthFactor.toFixed(4)})
                </span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.withGlobalFactor * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">
                  × Local Multiplier ({calculation.settings.localGrowthFactor}x)
                </span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.withLocalFactor * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">
                  × Tier Modifier ({calculation.settings.tierModifier}x)
                </span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.withTierModifier * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">+ Storyteller Adjustments</span>
                <span className="text-indigo tabular-nums">
                  {(calculation.effects.gdpAdjust * 100).toFixed(2)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">× Storyteller Multipliers</span>
                <span className="text-indigo tabular-nums">
                  {calculation.effects.gdpMultiplier >= 0 ? "+" : ""}
                  {(calculation.effects.gdpMultiplier * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Raw Growth Rate</span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.withStorytellerAdjust * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">
                Raw Growth = (Base × Global × Local × Tier + Adjustments) × Multipliers
              </code>
            </div>
          </div>
        );

      case "diminishingReturns":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Info className="text-yellow h-4 w-4" />
              Diminishing Returns Calculator
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Applies diminishing returns to wealthier economies (exceeding threshold) using
              logarithmic decay. This slows down growth rates for extravagant nations.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Current GDP Per Capita</span>
                <span className="font-semibold tabular-nums">
                  ${Math.round(calculation.baseline.gdppc).toLocaleString()}
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Diminishing Threshold</span>
                <span className="font-semibold tabular-nums">$60,000</span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Status</span>
                {calculation.gdpGrowth.diminishingReturns.active ? (
                  <Badge variant="warning">ACTIVE</Badge>
                ) : (
                  <Badge variant="success">INACTIVE</Badge>
                )}
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Incoming Raw Growth</span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.diminishingReturns.originalRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Reduced Rate</span>
                <span className="tabular-nums">
                  {(calculation.gdpGrowth.diminishingReturns.reducedRate * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote space-y-1 p-2">
              <div>
                Formula:{" "}
                <code className="font-semibold tabular-nums">
                  Reduced = Raw / (1 + DiminishingFactor × 0.5)
                </code>
              </div>
              <div>
                • Factor:{" "}
                <code className="font-semibold tabular-nums">
                  DiminishingFactor = log2(GDPC / 60,000 + 1)
                </code>
              </div>
            </div>
          </div>
        );

      case "tierCap":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <TrendingUp className="text-pink h-4 w-4" />
              Economic Tier Growth Cap
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Limits the maximum annual growth rate based on the country's current economic tier to
              prevent hyper-growth at high wealth.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Current Tier</span>
                <span className="text-label font-semibold">{calculation.baseline.tier}</span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Max Tier Growth Cap</span>
                <span className="text-pink font-semibold tabular-nums">
                  {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label-secondary">Cap Status</span>
                {calculation.gdpGrowth.isCapped ? (
                  <Badge variant="destructive">CAPPED</Badge>
                ) : (
                  <Badge variant="success">UNCAPPED</Badge>
                )}
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              {calculation.baseline.tier} limits annual GDPPC growth to{" "}
              {(calculation.gdpGrowth.tierMax * 100).toFixed(2)}%.
            </div>
          </div>
        );

      case "progression":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Calendar className="text-orange h-4 w-4" />
              Time Progression Engine
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Compounds growth rates over the target timeline. Also applies one-time special
              modifiers (like natural disaster reductions).
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Years Projected</span>
                <span className="text-orange font-semibold tabular-nums">
                  {calculation.progression.years.toFixed(1)}
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Compound Pop Growth Factor</span>
                <span className="tabular-nums">
                  {calculation.progression.popGrowthCompound.toFixed(4)}x
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Compound GDP Growth Factor</span>
                <span className="tabular-nums">
                  {calculation.progression.gdpGrowthCompound.toFixed(4)}x
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">Value_t = Value_0 × (1 + r)^N</code>
            </div>
          </div>
        );

      case "directModifiers":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Zap className="text-red h-4 w-4" />
              Direct Special Modifiers
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Applies one-time direct modifiers to outputs at the end of simulation (e.g. natural
              disasters, trade agreements). These are not compounded annually.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Direct Population Modifier</span>
                <span className="text-red font-semibold tabular-nums">
                  {calculation.progression.directPopModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directPopModifier * 100).toFixed(1)}%
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Direct GDP Modifier</span>
                <span className="text-red font-semibold tabular-nums">
                  {calculation.progression.directGdpModifier >= 0 ? "+" : ""}
                  {(calculation.progression.directGdpModifier * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">
                Output = CompoundedState × (1 + DirectModifier)
              </code>
            </div>
          </div>
        );

      case "output":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <TrendingUp className="text-green h-4 w-4" />
              Projected Output
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              The final calculated state of the country after running all simulation adjustments.
            </p>
            <div className="text-footnote grid grid-cols-2 gap-2">
              <div className="border-separator bg-fill-4 rounded-control p-2">
                <span className="text-label-secondary text-footnote block">
                  Projected Population
                </span>
                <span className="text-label font-semibold tabular-nums">
                  {Math.round(calculation.output.pop).toLocaleString()}
                </span>
                <span className="text-label-secondary text-footnote block">
                  (Tier {calculation.output.popTier})
                </span>
              </div>
              <div className="border-separator bg-fill-4 rounded-control p-2">
                <span className="text-label-secondary text-footnote block">Projected GDP PC</span>
                <span className="text-label font-semibold tabular-nums">
                  ${Math.round(calculation.output.gdppc).toLocaleString()}
                </span>
                <span className="text-label-secondary text-footnote block">
                  ({calculation.output.tier})
                </span>
              </div>
              <div className="border-separator bg-fill-4 rounded-control col-span-2 p-2">
                <span className="text-label-secondary text-footnote block">
                  Projected Total GDP
                </span>
                <span className="text-green font-semibold tabular-nums">
                  {fmtBig(calculation.output.gdp)}
                </span>
              </div>
              {calculation.output.popDensity !== undefined && (
                <div className="border-separator bg-fill-4 rounded-control col-span-2 p-2">
                  <span className="text-label-secondary text-footnote block">
                    Population Density
                  </span>
                  <span className="text-label font-medium tabular-nums">
                    {calculation.output.popDensity.toFixed(1)} / km²
                  </span>
                </div>
              )}
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote mt-2 p-2">
              Formula:{" "}
              <code className="font-semibold tabular-nums">Total GDP = Population × GDP PC</code>
            </div>
          </div>
        );

      case "vitality":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Calculator className="text-green h-4 w-4" />
              Economic Vitality Formula
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Calculates index reflecting GDP wealth and growth rate.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">GDP Score Component</span>
                <span className="font-semibold tabular-nums">
                  {calculation.secondary.details.gdpScore.toFixed(1)} / 100
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Growth Bonus</span>
                <span className="font-semibold tabular-nums">
                  {calculation.secondary.details.growthBonus.toFixed(1)}
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Final Economic Vitality</span>
                <span className="tabular-nums">
                  {Math.round(calculation.secondary.vitality)} / 100
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote space-y-1 p-2">
              <div>
                Formula:{" "}
                <code className="font-semibold tabular-nums">
                  Vitality = (GDP Score × 0.7) + Growth Bonus + 30
                </code>
              </div>
              <div>
                • GDP Score:{" "}
                <code className="font-semibold tabular-nums">Min(100, (GDPPC / 50,000) × 100)</code>
              </div>
              <div>
                • Growth Bonus:{" "}
                <code className="font-semibold tabular-nums">
                  Clamp(Growth Rate × 400, -20, 20)
                </code>
              </div>
            </div>
          </div>
        );

      case "wellbeing":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Users className="text-teal h-4 w-4" />
              Population Wellbeing Formula
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Combines growth health status and population density factors.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Growth Health</span>
                <span className="font-semibold tabular-nums">
                  {calculation.secondary.details.growthHealth}
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Density Factor</span>
                <span className="font-semibold tabular-nums">
                  {calculation.secondary.details.densityFactor.toFixed(1)}
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Final Wellbeing</span>
                <span className="tabular-nums">
                  {Math.round(calculation.secondary.wellbeing)} / 100
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote space-y-1 p-2">
              <div>
                Formula:{" "}
                <code className="font-semibold tabular-nums">
                  Wellbeing = (Growth Health + Density Factor) / 2
                </code>
              </div>
              <div>
                • Growth Health:{" "}
                <code className="font-semibold tabular-nums">Pop Growth &gt; 0 ? 70 : 40</code>
              </div>
              <div>
                • Density Factor:{" "}
                <code className="font-semibold tabular-nums">Max(50, 100 - Density / 500)</code>
              </div>
            </div>
          </div>
        );

      case "efficiency":
        return (
          <div className="space-y-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Settings className="text-pink h-4 w-4" />
              Governmental Efficiency Formula
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Computed based on the economic tier category score multiplier.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Economic Tier</span>
                <span className="font-semibold">{calculation.output.tier}</span>
              </div>
              <div className="border-separator flex justify-between border-b pb-2">
                <span className="text-label-secondary">Tier Base Score</span>
                <span className="font-semibold tabular-nums">
                  {Math.round(calculation.secondary.efficiency / 0.8)}
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Final Efficiency</span>
                <span className="tabular-nums">
                  {Math.round(calculation.secondary.efficiency)} / 100
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote space-y-1 p-2">
              <div>
                Formula:{" "}
                <code className="font-semibold tabular-nums">Efficiency = Tier Score × 0.8</code>
              </div>
              <div>
                • Tier Scores:{" "}
                <code className="text-footnote tabular-nums">
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
            <h4 className="text-label text-headline flex items-center gap-2">
              <Globe className="text-indigo h-4 w-4" />
              Diplomatic Standing Formula
            </h4>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Derived from influence, alliances, and trade strength offsets against tensions.
            </p>
            <div className="text-footnote space-y-2">
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Global Influence</span>
                <span className="tabular-nums">{calculation.secondary.details.influence}</span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Trade Relationship Strength</span>
                <span className="tabular-nums">+{calculation.secondary.details.tradeStrength}</span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Alliance Strength</span>
                <span className="tabular-nums">
                  +{calculation.secondary.details.allianceStrength}
                </span>
              </div>
              <div className="border-separator flex justify-between border-b pb-1">
                <span className="text-label-secondary">Diplomatic Tensions</span>
                <span className="text-red tabular-nums">
                  -{calculation.secondary.details.tensions}
                </span>
              </div>
              <div className="text-label flex justify-between font-semibold">
                <span>Final Diplomatic Standing</span>
                <span className="tabular-nums">
                  {Math.round(calculation.secondary.diplomatic)} / 100
                </span>
              </div>
            </div>
            <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote space-y-1 p-2">
              <div>
                Formula:{" "}
                <code className="font-semibold tabular-nums">
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
      <div className="border-separator flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h3 className="text-label text-title-3 flex items-center gap-2">
            <Calculator className="text-indigo h-5 w-5" />
            Country Calculation Pipeline Inspector
          </h3>
          <p className="text-label-secondary text-footnote">
            Select a nation to analyze base metrics, growth configurations, caps, and storyteller
            adjustments.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {/* Search Input Searchable Single-select */}
          <div className="relative w-full sm:w-[240px]">
            <div className="relative">
              <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Select country..."
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                className="pl-9"
              />
            </div>

            {showDropdown && (
              <div className="border-separator bg-surface-elevated text-label rounded-control absolute right-0 left-0 z-50 mt-2 border">
                <ScrollArea className="h-[220px]">
                  <div className="p-1">
                    <FacetListSection variant="plain" aria-label="Countries">
                      {filteredCountries.map((c) => (
                        <FacetRow
                          key={c.id}
                          onClick={() => {
                            setSelectedCountryId(c.id);
                            setSearchQuery(c.name);
                            setShowDropdown(false);
                          }}
                          selected={selectedCountryId === c.id}
                          accessory="check"
                          leading={
                            <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="xs" />
                          }
                          title={c.name}
                          trailing={
                            <span className="text-label-secondary text-footnote">
                              {c.economicTier}
                            </span>
                          }
                        />
                      ))}
                    </FacetListSection>
                    {filteredCountries.length === 0 && (
                      <div className="text-label-secondary text-footnote py-3 text-center">
                        No matching countries.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <Button
            variant="outline"
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setSidebarHidden(!sidebarHidden);
            }}
            className="shrink-0"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            <span className="hidden sm:inline">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </Button>
        </div>
      </div>

      {isCountryLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="text-tint h-8 w-8 animate-spin" />
          <p className="text-label-secondary text-footnote mt-3">Loading Country Parameters...</p>
        </div>
      ) : countryData && calculation ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Controls Column */}
          <div className="space-y-6 lg:col-span-4">
            {/* Country info header */}
            <div className="border-separator bg-fill-4 rounded-row flex items-center gap-3 border p-4">
              <UnifiedCountryFlag
                countryName={countryData.name}
                flagUrl={countryData.flag}
                size="lg"
              />
              <div>
                <h4 className="text-label text-headline">{countryData.name}</h4>
                <div className="text-label-secondary text-footnote space-y-0.5">
                  <div>Region: {countryData.region || "Global"}</div>
                  <div>Baseline: {calculation.baseline.date.toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <div className="border-separator bg-fill-4 rounded-row space-y-5 border p-4">
              <div className="space-y-2">
                <div className="text-caption flex items-center justify-between">
                  <Label className="text-label">Target Projection Timeline</Label>
                  <span className="text-orange tabular-nums">+{yearsElapsed.toFixed(1)} yrs</span>
                </div>
                <Slider
                  value={[yearsElapsed]}
                  onValueChange={([v]) => setYearsElapsed(v!)}
                  min={0}
                  max={20}
                  step={0.5}
                />
                <div className="text-label-secondary text-footnote flex justify-between">
                  <span>Baseline ({calculation.baseline.date.getFullYear()})</span>
                  <span>
                    +{yearsElapsed.toFixed(1)} yrs (
                    {calculation.baseline.date.getFullYear() + Math.floor(yearsElapsed)})
                  </span>
                </div>
              </div>

              <div className="border-separator space-y-2 border-t pt-4">
                <div className="text-caption flex items-center justify-between">
                  <Label className="text-label">Local Growth Multiplier</Label>
                  <span className="text-yellow tabular-nums">{localMultiplier.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[localMultiplier]}
                  onValueChange={([v]) => setLocalMultiplier(v!)}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                />
                <div className="text-label-secondary text-footnote flex justify-between">
                  <span>0.50x Penalty</span>
                  <span>1.0x Normal</span>
                  <span>2.00x Boost</span>
                </div>
              </div>
            </div>

            {/* Active database storyteller effects */}
            <div className="border-separator bg-fill-4 rounded-row space-y-3 border p-4">
              <Label className="text-label text-caption block">Active Database Effects</Label>
              {countryData.storytellerEffects && countryData.storytellerEffects.length > 0 ? (
                <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                  {countryData.storytellerEffects.map((eff: any) => {
                    const isDisabled = !!disabledEffects[eff.id];
                    return (
                      <div
                        key={eff.id}
                        className={cn(
                          "rounded-control-sm flex items-center justify-between border p-2 transition-colors",
                          isDisabled
                            ? "bg-fill-4 border-separator opacity-50"
                            : "bg-fill-4 border-separator"
                        )}
                      >
                        <div className="text-footnote max-w-[170px] truncate">
                          <div className="truncate font-semibold">
                            {eff.description || `${eff.inputType} effect`}
                          </div>
                          <div className="text-label-secondary text-footnote">
                            {eff.inputType.replace("_", " ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-caption tabular-nums">
                            {eff.value >= 0 ? "+" : ""}
                            {(eff.value * 100).toFixed(1)}%
                          </span>
                          <Button
                            size="sm"
                            variant={isDisabled ? "secondary" : "ghost"}
                            onClick={() => handleToggleDbEffect(eff.id)}
                            className={cn(!isDisabled && "text-destructive")}
                          >
                            {isDisabled ? "Enable" : "Disable"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-label-secondary text-footnote italic">
                  No active database storyteller events found for this country.
                </p>
              )}
            </div>

            {/* Mock Sandbox effects form */}
            <div className="border-separator bg-fill-4 rounded-row space-y-4 border p-4">
              <Label className="text-label text-caption block">Mock Sandbox Event</Label>
              <form onSubmit={handleAddMockEffect} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-label-secondary text-footnote">Effect Type</Label>
                    <Select value={newEffectType} onValueChange={setNewEffectType}>
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gdp_adjustment" className="text-footnote">
                          GDP Adjustment
                        </SelectItem>
                        <SelectItem value="population_adjustment" className="text-footnote">
                          Pop Adjustment
                        </SelectItem>
                        <SelectItem value="growth_rate_modifier" className="text-footnote">
                          Growth Rate Mult
                        </SelectItem>
                        <SelectItem value="natural_disaster" className="text-footnote">
                          Natural Disaster (Direct)
                        </SelectItem>
                        <SelectItem value="trade_agreement" className="text-footnote">
                          Trade Agreement (Direct)
                        </SelectItem>
                        <SelectItem value="special_event" className="text-footnote">
                          Special Event (Direct)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-label-secondary text-footnote">Value (%)</Label>
                    <Input
                      type="number"
                      value={newEffectValue}
                      onChange={(e) => setNewEffectValue(e.target.value)}
                      className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                      step="0.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-label-secondary text-footnote">Description / Label</Label>
                  <Input
                    placeholder="e.g. Technology Boom"
                    value={newEffectDesc}
                    onChange={(e) => setNewEffectDesc(e.target.value)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  />
                </div>

                <Button type="submit" size="sm" className="w-full">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Sandbox Event
                </Button>
              </form>

              {mockEffects.length > 0 && (
                <div className="border-separator max-h-[140px] space-y-2 overflow-y-auto border-t pt-3 pr-1">
                  <div className="text-eyebrow text-indigo">Added Mock Effects</div>
                  {mockEffects.map((eff) => (
                    <div
                      key={eff.id}
                      className="rounded-control-sm border-indigo/20 bg-indigo/5 text-footnote flex items-center justify-between border p-2"
                    >
                      <div className="max-w-[160px] truncate">
                        <div className="truncate font-semibold">{eff.description}</div>
                        <div className="text-footnote text-indigo">
                          {eff.type.replace("_", " ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-indigo font-semibold tabular-nums">
                          {eff.value >= 0 ? "+" : ""}
                          {(eff.value * 100).toFixed(1)}%
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveMockEffect(eff.id)}
                          aria-label="Remove effect"
                          className="text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
            <div className="border-separator bg-surface rounded-row border p-5">
              {renderNodeDetails()}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-separator rounded-row border border-dashed py-24 text-center">
          <Calculator className="text-label-secondary mx-auto mb-3 h-10 w-10 opacity-60" />
          <h4 className="text-label text-headline">No Country Loaded</h4>
          <p className="text-label-secondary text-footnote mt-1">
            Search and select a country from the dropdown to start inspecting calculations.
          </p>
        </div>
      )}
    </div>
  );
}
