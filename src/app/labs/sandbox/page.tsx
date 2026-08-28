"use client";

import React, { useState, useTransition } from "react";
import { FacetContainer } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import {
  Trophy,
  Lock,
  CheckCircle as CheckCircle2,
  XmarkCircle as XCircle,
  HelpCircle,
  Play,
  SystemRestart as Loader2,
  ControlSlider as Sliders,
  Database,
  Component as Layers,
  Code as Code2,
  NavArrowRight as ChevronRight,
  WarningCircle as AlertCircle,
  Suitcase as Briefcase,
  Palette,
  Copy,
  Send,
  OpenBook as BookOpen,
  ArrowSeparateVertical as ArrowUpDown,
  ShieldAlert,
  Folder as FolderTree,
  LightBulb as Lightbulb,
  Check,
  Expand as Maximize2,
  Compress as Minimize2,
  Undo as RotateCcw,
} from "iconoir-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { LabControlPanel } from "~/app/admin/facet-materials-lab/_components/LabControlPanel";
import { LabSandbox } from "~/app/admin/facet-materials-lab/_components/LabSandbox";
import { SnippetExporter } from "~/app/admin/facet-materials-lab/_components/SnippetExporter";
import { type LabConfig } from "~/app/admin/facet-materials-lab/_components/types";

const DEFAULT_FACET_LAB_CONFIG: LabConfig = {
  template: "facet-card",
  material: "glass",
  texture: "scatteredDots",
  textureOpacity: 0.02,
  depth: 2,
  variant: "base",
  interactivity: "interactive",
  lightInteraction: true,
  simulatedTheme: "dark",
  customAccent: "#38bdf8",
  fullscreen: false,
  blurStrength: 16,
  saturationBoost: 180,
  glowIntensity: 50,
  refractionEnabled: true,
  bgStyle: "refraction",
  bgCustomColor: "#000000",
  patternScale: 100,
  dofStrength: 0,
};

// Import Kistan's CS Intro Level Files
import * as Level1 from "./challenges/level1_variables";
import * as Level2 from "./challenges/level2_conditionals";
import * as Level3 from "./challenges/level3_arrays";
import * as Level4 from "./challenges/level4_objects";
import * as Level5 from "./challenges/level5_async";
import * as Level6 from "./challenges/level6_tailwind";

export default function SandboxPage() {
  // Top-level Navigation Tabs (Merged Facet Lab into Tailwind & Facet Studio)
  const [activeTab, setActiveTab] = useState<
    "sim" | "trpc" | "mutation" | "tailwind" | "cheatsheet" | "quiz"
  >("sim");

  // Sub-tabs inside Quiz mode
  const [activeLevel, setActiveLevel] = useState<
    "lvl1" | "lvl2" | "lvl3" | "lvl4" | "lvl5" | "lvl6"
  >("lvl1");

  // ==========================================
  // TAB 1: SIMULATION STATE
  // ==========================================
  const [taxRate, setTaxRate] = useState(25);
  const [defenseSpending, setDefenseSpending] = useState(40);
  const [educationSpending, setEducationSpending] = useState(30);

  const calculatedStability = Math.max(
    0,
    Math.min(100, Math.round(75 - taxRate * 0.6 + defenseSpending * 0.3 + educationSpending * 0.5))
  );

  // ==========================================
  // TAB 2: tRPC QUERY STATE
  // ==========================================
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = api.users.getCurrentUserWithRole.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ==========================================
  // TAB 3: tRPC MUTATION SANDBOX STATE
  // ==========================================
  const [policyTitle, setPolicyTitle] = useState("Economic Development Act");
  const [policyPriority, setPolicyPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationResponse, setMutationResponse] = useState<any>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleSimulateMutation = () => {
    setMutationError(null);
    setMutationResponse(null);

    // Zod validation simulation
    if (policyTitle.trim().length < 3) {
      setMutationError("ZodValidationError: Policy title must be at least 3 characters long.");
      return;
    }

    setMutationPending(true);
    setTimeout(() => {
      setMutationPending(false);
      setMutationResponse({
        success: true,
        mutationId: `mut_${Math.random().toString(36).substring(2, 9)}`,
        status: "APPROVED_AND_EXECUTED",
        timestamp: new Date().toISOString(),
        payload: {
          title: policyTitle,
          priority: policyPriority,
          executor: "Kistan (Admin)",
        },
      });
    }, 600);
  };

  // ==========================================
  // TAB 4: CHEAT SHEET COPY FEEDBACK STATE
  // ==========================================
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyToClipboard = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  // ==========================================
  // TAB 6: 5-LEVEL CS INTRO QUIZ VALIDATION
  // ==========================================
  // Level 1: Variables & Data Types
  const [lvl1Name, setLvl1Name] = useState("Faneria");
  const [lvl1Pop, setLvl1Pop] = useState(40);
  const l1Exported = typeof Level1.formatNationHeader === "function";
  const l1TestOutput = l1Exported ? Level1.formatNationHeader("Faneria", 40) : "";
  const l1Passed = l1Exported && l1TestOutput.trim() === "Nation: Faneria | Population: 40M";
  const l1LiveHeader = l1Exported ? Level1.formatNationHeader(lvl1Name, lvl1Pop) : "";

  // Level 2: Conditionals & Control Flow
  const [lvl2Gdp, setLvl2Gdp] = useState(45000);
  const l2Exported = typeof Level2.getEconomicTier === "function";
  const l2TestAdv = l2Exported && Level2.getEconomicTier(50000) === "Advanced";
  const l2TestDev = l2Exported && Level2.getEconomicTier(25000) === "Developing";
  const l2TestEmerg = l2Exported && Level2.getEconomicTier(10000) === "Emerging";
  const l2Passed = l2Exported && l2TestAdv && l2TestDev && l2TestEmerg;
  const l2LiveTier = l2Exported ? Level2.getEconomicTier(lvl2Gdp) : "";

  // Level 3: Array Masterclass (.filter, .map, .find, total sum, .sort, .some/.every, grouping)
  const [lvl3Alliance, setLvl3Alliance] = useState("Concord");
  const [lvl3MinStab, setLvl3MinStab] = useState(80);
  // oxlint-disable-next-line eslint/no-unused-vars
  const [lvl3SearchSlug, setLvl3SearchSlug] = useState("faneria");
  const [lvl3SortDirection, setLvl3SortDirection] = useState<"asc" | "desc">("desc");

  const l3ArrayExported = Array.isArray(Level3.allNations) && Level3.allNations.length >= 3;

  // 3A: .filter()
  const l3FilterExported = typeof Level3.filterAllianceNations === "function";
  const rawL3Filtered =
    l3FilterExported && l3ArrayExported
      ? Level3.filterAllianceNations(Level3.allNations, lvl3Alliance, lvl3MinStab)
      : [];
  const l3FilteredNations = Array.isArray(rawL3Filtered) ? rawL3Filtered : [];
  const l3FilterPassed =
    l3FilterExported &&
    l3ArrayExported &&
    Level3.filterAllianceNations(Level3.allNations, "Concord", 80).length >= 2;

  // 3B: .map()
  const l3MapExported = typeof Level3.formatNationSummaries === "function";
  const rawL3Summaries =
    l3MapExported && l3ArrayExported ? Level3.formatNationSummaries(Level3.allNations) : [];
  const l3Summaries = Array.isArray(rawL3Summaries) ? rawL3Summaries : [];
  const l3MapPassed =
    l3MapExported &&
    l3ArrayExported &&
    l3Summaries.length >= 3 &&
    typeof l3Summaries[0] === "string" &&
    l3Summaries[0].includes("GDP");

  // 3C: .find()
  const l3FindExported = typeof Level3.findNationBySlug === "function";
  // oxlint-disable-next-line eslint/no-unused-vars
  const l3FoundNation =
    l3FindExported && l3ArrayExported
      ? Level3.findNationBySlug(Level3.allNations, lvl3SearchSlug)
      : null;
  const l3FindPassed =
    l3FindExported &&
    l3ArrayExported &&
    Level3.findNationBySlug(Level3.allNations, "faneria")?.name === "Faneria";

  // 3D: Total Sum Aggregation
  const l3SumExported = typeof Level3.calculateTotalGdp === "function";
  const l3TotalGdp =
    l3SumExported && l3ArrayExported ? Level3.calculateTotalGdp(Level3.allNations) : 0;
  const l3SumPassed = l3SumExported && l3ArrayExported && l3TotalGdp >= 1000;

  // 3E: .sort()
  const l3SortExported = typeof Level3.sortNationsByGdp === "function";
  const rawL3Sorted =
    l3SortExported && l3ArrayExported
      ? Level3.sortNationsByGdp(Level3.allNations, lvl3SortDirection)
      : [];
  const l3SortedNations = Array.isArray(rawL3Sorted) ? rawL3Sorted : [];
  const l3SortPassed =
    l3SortExported &&
    l3ArrayExported &&
    Level3.sortNationsByGdp(Level3.allNations, "desc")[0]?.name === "Caphiria";

  // 3F: .some() & .every()
  const l3SecExported = typeof Level3.checkAllianceSecurity === "function";
  const l3SecStatus =
    l3SecExported && l3ArrayExported
      ? Level3.checkAllianceSecurity(Level3.allNations, 70)
      : { allStable: false, anyCritical: false };
  const l3SecPassed =
    l3SecExported &&
    l3ArrayExported &&
    Level3.checkAllianceSecurity(Level3.allNations, 70).anyCritical === true;

  // 3G: Grouping
  const l3GroupExported = typeof Level3.groupNationsByAlliance === "function";
  const l3GroupedNations =
    l3GroupExported && l3ArrayExported ? Level3.groupNationsByAlliance(Level3.allNations) : {};
  const l3GroupPassed =
    l3GroupExported &&
    l3ArrayExported &&
    !!l3GroupedNations["Concord"] &&
    l3GroupedNations["Concord"].length >= 2;

  const l3Passed =
    l3ArrayExported &&
    l3FilterPassed &&
    l3MapPassed &&
    l3FindPassed &&
    l3SumPassed &&
    l3SortPassed &&
    l3SecPassed &&
    l3GroupPassed;

  // Level 4: Objects & Methods ('this')
  const [lvl4Reserves, setLvl4Reserves] = useState(1000);
  const l4ObjectExported =
    !!Level4.NationTreasuryVault && typeof Level4.NationTreasuryVault === "object";
  const l4MethodExported =
    l4ObjectExported && typeof Level4.NationTreasuryVault.allocateBudget === "function";
  const handleL4Allocate = (amount: number) => {
    if (l4MethodExported) {
      Level4.NationTreasuryVault.allocateBudget(amount);
      setLvl4Reserves(Level4.NationTreasuryVault.reserves);
    }
  };
  const l4Passed = l4MethodExported && lvl4Reserves !== 1000;
  const l4StatusString =
    l4ObjectExported && typeof Level4.NationTreasuryVault.getVaultStatus === "function"
      ? Level4.NationTreasuryVault.getVaultStatus()
      : "";

  // Level 5: Functions, Promises & Async/Await
  const [lvl5Result, setLvl5Result] = useState<Level5.IntelReport | null>(null);
  const [lvl5Loading, setLvl5Loading] = useState(false);
  const [, startLvl5Transition] = useTransition();
  const l5FunctionExported = typeof Level5.fetchNationIntelReport === "function";

  const handleLvl5RunIntel = () => {
    if (!l5FunctionExported) return;
    setLvl5Loading(true);
    startLvl5Transition(async () => {
      try {
        const res = await Level5.fetchNationIntelReport("faneria");
        setLvl5Result(res);
      } catch (e) {
        console.error("Level 5 error:", e);
      } finally {
        setLvl5Loading(false);
      }
    });
  };
  const l5Passed = l5FunctionExported && !!lvl5Result && lvl5Result.intelScore > 0;

  // Level 6: Tailwind CSS & UI Components
  const l6BadgeExported = typeof Level6.getDirectiveBadgeClasses === "function";
  const l6BadgePassed =
    l6BadgeExported &&
    Level6.getDirectiveBadgeClasses("ACTIVE").includes("emerald") &&
    Level6.getDirectiveBadgeClasses("PENDING").includes("amber") &&
    Level6.getDirectiveBadgeClasses("CRITICAL").includes("rose");

  const l6ButtonExported = typeof Level6.getTactileButtonClasses === "function";
  const l6ButtonPassed =
    l6ButtonExported &&
    Level6.getTactileButtonClasses("primary").includes("scale-[0.98]") &&
    Level6.getTactileButtonClasses("primary").includes("bg-primary");

  const l6GridExported = typeof Level6.buildResponsiveGridClasses === "function";
  const l6GridPassed =
    l6GridExported &&
    Level6.buildResponsiveGridClasses(3).includes("lg:grid-cols-3") &&
    Level6.buildResponsiveGridClasses(2).includes("sm:grid-cols-2");

  const l6CardExported = typeof Level6.formatMetricCardClasses === "function";
  const l6CardPassed =
    l6CardExported &&
    Level6.formatMetricCardClasses(true).includes("emerald") &&
    Level6.formatMetricCardClasses(false, "test-override").includes("test-override");

  const l6Passed = l6BadgePassed && l6ButtonPassed && l6GridPassed && l6CardPassed;

  // Level Progression & Locks
  const completedCount =
    (l1Passed ? 1 : 0) +
    (l2Passed ? 1 : 0) +
    (l3Passed ? 1 : 0) +
    (l4Passed ? 1 : 0) +
    (l5Passed ? 1 : 0) +
    (l6Passed ? 1 : 0);
  const progressPercent = (completedCount / 6) * 100;
  const l2Unlocked = l1Passed;
  const l3Unlocked = l1Passed && l2Passed;
  const l4Unlocked = l1Passed && l2Passed && l3Passed;
  const l5Unlocked = l1Passed && l2Passed && l3Passed && l4Passed;
  const l6Unlocked = true; // Always unlocked for direct crash course access
  const [showHint, setShowHint] = useState(false);

  // Level 6 Interactive Test State
  const [l6ShowHint, setL6ShowHint] = useState(false);
  const [l6TestStatus, setL6TestStatus] = useState<Level6.DirectiveStatus>("ACTIVE");
  const [l6TestVariant, setL6TestVariant] = useState<Level6.ButtonVariant>("primary");
  const [l6TestCols, setL6TestCols] = useState<2 | 3 | 4>(3);
  const [l6TestIsPositive, setL6TestIsPositive] = useState(true);
  const [l6TestCustomClass, setL6TestCustomClass] = useState("shadow-lg ring-1 ring-primary/40");

  // ==========================================
  // TAB 4: TAILWIND & FACET DESIGN STUDIO STATE
  // ==========================================
  // Dual-Engine Mode Switcher
  const [twStudioMode, setTwStudioMode] = useState<"tailwind" | "facet">("tailwind");

  // --- Facet Materials & Physics Lab State ---
  const [facetLabConfig, setFacetLabConfig] = useState<LabConfig>(DEFAULT_FACET_LAB_CONFIG);

  const handleFacetLabConfigChange = React.useCallback((updates: Partial<LabConfig>) => {
    setFacetLabConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleFacetLabReset = React.useCallback(() => {
    setFacetLabConfig({ ...DEFAULT_FACET_LAB_CONFIG, simulatedTheme: facetLabConfig.simulatedTheme });
  }, [facetLabConfig.simulatedTheme]);

  // Generate dynamic Facet CSS class lists
  const facetLabGeneratedClassNames = React.useMemo(() => {
    const classes = ["facet-material", `facet-material-${facetLabConfig.material}`];
    classes.push(`facet-depth-${facetLabConfig.depth}`);

    if (facetLabConfig.variant !== "base") {
      classes.push(`facet-${facetLabConfig.variant}`);
    }

    if (facetLabConfig.interactivity === "interactive") {
      classes.push("facet-interactive");
    } else if (facetLabConfig.interactivity === "hierarchy-interactive") {
      classes.push("facet-hierarchy-interactive");
    } else if (facetLabConfig.interactivity === "magnetic-3d") {
      classes.push("facet-magnetic-3d");
    } else if (facetLabConfig.interactivity === "glow-accent") {
      classes.push("facet-glow-accent");
    }

    if (facetLabConfig.refractionEnabled) {
      classes.push("facet-refraction");
    }

    return classes.join(" ");
  }, [
    facetLabConfig.material,
    facetLabConfig.depth,
    facetLabConfig.variant,
    facetLabConfig.interactivity,
    facetLabConfig.refractionEnabled,
  ]);

  // Custom CSS variables for material effects
  const facetLabCustomVars = React.useMemo(() => {
    return {
      "--facet-lab-accent": facetLabConfig.customAccent,
      "--facet-lab-blur": `${facetLabConfig.blurStrength}px`,
      "--facet-lab-saturate": `${facetLabConfig.saturationBoost}%`,
      "--facet-lab-glow": `${facetLabConfig.glowIntensity / 100}`,
      "--facet-lab-pattern-scale": `${facetLabConfig.patternScale}%`,
      "--facet-lab-bg": facetLabConfig.bgCustomColor,
      "--facet-dof": `${facetLabConfig.dofStrength}`,
    } as React.CSSProperties;
  }, [
    facetLabConfig.blurStrength,
    facetLabConfig.saturationBoost,
    facetLabConfig.glowIntensity,
    facetLabConfig.patternScale,
    facetLabConfig.bgCustomColor,
    facetLabConfig.customAccent,
    facetLabConfig.dofStrength,
  ]);

  // --- Tailwind Component Studio State ---
  const [twPreset, setTwPreset] = useState<
    "mycountry" | "wikios" | "facet" | "forum" | "thinkpages" | "vault"
  >("mycountry");
  const [twPadding, setTwPadding] = useState("p-6");
  const [twRadius, setTwRadius] = useState("rounded-2xl");
  const [twBackground, setTwBackground] = useState("bg-card/80 backdrop-blur-xl");
  const [twBorder, setTwBorder] = useState("border-amber-500/40");
  const [twScale, setTwScale] = useState("active:scale-[0.98]");
  const [twDuration, setTwDuration] = useState("duration-150");
  const [twCardStatus, setTwCardStatus] = useState<"ACTIVE" | "PENDING" | "CRITICAL">("ACTIVE");
  const [twButtonVariant, setTwButtonVariant] = useState<"primary" | "secondary" | "destructive">("primary");
  const [twViewportMode, setTwViewportMode] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [twShowBoxModel, setTwShowBoxModel] = useState(true);
  const [twCopiedCode, setTwCopiedCode] = useState(false);

  // Tool 1: Zero-Hex & Semantic Token Linter State
  const [twValidatorInput, setTwValidatorInput] = useState(
    "bg-[#12141c] text-[#ffffff] p-4 border border-[#f59e0b] rounded-xl"
  );

  // Tool 2: cn() Conflict & Resolution Inspector State
  const [twCnBase, setTwCnBase] = useState("p-4 bg-card text-foreground rounded-lg border border-border/40");
  const [twCnOverride, setTwCnOverride] = useState("p-8 bg-amber-500 text-slate-950 rounded-2xl");

  // Tool 4: State Variants Simulator
  const [twStateVariant, setTwStateVariant] = useState<"default" | "hover" | "focus" | "disabled">("default");

  // Tool 5: Layout Engine Switcher (Flex vs Grid)
  const [twLayoutFlow, setTwLayoutFlow] = useState<"flex-row" | "flex-col" | "grid-2" | "grid-3">("flex-row");

  // Active Tool Panel Sub-tab in Studio
  const [twStudioSubTool, setTwStudioSubTool] = useState<
    "inspector" | "linter" | "merge" | "flow"
  >("inspector");

  const applyPreset = (preset: "mycountry" | "wikios" | "facet" | "forum" | "thinkpages" | "vault") => {
    setTwPreset(preset);
    if (preset === "mycountry") {
      setTwPadding("p-6");
      setTwRadius("rounded-2xl");
      setTwBackground("bg-card/80 backdrop-blur-xl");
      setTwBorder("border-amber-500/40");
      setTwScale("active:scale-[0.98]");
      setTwDuration("duration-150");
    } else if (preset === "wikios") {
      setTwPadding("p-6");
      setTwRadius("rounded-xl");
      setTwBackground("bg-card");
      setTwBorder("border-border/80");
      setTwScale("active:scale-[0.99]");
      setTwDuration("duration-150");
    } else if (preset === "facet") {
      setTwPadding("p-7");
      setTwRadius("rounded-3xl");
      setTwBackground("bg-card/40 backdrop-blur-2xl");
      setTwBorder("border-white/20");
      setTwScale("active:scale-[0.98]");
      setTwDuration("duration-150");
    } else if (preset === "forum") {
      setTwPadding("p-5");
      setTwRadius("rounded-xl");
      setTwBackground("bg-card");
      setTwBorder("border-orange-500/40");
      setTwScale("active:scale-[0.98]");
      setTwDuration("duration-100");
    } else if (preset === "thinkpages") {
      setTwPadding("p-5");
      setTwRadius("rounded-2xl");
      setTwBackground("bg-accent/40");
      setTwBorder("border-emerald-500/40");
      setTwScale("active:scale-[0.98]");
      setTwDuration("duration-150");
    } else if (preset === "vault") {
      setTwPadding("p-6");
      setTwRadius("rounded-3xl");
      setTwBackground("bg-primary/10");
      setTwBorder("border-amber-500/60");
      setTwScale("active:scale-[0.95]");
      setTwDuration("duration-300");
    }
  };

  // Helper to validate input classes for raw arbitrary hexes
  const validateClasses = (input: string) => {
    const tokens = input.split(/\s+/).filter(Boolean);
    const issues: Array<{ token: string; hex: string; suggestion: string }> = [];

    tokens.forEach((t) => {
      const hexMatch = t.match(/#([0-9a-fA-F]{3,8})/);
      if (hexMatch) {
        const hex = hexMatch[1].toLowerCase();
        let suggestion = "bg-card or text-foreground";
        if (hex.startsWith("12141c") || hex.startsWith("0f172a") || hex.startsWith("000") || hex.startsWith("111")) {
          suggestion = "bg-card or bg-background";
        } else if (hex.startsWith("fff")) {
          suggestion = "text-foreground or bg-card";
        } else if (hex.startsWith("64748b") || hex.startsWith("94a3b8") || hex.startsWith("888")) {
          suggestion = "text-muted-foreground";
        } else if (hex.startsWith("f59e0b") || hex.startsWith("d97706") || hex.startsWith("eab308")) {
          suggestion = "text-amber-400 or border-amber-500/40";
        } else if (hex.startsWith("10b981") || hex.startsWith("059669")) {
          suggestion = "text-emerald-400 or border-emerald-500/40";
        } else if (hex.startsWith("ef4444") || hex.startsWith("f43f5e")) {
          suggestion = "text-rose-400 or border-rose-500/40";
        } else if (hex.startsWith("3b82f6") || hex.startsWith("0284c7")) {
          suggestion = "text-blue-400 or border-blue-500/40";
        }
        issues.push({ token: t, hex: `#${hex}`, suggestion });
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
    };
  };

  // Helper to compute live cn() diff between base and override
  const computeCnDiff = () => {
    const rawClsx = clsx(twCnBase, twCnOverride);
    const merged = twMerge(rawClsx);
    const baseTokens = twCnBase.split(/\s+/).filter(Boolean);
    const overrideTokens = twCnOverride.split(/\s+/).filter(Boolean);
    const mergedTokens = merged.split(/\s+/).filter(Boolean);

    const droppedBaseTokens = baseTokens.filter((t) => !mergedTokens.includes(t));
    const activeOverrideTokens = overrideTokens.filter((t) => mergedTokens.includes(t));
    const keptBaseTokens = baseTokens.filter((t) => mergedTokens.includes(t));

    return {
      rawClsx,
      merged,
      droppedBaseTokens,
      activeOverrideTokens,
      keptBaseTokens,
    };
  };

  const stateVariantClass =
    twStateVariant === "hover"
      ? "ring-2 ring-primary/40 shadow-2xl scale-[1.01]"
      : twStateVariant === "focus"
      ? "ring-2 ring-primary ring-offset-2 ring-offset-background outline-none"
      : twStateVariant === "disabled"
      ? "opacity-50 pointer-events-none cursor-not-allowed grayscale-[40%]"
      : "";

  const compiledClassString = `mx-auto w-full transition-all cursor-pointer shadow-xl ${twPadding} ${twRadius} ${twBackground} border ${twBorder} ${twScale} ${twDuration} ${stateVariantClass}`.trim();

  return (
    <div className="bg-background text-foreground relative min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block */}
        <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight">Labs Sandbox</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Testing ground for simulation logic, tRPC endpoints, UI components, and quizzes.
            </p>
          </div>
          <div className="bg-card border-border/60 text-muted-foreground flex items-center gap-2 self-start rounded-full border px-3.5 py-1.5 text-xs shadow-sm md:self-auto">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Sandbox Active
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="bg-card border-border/60 flex max-w-4xl flex-wrap gap-2 rounded-2xl border p-1.5 shadow-sm">
          <button
            onClick={() => setActiveTab("sim")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "sim"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Simulation
          </button>
          <button
            onClick={() => setActiveTab("trpc")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "trpc"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Database className="h-4 w-4" />
            tRPC Query
          </button>
          <button
            onClick={() => setActiveTab("mutation")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "mutation"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Send className="h-4 w-4" />
            tRPC Mutation
          </button>
          <button
            onClick={() => setActiveTab("tailwind")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
              activeTab === "tailwind"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Layers className="h-4 w-4" />
            UI & Facet Studio
          </button>
          <button
            onClick={() => setActiveTab("cheatsheet")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "cheatsheet"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Cheat Sheet
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "quiz"
                ? "bg-amber-600 text-white shadow-md"
                : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
            }`}
          >
            <Trophy className="h-4 w-4" />
            IDE Quizzes
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="mt-4">
          {/* TAB 1: SIMULATION */}
          {activeTab === "sim" && (
            <div className="grid gap-6 md:grid-cols-3">
              <FacetContainer
                variant="builder"
                depth={2}
                className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6 md:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground text-xl font-semibold">Simulation Controls</h2>
                  <span className="text-muted-foreground font-mono text-xs">
                    Client State Hooks
                  </span>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Income Tax Rate</span>
                      <span className="text-primary font-bold">{taxRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="bg-accent/40 accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Defense Allocation</span>
                      <span className="text-primary font-bold">{defenseSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={defenseSpending}
                      onChange={(e) => setDefenseSpending(Number(e.target.value))}
                      className="bg-accent/40 accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Education & Infrastructure</span>
                      <span className="text-primary font-bold">{educationSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={educationSpending}
                      onChange={(e) => setEducationSpending(Number(e.target.value))}
                      className="bg-accent/40 accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-lg"
                    />
                  </div>
                </div>
              </FacetContainer>

              <FacetContainer
                variant="overview"
                depth={3}
                className="bg-card/80 border-border/80 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 text-center backdrop-blur-xl"
              >
                <div className="space-y-3">
                  <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                    Stability Index
                  </h3>
                  <div className="text-foreground py-4 text-6xl font-black transition-all duration-300">
                    {calculatedStability}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Simulated index calculated reactively on local state changes.
                  </p>
                </div>
                <div className="border-border/40 text-muted-foreground mt-6 space-y-1.5 border-t pt-4 text-left text-xs">
                  <div>• High taxes reduce citizen approval.</div>
                  <div>• Defense boost buffers instability.</div>
                  <div>• Education investment yields long-term stability.</div>
                </div>
              </FacetContainer>
            </div>
          )}

          {/* TAB 2: tRPC QUERY */}
          {activeTab === "trpc" && (
            <FacetContainer
              variant="economy"
              depth={2}
              className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-foreground text-xl font-semibold">tRPC Database Hook Check</h2>
                <div className="text-muted-foreground font-mono text-xs">
                  api.users.getCurrentUserWithRole
                </div>
              </div>

              {profileLoading ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                  <span className="text-muted-foreground text-sm">
                    Querying database over tRPC pipeline...
                  </span>
                </div>
              ) : profileError ? (
                <div className="bg-destructive/10 border-destructive/30 text-destructive flex items-start gap-3 rounded-xl border p-4 text-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-bold">Failed to load profile data.</span>
                    <p className="text-muted-foreground mt-1 text-xs">{profileError.message}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-500">
                    ✅ Success: Database response received cleanly via tRPC.
                  </div>
                  <div className="bg-background border-border/60 overflow-x-auto rounded-xl border p-4">
                    <pre className="text-primary font-mono text-xs">
                      {JSON.stringify(profileData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </FacetContainer>
          )}

          {/* TAB 3: tRPC MUTATION SANDBOX */}
          {activeTab === "mutation" && (
            <FacetContainer
              variant="builder"
              depth={2}
              className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6"
            >
              <div className="border-border/40 flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                    <Send className="text-primary h-5 w-5" />
                    tRPC Mutation & Form State Lab
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Demonstrates <code className="text-primary font-mono">useMutation()</code>,
                    loading states, Zod validation, and backend response payloads.
                  </p>
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  api.policy.create.useMutation
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Form Input Side */}
                <div className="bg-background/50 border-border/40 space-y-4 rounded-xl border p-5">
                  <h3 className="text-foreground text-sm font-semibold">1. Form Inputs</h3>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs">Policy Title</label>
                    <input
                      type="text"
                      value={policyTitle}
                      onChange={(e) => setPolicyTitle(e.target.value)}
                      className="bg-card border-border/60 text-foreground focus:ring-primary w-full rounded-lg border px-3 py-2 text-xs"
                      placeholder="Enter policy title..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs">Priority Tier</label>
                    <select
                      value={policyPriority}
                      onChange={(e) => setPolicyPriority(e.target.value as any)}
                      className="bg-card border-border/60 text-foreground w-full rounded-lg border px-3 py-2 text-xs"
                    >
                      <option value="HIGH">HIGH (Executive Priority)</option>
                      <option value="MEDIUM">MEDIUM (Standard Cabinet)</option>
                      <option value="LOW">LOW (Advisory Routine)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSimulateMutation}
                    disabled={mutationPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {mutationPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit tRPC Mutation
                  </button>

                  {mutationError && (
                    <div className="bg-destructive/10 border-destructive/30 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{mutationError}</span>
                    </div>
                  )}
                </div>

                {/* Response / Cache View Side */}
                <div className="bg-background/50 border-border/40 flex flex-col justify-between space-y-4 rounded-xl border p-5">
                  <div>
                    <h3 className="text-foreground mb-3 text-sm font-semibold">
                      2. Backend Mutation Response
                    </h3>

                    {mutationPending ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-12">
                        <Loader2 className="text-primary h-8 w-8 animate-spin" />
                        <span className="text-muted-foreground font-mono text-xs">
                          Executing server procedure...
                        </span>
                      </div>
                    ) : mutationResponse ? (
                      <div className="bg-background border-border/60 overflow-x-auto rounded-xl border p-4">
                        <pre className="font-mono text-xs text-emerald-400">
                          {JSON.stringify(mutationResponse, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-muted-foreground border-border/60 rounded-xl border border-dashed p-8 text-center text-xs">
                        Submit the form on the left to trigger the mutation response.
                      </div>
                    )}
                  </div>

                  {mutationResponse && (
                    <div className="text-muted-foreground bg-card border-border/60 flex items-center justify-between rounded-lg border p-2.5 font-mono text-[11px]">
                      <span>Cache Status: Invalidated & Refetched</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            </FacetContainer>
          )}

          {/* TAB 4: UI & FACET DESIGN STUDIO (UNIFIED WORKBENCH) */}
          {activeTab === "tailwind" && (
            <div className="space-y-6">
              <FacetContainer
                variant="builder"
                depth={2}
                className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6 shadow-sm"
              >
                {/* Studio Master Header with Dual-Engine Switcher */}
                <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Layers className="h-4 w-4" />
                      </span>
                      <h2 className="text-foreground text-xl font-bold tracking-tight">
                        UI & Facet Design Studio
                      </h2>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Comprehensive design workbench for Tailwind v4 tokens, tactile physics, CSS box model, and Facet optical materials.
                    </p>
                  </div>

                  {/* Dual-Engine Mode Switcher Tabs */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 p-1">
                    <button
                      onClick={() => setTwStudioMode("tailwind")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                        twStudioMode === "tailwind"
                          ? "bg-primary text-primary-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Tailwind Components
                    </button>
                    <button
                      onClick={() => setTwStudioMode("facet")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                        twStudioMode === "facet"
                          ? "bg-primary text-primary-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Palette className="h-3.5 w-3.5" />
                      Facet Materials & Physics Lab
                    </button>
                  </div>
                </div>

                {/* ENGINE 1: TAILWIND COMPONENT STUDIO */}
                {twStudioMode === "tailwind" && (
                  <div className="space-y-6">
                    {/* Preset Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background/50 p-1.5">
                      <span className="px-2 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                        Domain Presets:
                      </span>
                      <button
                        onClick={() => applyPreset("mycountry")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "mycountry"
                            ? "border-amber-500 bg-amber-500 text-slate-950 shadow-sm font-bold"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        MyCountry
                      </button>
                      <button
                        onClick={() => applyPreset("wikios")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "wikios"
                            ? "border-slate-300 bg-foreground text-background shadow-sm font-bold"
                            : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        WikiOS
                      </button>
                      <button
                        onClick={() => applyPreset("facet")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "facet"
                            ? "border-primary bg-primary text-primary-foreground shadow-sm font-bold"
                            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        Facet Glass
                      </button>
                      <button
                        onClick={() => applyPreset("forum")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "forum"
                            ? "border-orange-500 bg-orange-500 text-white shadow-sm font-bold"
                            : "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                        }`}
                      >
                        IxForum
                      </button>
                      <button
                        onClick={() => applyPreset("thinkpages")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "thinkpages"
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm font-bold"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        ThinkPages
                      </button>
                      <button
                        onClick={() => applyPreset("vault")}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97] ${
                          twPreset === "vault"
                            ? "border-amber-600 bg-amber-600 text-white shadow-sm font-bold"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                        }`}
                      >
                        IxVault
                      </button>
                    </div>

                    {/* Master Studio Workspace (Split Grid) */}
                    <div className="grid gap-6 lg:grid-cols-12">
                      {/* LEFT COLUMN: Tools & Inspector (5 cols) */}
                      <div className="space-y-4 lg:col-span-5">
                        {/* Sub-tool navigation bar */}
                        <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/60 bg-background/50 p-1">
                          <button
                            onClick={() => setTwStudioSubTool("inspector")}
                            className={`rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                              twStudioSubTool === "inspector"
                                ? "bg-card text-foreground shadow-sm border border-border/80"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Inspector
                          </button>
                          <button
                            onClick={() => setTwStudioSubTool("linter")}
                            className={`rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                              twStudioSubTool === "linter"
                                ? "bg-card text-amber-400 shadow-sm border border-border/80 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Zero-Hex
                          </button>
                          <button
                            onClick={() => setTwStudioSubTool("merge")}
                            className={`rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                              twStudioSubTool === "merge"
                                ? "bg-card text-primary shadow-sm border border-border/80 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            cn() Merge
                          </button>
                          <button
                            onClick={() => setTwStudioSubTool("flow")}
                            className={`rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                              twStudioSubTool === "flow"
                                ? "bg-card text-emerald-400 shadow-sm border border-border/80 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Layout
                          </button>
                        </div>

                        {/* SUB-TOOL 1: PROPERTY INSPECTOR */}
                        {twStudioSubTool === "inspector" && (
                          <div className="space-y-3.5">
                            {/* 1. Box Padding Segment */}
                            <div className="space-y-2 rounded-xl border border-border/40 bg-background/50 p-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">1. Box Padding</span>
                                <code className="font-mono text-[11px] font-bold text-primary">{twPadding}</code>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {[
                                  { val: "p-2", label: "8px", desc: "Compact" },
                                  { val: "p-4", label: "16px", desc: "Standard" },
                                  { val: "p-6", label: "24px", desc: "Spacious" },
                                  { val: "p-8", label: "32px", desc: "Hero" },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    onClick={() => setTwPadding(item.val)}
                                    className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 transition-all active:scale-[0.97] ${
                                      twPadding === item.val
                                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                        : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                    }`}
                                  >
                                    <span className="text-xs font-bold">{item.label}</span>
                                    <span className="font-mono text-[9px] opacity-75">{item.val}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 2. Corner Radius Segment */}
                            <div className="space-y-2 rounded-xl border border-border/40 bg-background/50 p-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">2. Corner Radius</span>
                                <code className="font-mono text-[11px] font-bold text-primary">{twRadius}</code>
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {[
                                  { val: "rounded-none", label: "0px" },
                                  { val: "rounded-md", label: "6px" },
                                  { val: "rounded-xl", label: "12px" },
                                  { val: "rounded-2xl", label: "16px" },
                                  { val: "rounded-3xl", label: "24px" },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    onClick={() => setTwRadius(item.val)}
                                    className={`flex flex-col items-center justify-center rounded-lg border py-1.5 transition-all active:scale-[0.97] ${
                                      twRadius === item.val
                                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                        : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                    }`}
                                  >
                                    <span className="text-xs font-bold">{item.label}</span>
                                    <span className="font-mono text-[8px] opacity-75">{item.val.replace("rounded-", "")}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 3. Surface Material Token */}
                            <div className="space-y-2 rounded-xl border border-border/40 bg-background/50 p-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">3. Surface Material</span>
                                <span className="font-mono text-[10px] text-muted-foreground">Tailwind Token</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { val: "bg-card/80 backdrop-blur-xl", label: "Translucent Glass", sub: "backdrop-blur-xl" },
                                  { val: "bg-card", label: "Solid Card", sub: "bg-card" },
                                  { val: "bg-accent/40", label: "Subtle Surface", sub: "bg-accent/40" },
                                  { val: "bg-primary/10", label: "Primary Tint", sub: "bg-primary/10" },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    onClick={() => setTwBackground(item.val)}
                                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all active:scale-[0.97] ${
                                      twBackground === item.val
                                        ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary shadow-sm"
                                        : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                    }`}
                                  >
                                    <span className="text-xs font-semibold">{item.label}</span>
                                    <span className="font-mono text-[9px] text-muted-foreground mt-0.5">{item.sub}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 4. Semantic Border Accent */}
                            <div className="space-y-2 rounded-xl border border-border/40 bg-background/50 p-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">4. Border Accent</span>
                                <code className="font-mono text-[10px] text-muted-foreground">{twBorder}</code>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { val: "border-border/60", label: "Neutral", color: "bg-slate-400" },
                                  { val: "border-amber-500/40", label: "Gold", color: "bg-amber-500" },
                                  { val: "border-emerald-500/40", label: "Emerald", color: "bg-emerald-500" },
                                  { val: "border-rose-500/40", label: "Rose", color: "bg-rose-500" },
                                  { val: "border-blue-500/40", label: "Sky Blue", color: "bg-blue-500" },
                                  { val: "border-orange-500/40", label: "Orange", color: "bg-orange-500" },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    onClick={() => setTwBorder(item.val)}
                                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                                      twBorder === item.val
                                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                        : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                    }`}
                                  >
                                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                                    <span>{item.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 5. Tactile Physics & Easing */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/50 p-3">
                                <span className="text-[11px] font-semibold text-foreground">5. Press Scale</span>
                                <div className="space-y-1 pt-1">
                                  {[
                                    { val: "active:scale-[0.98]", label: "0.98 (Standard)" },
                                    { val: "active:scale-[0.95]", label: "0.95 (Deep)" },
                                    { val: "active:scale-100", label: "1.0 (None)" },
                                  ].map((item) => (
                                    <button
                                      key={item.val}
                                      onClick={() => setTwScale(item.val)}
                                      className={`w-full rounded-lg border px-2 py-1 text-left text-xs font-medium transition-all ${
                                        twScale === item.val
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                      }`}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/50 p-3">
                                <span className="text-[11px] font-semibold text-foreground">6. Transition Duration</span>
                                <div className="space-y-1 pt-1">
                                  {[
                                    { val: "duration-100", label: "100ms (Fast)" },
                                    { val: "duration-150", label: "150ms (Tactile)" },
                                    { val: "duration-300", label: "300ms (Smooth)" },
                                  ].map((item) => (
                                    <button
                                      key={item.val}
                                      onClick={() => setTwDuration(item.val)}
                                      className={`w-full rounded-lg border px-2 py-1 text-left text-xs font-medium transition-all ${
                                        twDuration === item.val
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                      }`}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SUB-TOOL 2: ZERO-HEX LINTER & VALIDATOR */}
                        {twStudioSubTool === "linter" && (
                          <div className="space-y-3.5 rounded-xl border border-border/40 bg-background/50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">Zero-Hex Semantic Linter</span>
                              <span className="font-mono text-[10px] text-muted-foreground">Rule Enforcer</span>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                              IxStates strictly blocks arbitrary color hexes in favor of semantic Tailwind v4 tokens so components adapt across dark and light themes.
                            </p>

                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-muted-foreground">
                                Test Class String:
                              </label>
                              <textarea
                                value={twValidatorInput}
                                onChange={(e) => setTwValidatorInput(e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-border/60 bg-card p-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                                placeholder="Type classes here, e.g. bg-[#12141c] text-[#ffffff]"
                              />
                            </div>

                            {/* Validation Result Box */}
                            {(() => {
                              const result = validateClasses(twValidatorInput);
                              if (result.isValid) {
                                return (
                                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-400">
                                    <Check className="h-4 w-4" />
                                    <span>Zero-Hex rule satisfied! All tokens are semantic.</span>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                                  <span className="text-xs font-bold text-amber-400">
                                    ⚠️ {result.issues.length} Raw Hex Violation(s) Found:
                                  </span>
                                  <div className="space-y-2">
                                    {result.issues.map((iss, idx) => (
                                      <div key={idx} className="rounded border border-amber-500/30 bg-background/80 p-2 text-xs">
                                        <div className="font-mono text-rose-400 font-bold">
                                          Forbidden: {iss.token} ({iss.hex})
                                        </div>
                                        <div className="mt-1 text-muted-foreground">
                                          Use instead: <code className="font-bold text-emerald-400 font-mono">{iss.suggestion}</code>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() =>
                                  setTwValidatorInput("bg-[#12141c] text-[#ffffff] border-[#f59e0b]")
                                }
                                className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                Load Bad Example
                              </button>
                              <button
                                onClick={() =>
                                  setTwValidatorInput("bg-card text-foreground border-border/60")
                                }
                                className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                Load Good Example
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SUB-TOOL 3: CN() CONFLICT & MERGE INSPECTOR */}
                        {twStudioSubTool === "merge" && (
                          <div className="space-y-3.5 rounded-xl border border-border/40 bg-background/50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">cn() Conflict Resolver</span>
                              <span className="font-mono text-[10px] text-primary">twMerge + clsx</span>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Demonstrates how <code className="font-mono text-primary font-bold">cn()</code> prevents specificity collisions by letting prop overrides take precedence over base classes.
                            </p>

                            <div className="space-y-2">
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  1. Component Base Classes:
                                </span>
                                <input
                                  type="text"
                                  value={twCnBase}
                                  onChange={(e) => setTwCnBase(e.target.value)}
                                  className="w-full rounded-lg border border-border/60 bg-card px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  2. Parent Prop Override Classes:
                                </span>
                                <input
                                  type="text"
                                  value={twCnOverride}
                                  onChange={(e) => setTwCnOverride(e.target.value)}
                                  className="w-full rounded-lg border border-border/60 bg-card px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Collision Analysis Diff */}
                            {(() => {
                              const diff = computeCnDiff();
                              return (
                                <div className="space-y-2.5 rounded-lg border border-border/60 bg-card p-3 font-mono text-xs">
                                  <div>
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold block mb-1">
                                      Conflict Analysis:
                                    </span>
                                    <div className="space-y-1.5 text-[11px]">
                                      {diff.droppedBaseTokens.length > 0 && (
                                        <div>
                                          <span className="text-rose-400 font-bold">Overridden & Dropped: </span>
                                          {diff.droppedBaseTokens.map((t, idx) => (
                                            <span key={idx} className="mr-1 inline-block rounded bg-rose-500/20 px-1 py-0.5 text-rose-300 line-through">
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-emerald-400 font-bold">Active Overrides: </span>
                                        {diff.activeOverrideTokens.map((t, idx) => (
                                          <span key={idx} className="mr-1 inline-block rounded bg-emerald-500/20 px-1 py-0.5 text-emerald-300">
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="border-t border-border/40 pt-2">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold block mb-1">
                                      Final Resolved Output:
                                    </span>
                                    <pre className="text-primary text-xs whitespace-pre-wrap break-all">
                                      className="{diff.merged}"
                                    </pre>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* SUB-TOOL 4: LAYOUT ENGINE SWITCHER */}
                        {twStudioSubTool === "flow" && (
                          <div className="space-y-3.5 rounded-xl border border-border/40 bg-background/50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">Layout Flow Engine</span>
                              <span className="font-mono text-[10px] text-emerald-400">Flexbox vs Grid</span>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Toggle between Flexbox and CSS Grid layout algorithms to see how card contents reflow.
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "flex-row", label: "Flex Row", desc: "flex justify-between items-center" },
                                { id: "flex-col", label: "Flex Col", desc: "flex flex-col items-stretch" },
                                { id: "grid-2", label: "Grid 2-Col", desc: "grid grid-cols-2 gap-3" },
                                { id: "grid-3", label: "Grid 3-Col", desc: "grid grid-cols-1 sm:grid-cols-3" },
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => setTwLayoutFlow(item.id as typeof twLayoutFlow)}
                                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                                    twLayoutFlow === item.id
                                      ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary shadow-sm"
                                      : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                  }`}
                                >
                                  <span className="text-xs font-bold">{item.label}</span>
                                  <span className="font-mono text-[9px] text-muted-foreground mt-0.5">{item.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RIGHT COLUMN: Studio Canvas Stage (7 cols) */}
                      <div className="space-y-4 lg:col-span-7">
                        {/* Canvas Stage Header with Breakpoint Indicator */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/50 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-muted-foreground">Viewport:</span>
                            <button
                              onClick={() => setTwViewportMode("mobile")}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                                twViewportMode === "mobile"
                                  ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              360px
                            </button>
                            <button
                              onClick={() => setTwViewportMode("tablet")}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                                twViewportMode === "tablet"
                                  ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              520px
                            </button>
                            <button
                              onClick={() => setTwViewportMode("desktop")}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                                twViewportMode === "desktop"
                                  ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Full Width
                            </button>

                            {/* Breakpoint HUD Pill */}
                            <span className="ml-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                              {twViewportMode === "mobile" && "Breakpoint: <640px (base)"}
                              {twViewportMode === "tablet" && "Breakpoint: ≥640px (sm:)"}
                              {twViewportMode === "desktop" && "Breakpoint: ≥1024px (lg:)"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setTwShowBoxModel(!twShowBoxModel)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                                twShowBoxModel
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Box Model HUD
                            </button>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(compiledClassString);
                                setTwCopiedCode(true);
                                setTimeout(() => setTwCopiedCode(false), 2000);
                              }}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold shadow-sm transition-all active:scale-[0.97]"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {twCopiedCode ? "Copied" : "Copy Classes"}
                            </button>
                          </div>
                        </div>

                        {/* State Variants Selector Bar */}
                        <div className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-background/50 p-2">
                          <span className="px-1 text-[11px] font-semibold text-muted-foreground">
                            Simulate State:
                          </span>
                          {[
                            { id: "default", label: "Default" },
                            { id: "hover", label: "Hover State" },
                            { id: "focus", label: "Focus State" },
                            { id: "disabled", label: "Disabled" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setTwStateVariant(item.id as typeof twStateVariant)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                                twStateVariant === item.id
                                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        {/* Interactive Canvas Board */}
                        <div className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background/80 p-6 md:p-8 shadow-inner">
                          {/* Ambient Backlight Glow */}
                          <div
                            className={`pointer-events-none absolute -inset-4 opacity-40 blur-3xl transition-all duration-500 ${
                              twBorder.includes("amber")
                                ? "bg-amber-500/20"
                                : twBorder.includes("emerald")
                                ? "bg-emerald-500/20"
                                : twBorder.includes("rose")
                                ? "bg-rose-500/20"
                                : twBorder.includes("blue")
                                ? "bg-blue-500/20"
                                : twBorder.includes("orange")
                                ? "bg-orange-500/20"
                                : "bg-primary/10"
                            }`}
                          />

                          {/* Viewport Frame Constraint */}
                          <div
                            className={`w-full transition-all duration-300 ${
                              twViewportMode === "mobile"
                                ? "max-w-[360px]"
                                : twViewportMode === "tablet"
                                ? "max-w-[520px]"
                                : "max-w-full"
                            }`}
                          >
                            {/* PRESET 1: MYCOUNTRY EXECUTIVE DIRECTIVE */}
                            {twPreset === "mycountry" && (
                              <div className={compiledClassString}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                      EXECUTIVE DIRECTIVE · STATECRAFT
                                    </span>
                                    <h4 className="text-base font-bold text-foreground">
                                      Agrarian Autarky & Infrastructure Modernization
                                    </h4>
                                  </div>
                                  <span
                                    className={
                                      l6BadgeExported
                                        ? Level6.getDirectiveBadgeClasses(twCardStatus)
                                        : "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400"
                                    }
                                  >
                                    {twCardStatus}
                                  </span>
                                </div>

                                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                  Rebalances +15.0 CivCap to agrarian modernization, raising stability to 88% and rural GDP throughput.
                                </p>

                                <div
                                  className={`mt-4 border-t border-border/40 pt-3.5 ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex flex-wrap items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2.5"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-3"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-amber-400">
                                      CivCap: +15.0
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">· 2 Cycles</span>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTwCardStatus(
                                        twCardStatus === "ACTIVE"
                                          ? "PENDING"
                                          : twCardStatus === "PENDING"
                                          ? "CRITICAL"
                                          : "ACTIVE"
                                      );
                                    }}
                                    className="bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150 shadow-sm"
                                  >
                                    Enact Directive ({twCardStatus})
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* PRESET 2: WIKIOS LORE ARTICLE & MARGIN SPECIMEN */}
                            {twPreset === "wikios" && (
                              <div className={compiledClassString}>
                                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      WIKIOS CANVAS · LORE
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="rounded bg-accent/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                                      Namespace: Main
                                    </span>
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                                      Verified
                                    </span>
                                  </div>
                                </div>

                                <h4 className="mt-3 text-lg font-extrabold tracking-tight text-foreground font-serif">
                                  The Great Concord Treaties of 1842
                                </h4>

                                <div className="my-3 border-l-2 border-primary/70 bg-accent/20 py-1.5 pl-3 text-xs italic text-muted-foreground">
                                  "The territorial boundaries established across the Odon Basin marked the start of regional trade synchronization."
                                </div>

                                <div
                                  className={`border-t border-border/40 pt-3 text-xs text-muted-foreground ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-2"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <span className="text-[11px]">Archivist: @Keaor · 1,420 words</span>
                                  <div className="flex gap-2">
                                    <button className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent/40 active:scale-[0.98]">
                                      Read in Margin
                                    </button>
                                    <button className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1 text-xs font-semibold hover:bg-primary/90 active:scale-[0.98]">
                                      Stash
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* PRESET 3: FACET VOLUMETRIC GLASS SPECIMEN */}
                            {twPreset === "facet" && (
                              <div className={compiledClassString}>
                                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent -mt-2 mb-3 rounded-full" />

                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                                    FACET GLASS · DEPTH 3
                                  </span>
                                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[10px] text-foreground">
                                    24px Blur · 180% Saturation
                                  </span>
                                </div>

                                <h4 className="mt-2 text-base font-bold text-foreground">
                                  Optical Refraction & Depth
                                </h4>

                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  Depth tier 3 blur spec with surface glare beveling and audio haptic bindings.
                                </p>

                                <div
                                  className={`mt-4 border-t border-white/10 pt-3 ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-2"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <span className="font-mono text-xs text-muted-foreground">
                                    Physics: active:scale-[0.98]
                                  </span>
                                  <div className="flex gap-2">
                                    <button className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/20 active:scale-[0.98]">
                                      Bloom Sound
                                    </button>
                                    <button className="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 active:scale-[0.98]">
                                      Halo Pill
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* PRESET 4: IXFORUM DISCOURSE THREAD */}
                            {twPreset === "forum" && (
                              <div className={compiledClassString}>
                                <div className="flex items-center justify-between">
                                  <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                                    SENATE TOWN HALL · DEBATE
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">2 hours ago</span>
                                </div>

                                <h4 className="mt-2.5 text-base font-bold text-foreground hover:text-orange-400 transition-colors">
                                  Motion to Ratify Bilateral Free Trade Accord with Faneria
                                </h4>

                                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-400">
                                    V
                                  </div>
                                  <span className="font-semibold text-foreground">@SenatorValerius</span>
                                  <span>· Grand Chancellor · 4.2k Posts</span>
                                </div>

                                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                  "The recent volatility index mandates expanding port privileges to stabilize domestic industrial supply lines."
                                </p>

                                <div
                                  className={`mt-4 border-t border-border/40 pt-3 text-xs font-semibold ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-2"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button className="flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-orange-400 hover:bg-orange-500/20 active:scale-[0.97]">
                                      ▲ 142
                                    </button>
                                    <span className="text-muted-foreground">💬 38 Replies</span>
                                  </div>
                                  <button className="text-orange-400 hover:underline">Open Thread →</button>
                                </div>
                              </div>
                            )}

                            {/* PRESET 5: THINKPAGES SOVEREIGN SOCIAL FEED */}
                            {twPreset === "thinkpages" && (
                              <div className={compiledClassString}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                                      FA
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold text-foreground">Faneria Official</span>
                                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">✓</span>
                                      </div>
                                      <span className="font-mono text-[10px] text-muted-foreground">@faneria · Sovereign</span>
                                    </div>
                                  </div>
                                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                                    [blurb:agrarian-bill]
                                  </span>
                                </div>

                                <p className="mt-3 text-xs leading-relaxed text-foreground">
                                  The parliament passed the 2026 Land Modernization Act. CivCap throughput is updating now.
                                </p>

                                <div
                                  className={`mt-4 border-t border-border/40 pt-3 text-xs text-muted-foreground ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-2"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <button className="flex items-center gap-1 hover:text-emerald-400 active:scale-[0.95]">
                                      🔄 284
                                    </button>
                                    <button className="flex items-center gap-1 hover:text-rose-400 active:scale-[0.95]">
                                      ❤️ 1.2k
                                    </button>
                                    <button className="flex items-center gap-1 hover:text-primary active:scale-[0.95]">
                                      🔖 86
                                    </button>
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground">12m ago · ThinkShare</span>
                                </div>
                              </div>
                            )}

                            {/* PRESET 6: IXVAULT COLLECTIBLE HOLOGRAPHIC CARD */}
                            {twPreset === "vault" && (
                              <div className={compiledClassString}>
                                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                                  <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                                    LEGENDARY FOIL · 1ST EDITION
                                  </span>
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                                    #042 / 100
                                  </span>
                                </div>

                                <div className="mt-3">
                                  <h4 className="text-lg font-black tracking-tight text-foreground bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 bg-clip-text text-transparent">
                                    Emperor Aurelius IV of Urcea
                                  </h4>
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    Founding Sovereigns · Tier S
                                  </span>
                                </div>

                                <div className="my-3 grid grid-cols-3 gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-center font-mono">
                                  <div>
                                    <span className="text-[9px] text-muted-foreground uppercase">Power</span>
                                    <div className="text-sm font-bold text-amber-300">98.5</div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-muted-foreground uppercase">Lore</span>
                                    <div className="text-sm font-bold text-amber-300">140</div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-muted-foreground uppercase">Div Yield</span>
                                    <div className="text-sm font-bold text-emerald-400">+350/mo</div>
                                  </div>
                                </div>

                                <div
                                  className={`mt-3 border-t border-amber-500/30 pt-3 ${
                                    twLayoutFlow === "flex-row"
                                      ? "flex items-center justify-between gap-3"
                                      : twLayoutFlow === "flex-col"
                                      ? "flex flex-col items-stretch gap-2"
                                      : twLayoutFlow === "grid-2"
                                      ? "grid grid-cols-2 gap-2"
                                      : "grid grid-cols-1 sm:grid-cols-3 gap-2"
                                  }`}
                                >
                                  <span className="font-mono text-xs font-bold text-amber-400">
                                    Val: 4,800 IxCredits
                                  </span>
                                  <div className="flex gap-2">
                                    <button className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 active:scale-[0.95]">
                                      Inspect Hologram
                                    </button>
                                    <button className="rounded-xl bg-amber-500 text-slate-950 px-3 py-1 text-xs font-bold hover:bg-amber-400 active:scale-[0.95]">
                                      Market
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Box Model HUD Inspector */}
                        {twShowBoxModel && (
                          <div className="space-y-2 rounded-xl border border-border/40 bg-background/50 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">CSS Box Model</span>
                              <span className="font-mono text-[10px] text-muted-foreground">Computed Bounds</span>
                            </div>

                            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-center">
                              <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                MARGIN: mx-auto (Auto Centered)
                              </span>
                              <div className="my-2 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
                                <span className="font-mono text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                  BORDER: 1px ({twBorder}) · RADIUS: {twRadius}
                                </span>
                                <div className="my-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                                  <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                    PADDING: {twPadding} ({twPadding === "p-2" ? "8px" : twPadding === "p-4" ? "16px" : twPadding === "p-6" ? "24px" : "32px"})
                                  </span>
                                  <div className="my-2 rounded border border-primary/40 bg-primary/15 p-2">
                                    <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-wider">
                                      CONTENT BOX (Children)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Syntax-Highlighted Code Box */}
                        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold uppercase text-muted-foreground">
                              Generated JSX:
                            </span>
                            <span className="font-mono text-[10px] text-primary">Tailwind CSS v4</span>
                          </div>
                          <div className="overflow-x-auto rounded-lg bg-background border border-border/40 p-3 font-mono text-xs leading-relaxed text-foreground">
                            <span className="text-blue-400">&lt;div</span> <span className="text-amber-400">className</span>=
                            <span className="text-emerald-400">"{compiledClassString}"</span>
                            <span className="text-blue-400">&gt;</span>
                            <div className="pl-4 text-muted-foreground">
                              {twPreset === "mycountry" && "{/* MyCountry Sovereign Directive Card */}"}
                              {twPreset === "wikios" && "{/* WikiOS Lore Article & Margin Specimen */}"}
                              {twPreset === "facet" && "{/* Facet Volumetric Glass Physical Specimen */}"}
                              {twPreset === "forum" && "{/* IxForum Discourse Discussion Thread */}"}
                              {twPreset === "thinkpages" && "{/* ThinkPages Sovereign Social Feed Post */}"}
                              {twPreset === "vault" && "{/* IxVault Legendary Collectible Card */}"}
                            </div>
                            <span className="text-blue-400">&lt;/div&gt;</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ENGINE 2: FACET MATERIALS & OPTICAL PHYSICS LAB */}
                {twStudioMode === "facet" && (
                  <div className="w-full space-y-6" style={facetLabCustomVars}>
                    {/* Action Bar for Facet Lab */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">Accent Color:</span>
                        <ColorPickerInput
                          value={facetLabConfig.customAccent}
                          onChange={(color) => handleFacetLabConfigChange({ customAccent: color })}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFacetLabReset}
                          className="bg-card border-border/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
                          title="Reset all settings to defaults"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset</span>
                        </button>
                        <button
                          onClick={() =>
                            handleFacetLabConfigChange({ fullscreen: !facetLabConfig.fullscreen })
                          }
                          className="bg-card border-border/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
                        >
                          {facetLabConfig.fullscreen ? (
                            <Minimize2 className="h-3.5 w-3.5" />
                          ) : (
                            <Maximize2 className="h-3.5 w-3.5" />
                          )}
                          <span>{facetLabConfig.fullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Split Grid: Control Panel (5 cols) & Live Sandbox + Exporter (7 cols) */}
                    <div className="grid gap-6 lg:grid-cols-12">
                      <div className="lg:col-span-5">
                        <LabControlPanel
                          config={facetLabConfig}
                          onChange={handleFacetLabConfigChange}
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-6 lg:col-span-7">
                        <div className="lg:sticky lg:top-24">
                          <LabSandbox
                            config={facetLabConfig}
                            onChange={handleFacetLabConfigChange}
                            generatedClassNames={facetLabGeneratedClassNames}
                          />
                        </div>
                        <SnippetExporter
                          config={facetLabConfig}
                          generatedClassNames={facetLabGeneratedClassNames}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </FacetContainer>
            </div>
          )}

          {/* TAB 5: CHEAT SHEET & PATTERN LIBRARY */}
          {activeTab === "cheatsheet" && (
            <div className="space-y-6">
              <FacetContainer
                variant="builder"
                depth={2}
                className="bg-card/60 border-border/60 space-y-4 rounded-2xl border p-6"
              >
                <div className="border-border/40 flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                      <BookOpen className="text-primary h-5 w-5" />
                      IxStates Developer Code Cheat Sheet
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Common full-stack IxStates code patterns with Kistan's core mental models.
                    </p>
                  </div>
                  {copiedSnippet && (
                    <div className="animate-pulse rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Copied {copiedSnippet}! ✅
                    </div>
                  )}
                </div>

                {/* Kistan's Core Mental Models Callout Card */}
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <Lightbulb className="h-4 w-4" /> Kistan's Core Mental Models & Common Pitfalls
                  </div>
                  <div className="text-muted-foreground grid gap-2 pt-1 sm:grid-cols-2">
                    <div>
                      <strong className="text-foreground">• Types vs Values:</strong>{" "}
                      <code className="text-primary font-mono">NationData</code> (PascalCase) is a
                      zero-byte compile-time blueprint.{" "}
                      <code className="text-primary font-mono">allNations</code> (camelCase) is the
                      real array holding data in RAM.
                    </div>
                    <div>
                      <strong className="text-foreground">• No Extra Brackets:</strong>{" "}
                      <code className="text-primary font-mono">.filter()</code> &{" "}
                      <code className="text-primary font-mono">.map()</code> return fresh arrays
                      automatically! Write{" "}
                      <code className="text-primary font-mono">return nations.filter(...)</code>,
                      NOT{" "}
                      <code className="text-primary font-mono">return [nations.filter(...)]</code>.
                    </div>
                    <div>
                      <strong className="text-foreground">• Implicit Booleans:</strong>{" "}
                      <code className="text-primary font-mono">n.stability &gt;= 80</code> evaluates
                      to <code className="text-primary font-mono">true/false</code> automatically—no{" "}
                      <code className="text-primary font-mono">if...else</code> needed inside{" "}
                      <code className="text-primary font-mono">.filter()</code>!
                    </div>
                    <div>
                      <strong className="text-foreground">• Destructuring is Optional:</strong>{" "}
                      Standard dot notation{" "}
                      <code className="text-primary font-mono">(n) =&gt; n.stability</code> is 100%
                      fine and standard! Destructuring is just optional shorthand.
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* React State & Hooks */}
                  <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                        1. React Hooks & State
                      </h3>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `const [count, setCount] = useState(0);\nconst double = useMemo(() => count * 2, [count]);`,
                            "React Hooks"
                          )
                        }
                        className="text-muted-foreground hover:text-foreground bg-card border-border/60 flex items-center gap-1 rounded border px-2 py-1 text-[11px]"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre className="bg-background border-border/60 text-foreground overflow-x-auto rounded-lg border p-3 font-mono text-xs">
                      {`const [taxRate, setTaxRate] = useState(25);
const calculatedRevenue = useMemo(() => {
  return taxRate * population * 10;
}, [taxRate, population]);`}
                    </pre>
                  </div>

                  {/* tRPC Data Pipeline */}
                  <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                        2. tRPC Query & Mutation
                      </h3>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `const { data, isLoading } = api.countries.getAll.useQuery();\nconst mutation = api.policy.create.useMutation();`,
                            "tRPC Hook"
                          )
                        }
                        className="text-muted-foreground hover:text-foreground bg-card border-border/60 flex items-center gap-1 rounded border px-2 py-1 text-[11px]"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre className="bg-background border-border/60 text-foreground overflow-x-auto rounded-lg border p-3 font-mono text-xs">
                      {`// Query Data
const { data, isLoading } = api.countries.getAll.useQuery();

// Mutate Data
const { mutate } = api.policy.create.useMutation({
  onSuccess: () => utils.invalidate()
});`}
                    </pre>
                  </div>

                  {/* JS/TS Array & Object Operations */}
                  <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                        3. Array & Object Operations
                      </h3>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `const names = nations.map(n => n.name);\nconst highStab = nations.filter(n => n.stability >= 80);`,
                            "JS Array Ops"
                          )
                        }
                        className="text-muted-foreground hover:text-foreground bg-card border-border/60 flex items-center gap-1 rounded border px-2 py-1 text-[11px]"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre className="bg-background border-border/60 text-foreground overflow-x-auto rounded-lg border p-3 font-mono text-xs">
                      {`// Filter array (Returns array)
const allies = nations.filter(n => n.stability >= 80);

// Map objects to JSX
{allies.map(nation => (
  <div key={nation.slug}>{nation.name}</div>
))}`}
                    </pre>
                  </div>

                  {/* Facet Container Component */}
                  <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                        4. Facet UI Container
                      </h3>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `<FacetContainer variant="overview" depth={2} interactive="hover">\n  <div>Content</div>\n</FacetContainer>`,
                            "Facet UI Container"
                          )
                        }
                        className="text-muted-foreground hover:text-foreground bg-card border-border/60 flex items-center gap-1 rounded border px-2 py-1 text-[11px]"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre className="bg-background border-border/60 text-foreground overflow-x-auto rounded-lg border p-3 font-mono text-xs">
                      {`<FacetContainer 
  variant="overview" 
  depth={2} 
  interactive="hover"
  className="p-6 rounded-2xl"
>
  <h3>Card Content</h3>
</FacetContainer>`}
                    </pre>
                  </div>
                </div>
              </FacetContainer>
            </div>
          )}

          {/* TAB 6: 5-LEVEL CS INTRO QUIZ */}
          {activeTab === "quiz" && (
            <div className="space-y-6">
              {/* Gamified Header */}
              <div className="bg-card border-border/60 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Trophy className="h-5 w-5 text-amber-500" /> Kistan's 5-Level CS/JS/TS
                    Fundamentals Track
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Edit level files in{" "}
                    <code className="text-primary font-mono">
                      src/app/labs/sandbox/challenges/level*.ts
                    </code>{" "}
                    to unlock levels!
                  </p>
                </div>

                <div className="flex min-w-[220px] items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between font-mono text-xs font-semibold">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-primary">{completedCount} / 5 Levels</span>
                    </div>
                    <div className="bg-accent/40 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tabs for Levels 1–5 */}
              <div className="bg-card border-border/60 grid grid-cols-2 gap-2 rounded-2xl border p-1.5 shadow-sm sm:grid-cols-5">
                <button
                  onClick={() => setActiveLevel("lvl1")}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl1"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  {l1Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Code2 className="h-4 w-4" />
                  )}
                  Lvl 1: Variables
                </button>

                <button
                  onClick={() => l2Unlocked && setActiveLevel("lvl2")}
                  disabled={!l2Unlocked}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl2"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l2Unlocked
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        : "text-muted-foreground cursor-not-allowed opacity-40"
                  }`}
                >
                  {!l2Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : l2Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Sliders className="h-4 w-4" />
                  )}
                  Lvl 2: Logic
                </button>

                <button
                  onClick={() => l3Unlocked && setActiveLevel("lvl3")}
                  disabled={!l3Unlocked}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl3"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l3Unlocked
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        : "text-muted-foreground cursor-not-allowed opacity-40"
                  }`}
                >
                  {!l3Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : l3Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                  Lvl 3: Arrays
                </button>

                <button
                  onClick={() => l4Unlocked && setActiveLevel("lvl4")}
                  disabled={!l4Unlocked}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl4"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l4Unlocked
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        : "text-muted-foreground cursor-not-allowed opacity-40"
                  }`}
                >
                  {!l4Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : l4Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Briefcase className="h-4 w-4" />
                  )}
                  Lvl 4: Objects
                </button>

                <button
                  onClick={() => l5Unlocked && setActiveLevel("lvl5")}
                  disabled={!l5Unlocked}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl5"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l5Unlocked
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        : "text-muted-foreground cursor-not-allowed opacity-40"
                  }`}
                >
                  {!l5Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : l5Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Lvl 5: Async
                </button>

                <button
                  onClick={() => l6Unlocked && setActiveLevel("lvl6")}
                  disabled={!l6Unlocked}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                    activeLevel === "lvl6"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l6Unlocked
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        : "text-muted-foreground cursor-not-allowed opacity-40"
                  }`}
                >
                  {!l6Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : l6Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                  Lvl 6: Tailwind UI
                </button>
              </div>

              {/* LEVEL 1: VARIABLES */}
              {activeLevel === "lvl1" && (
                <div className="grid gap-6 md:grid-cols-3">
                  <FacetContainer
                    variant="builder"
                    depth={2}
                    className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6 md:col-span-2"
                  >
                    <div className="border-border/40 flex items-center justify-between border-b pb-4">
                      <div>
                        <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                          <Code2 className="text-primary h-5 w-5" />
                          Level 1: Variables & Data Formatting
                        </h2>
                        <p className="text-muted-foreground mt-1 text-xs">
                          File:{" "}
                          <code className="text-primary font-mono">
                            src/app/labs/sandbox/challenges/level1_variables.ts
                          </code>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowHint(!showHint)}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500 transition-all hover:text-amber-400"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {showHint ? "Hide Hint" : "Need Hint?"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Test Assertions
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div
                          className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                            l1Exported
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          {l1Exported ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0" />
                          )}
                          <span>
                            Exported <code>formatNationHeader</code> function
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                            l1Passed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          {l1Passed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0" />
                          )}
                          <span>
                            Returns <code>"Nation: Faneria | Population: 40M"</code>
                          </span>
                        </div>
                      </div>
                    </div>

                    {showHint && (
                      <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                        <strong>💡 Kistan's Hint for Level 1:</strong>
                        <p>
                          Open <code>level1_variables.ts</code> and use a template literal string
                          with backticks:
                        </p>
                        <code className="bg-background/80 text-primary block rounded border border-amber-500/20 p-2 font-mono">
                          return `Nation: ${`name`} | Population: ${`populationMillions`}M`;
                        </code>
                      </div>
                    )}

                    <div className="border-border/40 space-y-4 border-t pt-5">
                      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Live Interactive Input Canvas
                      </h3>
                      <div className="bg-background/50 border-border/40 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-xs">Nation Name</label>
                          <input
                            type="text"
                            value={lvl1Name}
                            onChange={(e) => setLvl1Name(e.target.value)}
                            className="bg-card border-border/60 text-foreground w-full rounded-lg border px-3 py-1.5 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-xs">Population (M)</label>
                          <input
                            type="number"
                            value={lvl1Pop}
                            onChange={(e) => setLvl1Pop(Number(e.target.value))}
                            className="bg-card border-border/60 text-foreground w-full rounded-lg border px-3 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </FacetContainer>

                  <FacetContainer
                    variant="overview"
                    depth={3}
                    className="bg-card/80 border-border/80 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 text-center backdrop-blur-xl"
                  >
                    <div className="space-y-3">
                      <h3 className="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                        LIVE FUNCTION OUTPUT
                      </h3>
                      <div className="bg-background/80 border-border/60 text-primary rounded-xl border p-4 py-8 font-mono text-sm font-semibold">
                        {l1LiveHeader || "Function returned empty string"}
                      </div>
                    </div>

                    {l1Passed && (
                      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
                        <span>Level 1 Passed! Level 2 Unlocked!</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </FacetContainer>
                </div>
              )}

              {/* LEVEL 2: CONDITIONALS */}
              {activeLevel === "lvl2" && (
                <div className="grid gap-6 md:grid-cols-3">
                  <FacetContainer
                    variant="builder"
                    depth={2}
                    className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6 md:col-span-2"
                  >
                    <div className="border-border/40 flex items-center justify-between border-b pb-4">
                      <div>
                        <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                          <Sliders className="text-primary h-5 w-5" />
                          Level 2: Economic Tier Classifier (Conditionals)
                        </h2>
                        <p className="text-muted-foreground mt-1 text-xs">
                          File:{" "}
                          <code className="text-primary font-mono">
                            src/app/labs/sandbox/challenges/level2_conditionals.ts
                          </code>
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div
                        className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                          l2Exported
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}
                      >
                        {l2Exported ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0" />
                        )}
                        <span>
                          Exported <code>getEconomicTier</code> function
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                          l2Passed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}
                      >
                        {l2Passed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0" />
                        )}
                        <span>Passes Advanced (≥40k), Developing (≥15k), Emerging tests</span>
                      </div>
                    </div>

                    <div className="border-border/40 space-y-4 border-t pt-5">
                      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Live GDP Per Capita Slider
                      </h3>
                      <div className="bg-background/50 border-border/40 space-y-2 rounded-xl border p-4">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">GDP Per Capita</span>
                          <span className="text-primary">${lvl2Gdp.toLocaleString()}</span>
                        </div>
                        <input
                          type="range"
                          min="5000"
                          max="80000"
                          step="1000"
                          value={lvl2Gdp}
                          onChange={(e) => setLvl2Gdp(Number(e.target.value))}
                          className="bg-accent/40 accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-lg"
                        />
                      </div>
                    </div>
                  </FacetContainer>

                  <FacetContainer
                    variant="overview"
                    depth={3}
                    className="bg-card/80 border-border/80 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 text-center backdrop-blur-xl"
                  >
                    <div className="space-y-3">
                      <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                        ECONOMIC TIER RESULT
                      </h3>
                      <div className="text-foreground py-6 text-3xl font-black">
                        {l2LiveTier || "Empty"}
                      </div>
                    </div>

                    {l2Passed && (
                      <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
                        <span>Level 2 Passed! Level 3 Unlocked!</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </FacetContainer>
                </div>
              )}

              {/* LEVEL 3: ARRAY MASTERCLASS */}
              {activeLevel === "lvl3" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6"
                >
                  <div className="border-border/40 flex items-center justify-between border-b pb-4">
                    <div>
                      <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                        <Layers className="text-primary h-5 w-5" />
                        Level 3: 7-Part Array Masterclass Suite
                      </h2>
                      <p className="text-muted-foreground mt-1 text-xs">
                        File:{" "}
                        <code className="text-primary font-mono">
                          src/app/labs/sandbox/challenges/level3_arrays.ts
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* 7 Test Status Cards */}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3FilterPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3FilterPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        3A: <code>.filter()</code>
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3MapPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3MapPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        3B: <code>.map()</code>
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3FindPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3FindPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        3C: <code>.find()</code>
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3SumPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3SumPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>3D: Total Sum</span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3SortPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3SortPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        3E: <code>.sort()</code>
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium ${
                        l3SecPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3SecPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        3F: <code>.some/.every</code>
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium sm:col-span-2 ${
                        l3GroupPassed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l3GroupPassed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>3G: Grouping by Alliance</span>
                    </div>
                  </div>

                  {/* Live Canvases for the 7 Operations */}
                  <div className="border-border/40 space-y-6 border-t pt-5">
                    {/* 3A: Live Filter */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          3A. Live Alliance & Stability Filter (.filter)
                        </h3>
                        <div className="flex gap-2">
                          <select
                            value={lvl3Alliance}
                            onChange={(e) => setLvl3Alliance(e.target.value)}
                            className="bg-card border-border/60 text-foreground rounded border px-2 py-1 text-xs"
                          >
                            <option value="Concord">Concord</option>
                            <option value="Neutral">Neutral</option>
                          </select>
                          <input
                            type="number"
                            value={lvl3MinStab}
                            onChange={(e) => setLvl3MinStab(Number(e.target.value))}
                            className="bg-card border-border/60 text-foreground w-16 rounded border px-2 py-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {l3FilteredNations.length > 0 ? (
                          l3FilteredNations.map((nation, idx) => (
                            <FacetContainer
                              key={idx}
                              variant="overview"
                              depth={2}
                              className="space-y-1 rounded-xl p-3"
                            >
                              <span className="text-primary text-xs font-semibold">
                                {nation.name}
                              </span>
                              <div className="text-muted-foreground text-[11px]">
                                GDP: ${nation.gdp}B | Alliance: {nation.alliance}
                              </div>
                              <div className="text-[11px] text-emerald-400">
                                Stability: {nation.stability}%
                              </div>
                            </FacetContainer>
                          ))
                        ) : (
                          <div className="border-border/60 text-muted-foreground col-span-3 rounded-xl border border-dashed p-4 text-center text-xs">
                            No nations matched filter criteria.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3E: Live Sort */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                          <ArrowUpDown className="text-primary h-3.5 w-3.5" /> 3E. Live GDP Ranking
                          (.sort)
                        </h3>
                        <button
                          onClick={() =>
                            setLvl3SortDirection(lvl3SortDirection === "desc" ? "asc" : "desc")
                          }
                          className="bg-card border-border/60 text-primary flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-xs"
                        >
                          Direction: {lvl3SortDirection.toUpperCase()}
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        {l3SortedNations.map((n, idx) => (
                          <div
                            key={idx}
                            className="bg-card border-border/60 space-y-1 rounded-xl border p-3 text-center"
                          >
                            <span className="text-muted-foreground font-mono text-[10px] font-semibold">
                              # {idx + 1} RANK
                            </span>
                            <div className="text-foreground text-xs font-bold">{n.name}</div>
                            <div className="text-xs font-semibold text-emerald-400">
                              ${n.gdp}B GDP
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3F: Security Check (.some / .every) */}
                    <div className="bg-background/50 border-border/40 space-y-2 rounded-xl border p-4">
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> 3F. Alliance Security
                        Status (.some / .every)
                      </h3>
                      <div className="grid gap-3 pt-1 sm:grid-cols-2">
                        <div className="bg-card border-border/60 flex items-center justify-between rounded-lg border p-3 text-xs">
                          <span className="text-muted-foreground">All Nations Stable (≥70%):</span>
                          <span
                            className={`font-mono font-bold ${l3SecStatus.allStable ? "text-emerald-400" : "text-amber-400"}`}
                          >
                            {l3SecStatus.allStable ? "TRUE ✅" : "FALSE ⚠️"}
                          </span>
                        </div>
                        <div className="bg-card border-border/60 flex items-center justify-between rounded-lg border p-3 text-xs">
                          <span className="text-muted-foreground">
                            Critical Instability Detected (&lt;60%):
                          </span>
                          <span
                            className={`font-mono font-bold ${l3SecStatus.anyCritical ? "text-destructive" : "text-emerald-400"}`}
                          >
                            {l3SecStatus.anyCritical ? "TRUE 🚨" : "FALSE ✅"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3G: Alliance Grouping */}
                    <div className="space-y-3">
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                        <FolderTree className="text-primary h-3.5 w-3.5" /> 3G. Group Nations by
                        Alliance (Category Grouping)
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {Object.entries(l3GroupedNations).map(([alliance, list], i) => (
                          <div
                            key={i}
                            className="bg-card border-border/60 space-y-2 rounded-xl border p-4"
                          >
                            <span className="text-primary font-mono text-xs font-bold tracking-wider uppercase">
                              {alliance} ALLIANCE ({list.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {list.map((n, idx) => (
                                <span
                                  key={idx}
                                  className="bg-background border-border/60 text-foreground rounded border px-2 py-0.5 text-xs font-semibold"
                                >
                                  {n.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </FacetContainer>
              )}

              {/* LEVEL 4: OBJECTS & METHODS */}
              {activeLevel === "lvl4" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6"
                >
                  <div className="border-border/40 flex items-center justify-between border-b pb-4">
                    <div>
                      <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                        <Briefcase className="text-primary h-5 w-5" />
                        Level 4: Treasury Vault Manager (Objects & 'this')
                      </h2>
                      <p className="text-muted-foreground mt-1 text-xs">
                        File:{" "}
                        <code className="text-primary font-mono">
                          src/app/labs/sandbox/challenges/level4_objects.ts
                        </code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                        l4ObjectExported
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l4ObjectExported ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        Exported <code>NationTreasuryVault</code> object
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                        l4Passed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l4Passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        <code>allocateBudget(amount)</code> mutates reserves via <code>this</code>
                      </span>
                    </div>
                  </div>

                  <div className="border-border/40 space-y-4 border-t pt-5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      Live Vault State Inspector
                    </h3>
                    <div className="bg-background/50 border-border/40 space-y-4 rounded-xl border p-6 text-center">
                      <span className="text-muted-foreground font-mono text-xs">
                        CURRENT VAULT RESERVES
                      </span>
                      <div className="text-4xl font-black text-emerald-400">${lvl4Reserves}M</div>
                      <p className="text-muted-foreground font-mono text-xs">{l4StatusString}</p>

                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={() => handleL4Allocate(100)}
                          disabled={!l4MethodExported}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:opacity-40"
                        >
                          Call NationTreasuryVault.allocateBudget(100)
                        </button>
                      </div>
                    </div>
                  </div>
                </FacetContainer>
              )}

              {/* LEVEL 5: ASYNC */}
              {activeLevel === "lvl5" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6"
                >
                  <div className="border-border/40 flex items-center justify-between border-b pb-4">
                    <div>
                      <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                        <Database className="text-primary h-5 w-5" />
                        Level 5: Async Intelligence Dispatcher (Promises)
                      </h2>
                      <p className="text-muted-foreground mt-1 text-xs">
                        File:{" "}
                        <code className="text-primary font-mono">
                          src/app/labs/sandbox/challenges/level5_async.ts
                        </code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                        l5FunctionExported
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l5FunctionExported ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        Exported <code>async fetchNationIntelReport</code> function
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
                        l5Passed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}
                    >
                      {l5Passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>Promise resolves to IntelReport object</span>
                    </div>
                  </div>

                  <div className="border-border/40 space-y-4 border-t pt-5">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      Live Async Intel Dispatcher
                    </h3>
                    <div className="bg-background/50 border-border/40 space-y-4 rounded-xl border p-6 text-center">
                      <button
                        onClick={handleLvl5RunIntel}
                        disabled={lvl5Loading || !l5FunctionExported}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 mx-auto flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all disabled:opacity-40"
                      >
                        {lvl5Loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Execute await fetchNationIntelReport("faneria")
                      </button>

                      {lvl5Result && (
                        <div className="bg-card border-border/60 mx-auto max-w-sm space-y-1 rounded-xl border p-4 text-left">
                          <span className="text-primary font-mono text-xs font-semibold">
                            PROMISE FULFILLED
                          </span>
                          <div className="text-foreground text-sm font-bold">
                            Nation: {lvl5Result.nation}
                          </div>
                          <div className="text-xs font-semibold text-emerald-400">
                            Intel Score: {lvl5Result.intelScore} / 100
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Status: {lvl5Result.status}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </FacetContainer>
              )}

              {/* LEVEL 6: TAILWIND CSS & UI COMPONENT CRASH COURSE */}
              {activeLevel === "lvl6" && (
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* MAIN WORKSPACE (2 COLS) */}
                  <FacetContainer
                    variant="builder"
                    depth={2}
                    className="bg-card/60 border-border/60 space-y-6 rounded-2xl border p-6 lg:col-span-2 shadow-sm"
                  >
                    {/* Header */}
                    <div className="border-border/40 flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Layers className="h-4 w-4" />
                          </span>
                          <h2 className="text-foreground text-xl font-bold tracking-tight">
                            Level 6: Tailwind CSS & UI Component Mastery
                          </h2>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          File:{" "}
                          <code className="text-primary font-mono font-semibold">
                            src/app/labs/sandbox/challenges/level6_tailwind.ts
                          </code>
                        </p>
                      </div>
                      <button
                        onClick={() => setL6ShowHint(!l6ShowHint)}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {l6ShowHint ? "Hide Hint" : "Need Hint?"}
                      </button>
                    </div>

                    {/* Hint / Walkthrough Card */}
                    {l6ShowHint && (
                      <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                        <div className="flex items-center gap-2 font-bold text-amber-400">
                          <Lightbulb className="h-4 w-4" />
                          <span>Level 6 Step-by-Step Implementation Hints</span>
                        </div>
                        <div className="space-y-2 pt-1 leading-relaxed text-muted-foreground">
                          <div>
                            <strong className="text-foreground">6A Badges:</strong> Use a base string{" "}
                            <code className="font-mono text-primary">"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"</code>{" "}
                            and merge with status tints using <code className="font-mono text-primary">cn(base, statusClass)</code>.
                          </div>
                          <div>
                            <strong className="text-foreground">6B Tactile Buttons:</strong> Combine the Apple compression tokens{" "}
                            <code className="font-mono text-primary">"duration-150 active:scale-[0.98]"</code> with variant backgrounds.
                          </div>
                          <div>
                            <strong className="text-foreground">6C Responsive Grids:</strong> Start with{" "}
                            <code className="font-mono text-primary">"grid grid-cols-1"</code> for mobile, and scale up with{" "}
                            <code className="font-mono text-primary">"sm:grid-cols-2"</code> and{" "}
                            <code className="font-mono text-primary">"lg:grid-cols-X"</code>.
                          </div>
                          <div>
                            <strong className="text-foreground">6D Metric Cards:</strong> Use{" "}
                            <code className="font-mono text-primary">cn(base, isPositive ? "border-emerald-500/40" : "border-rose-500/40", customClass)</code>.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4 Test Assertion Cards */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Test Assertions
                        </h3>
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {Number(l6BadgePassed) + Number(l6ButtonPassed) + Number(l6GridPassed) + Number(l6CardPassed)} / 4 Passing
                        </span>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {/* 6A */}
                        <div
                          className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium transition-all ${
                            l6BadgePassed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {l6BadgePassed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              6A: <code>getDirectiveBadgeClasses</code>
                            </span>
                          </div>
                          <span className="font-mono text-[10px] opacity-80">
                            {l6BadgePassed ? "PASS" : "FAIL"}
                          </span>
                        </div>

                        {/* 6B */}
                        <div
                          className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium transition-all ${
                            l6ButtonPassed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {l6ButtonPassed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              6B: <code>getTactileButtonClasses</code>
                            </span>
                          </div>
                          <span className="font-mono text-[10px] opacity-80">
                            {l6ButtonPassed ? "PASS" : "FAIL"}
                          </span>
                        </div>

                        {/* 6C */}
                        <div
                          className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium transition-all ${
                            l6GridPassed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {l6GridPassed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              6C: <code>buildResponsiveGridClasses</code>
                            </span>
                          </div>
                          <span className="font-mono text-[10px] opacity-80">
                            {l6GridPassed ? "PASS" : "FAIL"}
                          </span>
                        </div>

                        {/* 6D */}
                        <div
                          className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium transition-all ${
                            l6CardPassed
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {l6CardPassed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              6D: <code>formatMetricCardClasses</code>
                            </span>
                          </div>
                          <span className="font-mono text-[10px] opacity-80">
                            {l6CardPassed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Component Playground */}
                    <div className="border-border/40 space-y-4 border-t pt-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Interactive Component Playground
                        </h3>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Direct live rendering from your code
                        </span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Playground 1: 6A Status Badges */}
                        <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">6A: Directive Status Badges</span>
                            <span className="font-mono text-[10px] text-muted-foreground">Click to test</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border/40 bg-background/80 p-3">
                            {(["ACTIVE", "PENDING", "CRITICAL"] as Level6.DirectiveStatus[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => setL6TestStatus(st)}
                                className={`${
                                  l6BadgeExported ? Level6.getDirectiveBadgeClasses(st) : ""
                                } cursor-pointer transition-all ${
                                  l6TestStatus === st ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>

                          <div className="overflow-x-auto rounded bg-background border border-border/40 p-2 font-mono text-[10px] text-muted-foreground">
                            {l6BadgeExported ? Level6.getDirectiveBadgeClasses(l6TestStatus) : "Function not exported"}
                          </div>
                        </div>

                        {/* Playground 2: 6B Apple Tactile Buttons */}
                        <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">6B: Tactile Buttons</span>
                            <span className="font-mono text-[10px] text-muted-foreground">Pointer-down spring</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border/40 bg-background/80 p-3">
                            {(["primary", "secondary", "destructive"] as Level6.ButtonVariant[]).map((v) => (
                              <button
                                key={v}
                                onClick={() => setL6TestVariant(v)}
                                className={`${
                                  l6ButtonExported ? Level6.getTactileButtonClasses(v) : ""
                                } px-3 py-1.5 text-xs font-semibold capitalize ${
                                  l6TestVariant === v ? "ring-2 ring-primary ring-offset-1" : ""
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>

                          <div className="overflow-x-auto rounded bg-background border border-border/40 p-2 font-mono text-[10px] text-muted-foreground">
                            {l6ButtonExported ? Level6.getTactileButtonClasses(l6TestVariant) : "Function not exported"}
                          </div>
                        </div>

                        {/* Playground 3: 6C Responsive Grid Layout */}
                        <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4 sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">6C: Responsive Grid Layout</span>
                            <div className="flex items-center gap-1.5">
                              {([2, 3, 4] as (2 | 3 | 4)[]).map((cols) => (
                                <button
                                  key={cols}
                                  onClick={() => setL6TestCols(cols)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                    l6TestCols === cols
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {cols} Columns
                                </button>
                              ))}
                            </div>
                          </div>

                          <div
                            className={
                              l6GridExported
                                ? Level6.buildResponsiveGridClasses(l6TestCols)
                                : "grid grid-cols-1 gap-2"
                            }
                          >
                            {Array.from({ length: l6TestCols }).map((_, i) => (
                              <div
                                key={i}
                                className="rounded-xl border border-border/60 bg-card/90 p-3 text-center"
                              >
                                <span className="font-mono text-[11px] font-bold text-primary">
                                  Col {i + 1}
                                </span>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Fluid Responsive Box
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="overflow-x-auto rounded bg-background border border-border/40 p-2 font-mono text-[10px] text-muted-foreground">
                            {l6GridExported ? Level6.buildResponsiveGridClasses(l6TestCols) : "Function not exported"}
                          </div>
                        </div>

                        {/* Playground 4: 6D cn() Metric Card */}
                        <div className="bg-background/50 border-border/40 space-y-3 rounded-xl border p-4 sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">6D: cn() Card Composition</span>
                            <button
                              onClick={() => setL6TestIsPositive(!l6TestIsPositive)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                l6TestIsPositive
                                  ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : "border border-rose-500/40 bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              Status: {l6TestIsPositive ? "Positive (+)" : "Negative (-)"}
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">
                              Test Custom Class Override:
                            </label>
                            <input
                              type="text"
                              value={l6TestCustomClass}
                              onChange={(e) => setL6TestCustomClass(e.target.value)}
                              className="w-full rounded-lg border border-border/60 bg-card px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                              placeholder="e.g. shadow-lg ring-1 ring-primary/40 font-mono"
                            />
                          </div>

                          <div
                            className={
                              l6CardExported
                                ? Level6.formatMetricCardClasses(l6TestIsPositive, l6TestCustomClass)
                                : "p-4 bg-card border rounded-xl"
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-muted-foreground">Gross National Surplus</span>
                              <span className="font-mono text-xs font-extrabold text-foreground">
                                {l6TestIsPositive ? "+$42.8B" : "-$14.2B"}
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded bg-background border border-border/40 p-2 font-mono text-[10px] text-muted-foreground">
                            {l6CardExported
                              ? Level6.formatMetricCardClasses(l6TestIsPositive, l6TestCustomClass)
                              : "Function not exported"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </FacetContainer>

                  {/* CRASH COURSE GUIDE RAIL (1 COL) */}
                  <div className="space-y-4">
                    <FacetContainer
                      variant="builder"
                      depth={1}
                      className="bg-card/60 border-border/60 space-y-4 rounded-2xl border p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                        <Code2 className="text-primary h-4 w-4" />
                        <h3 className="text-foreground text-sm font-bold">
                          Tailwind UI Crash Course
                        </h3>
                      </div>

                      {/* Lesson 1: Zero-Hex */}
                      <div className="space-y-1.5 text-xs">
                        <strong className="text-foreground block">1. The Zero-Hex Standard</strong>
                        <p className="text-muted-foreground leading-relaxed">
                          Never hardcode arbitrary hex colors like <code className="font-mono text-rose-400">bg-[#12141c]</code>. Always use semantic Tailwind v4 tokens:
                        </p>
                        <div className="rounded-lg border border-border/40 bg-background/80 p-2 font-mono text-[10px] text-muted-foreground space-y-0.5">
                          <div>• <span className="text-primary">bg-card</span> (Adaptive surface)</div>
                          <div>• <span className="text-primary">text-foreground</span> (Primary text)</div>
                          <div>• <span className="text-primary">border-border/60</span> (Translucent edge)</div>
                          <div>• <span className="text-primary">text-muted-foreground</span> (Secondary text)</div>
                        </div>
                      </div>

                      {/* Lesson 2: Tactile Physics */}
                      <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
                        <strong className="text-foreground block">2. Tactile Spring Physics</strong>
                        <p className="text-muted-foreground leading-relaxed">
                          Every interactive button and trigger in IxStates must include the mechanical compression formula:
                        </p>
                        <div className="rounded-lg border border-border/40 bg-background/80 p-2 font-mono text-[10px] text-emerald-400">
                          transition-all duration-150 active:scale-[0.98]
                        </div>
                      </div>

                      {/* Lesson 3: Mobile-First Breakpoints */}
                      <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
                        <strong className="text-foreground block">3. Mobile-First Grids</strong>
                        <p className="text-muted-foreground leading-relaxed">
                          Default unprefixed classes style mobile screens (&lt;640px). Add responsive modifiers for larger screens:
                        </p>
                        <div className="rounded-lg border border-border/40 bg-background/80 p-2 font-mono text-[10px] text-muted-foreground space-y-0.5">
                          <div>• Base: <span className="text-primary">grid-cols-1</span> (&lt;640px)</div>
                          <div>• sm: <span className="text-primary">sm:grid-cols-2</span> (≥640px)</div>
                          <div>• lg: <span className="text-primary">lg:grid-cols-3</span> (≥1024px)</div>
                        </div>
                      </div>

                      {/* Lesson 4: cn() Utility */}
                      <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
                        <strong className="text-foreground block">4. cn() Specificity Resolution</strong>
                        <p className="text-muted-foreground leading-relaxed">
                          <code className="font-mono text-primary font-bold">cn()</code> combines <code className="font-mono">clsx</code> for conditional class names with <code className="font-mono">twMerge</code> to eliminate CSS specificity bugs. Overriding props always win over component defaults.
                        </p>
                      </div>
                    </FacetContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
