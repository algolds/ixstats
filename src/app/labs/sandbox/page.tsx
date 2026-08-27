"use client";

import React, { useState, useTransition } from "react";
import { FacetContainer } from "~/components/ui/facet-container";
import type { FacetVariant, FacetDepth, FacetInteractivity } from "~/components/ui/facet-container";
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
  StatUp as TrendingUp,
  Palette,
  Eye,
  Copy,
  Send,
  OpenBook as BookOpen,
  ArrowSeparateVertical as ArrowUpDown,
  ShieldAlert,
  Folder as FolderTree,
  LightBulb as Lightbulb,
} from "iconoir-react";

// Import Kistan's 5 CS Intro Level Files
import * as Level1 from "./challenges/level1_variables";
import * as Level2 from "./challenges/level2_conditionals";
import * as Level3 from "./challenges/level3_arrays";
import * as Level4 from "./challenges/level4_objects";
import * as Level5 from "./challenges/level5_async";

export default function SandboxPage() {
  // Top-level Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    "sim" | "trpc" | "mutation" | "facet" | "cheatsheet" | "quiz"
  >("sim");

  // Sub-tabs inside Quiz mode
  const [activeLevel, setActiveLevel] = useState<"lvl1" | "lvl2" | "lvl3" | "lvl4" | "lvl5">(
    "lvl1"
  );

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
  // TAB 4: FACET DESIGN LAB STATE
  // ==========================================
  const [facetVariant, setFacetVariant] = useState<FacetVariant>("overview");
  const [facetDepth, setFacetDepth] = useState<FacetDepth>(2);
  const [facetInteractivity, setFacetInteractivity] = useState<FacetInteractivity>("hover");
  const [facetRefraction, setFacetRefraction] = useState(true);

  // ==========================================
  // TAB 5: CHEAT SHEET COPY FEEDBACK STATE
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

  // Level Progression & Locks
  const completedCount =
    (l1Passed ? 1 : 0) +
    (l2Passed ? 1 : 0) +
    (l3Passed ? 1 : 0) +
    (l4Passed ? 1 : 0) +
    (l5Passed ? 1 : 0);
  const progressPercent = (completedCount / 5) * 100;
  const l2Unlocked = l1Passed;
  const l3Unlocked = l1Passed && l2Passed;
  const l4Unlocked = l1Passed && l2Passed && l3Passed;
  const l5Unlocked = l1Passed && l2Passed && l3Passed && l4Passed;
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="bg-background text-foreground relative min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block */}
        <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight">Labs Sandbox</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              A premium, Facet-compliant playground to test simulation logic, tRPC endpoints, Facet
              UI components, and CS intro quizzes.
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
            onClick={() => setActiveTab("facet")}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "facet"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Palette className="h-4 w-4" />
            Facet Design Lab
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

          {/* TAB 4: FACET DESIGN LAB */}
          {activeTab === "facet" && (
            <div className="space-y-6">
              <FacetContainer
                variant="global"
                depth={2}
                className="bg-card/60 border-border/60 space-y-4 rounded-2xl border p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                    <Palette className="text-primary h-5 w-5" />
                    Facet Component & Material Inspector
                  </h2>
                  <span className="text-muted-foreground font-mono text-xs">
                    Facet Design System v1.1
                  </span>
                </div>

                <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs font-medium">
                      Variant Surface
                    </label>
                    <select
                      value={facetVariant}
                      onChange={(e) => setFacetVariant(e.target.value as FacetVariant)}
                      className="bg-card border-border/60 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    >
                      <option value="overview">Overview (Cyan/Indigo)</option>
                      <option value="economy">Economy (Amber/Gold)</option>
                      <option value="military">Military (Red/Crimson)</option>
                      <option value="security">Security (Emerald/Cyan)</option>
                      <option value="cultural">Cultural (Purple/Violet)</option>
                      <option value="builder">Builder (Slate/Blue)</option>
                      <option value="mycountry">MyCountry Executive</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs font-medium">
                      Z-Depth Elevation
                    </label>
                    <select
                      value={facetDepth}
                      onChange={(e) => setFacetDepth(Number(e.target.value) as FacetDepth)}
                      className="bg-card border-border/60 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    >
                      <option value="1">Depth 1 (Low Surface)</option>
                      <option value="2">Depth 2 (Standard Module)</option>
                      <option value="3">Depth 3 (High Card)</option>
                      <option value="4">Depth 4 (Max Overlay)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs font-medium">
                      Interactivity
                    </label>
                    <select
                      value={facetInteractivity}
                      onChange={(e) => setFacetInteractivity(e.target.value as FacetInteractivity)}
                      className="bg-card border-border/60 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    >
                      <option value="none">None (Static)</option>
                      <option value="hover">Hover (Subtle Lift)</option>
                      <option value="click">Click (Active Spring)</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={facetRefraction}
                        onChange={(e) => setFacetRefraction(e.target.checked)}
                        className="border-border/60 bg-card text-primary focus:ring-primary rounded"
                      />
                      Enable Refraction Sheen
                    </label>
                  </div>
                </div>
              </FacetContainer>

              <FacetContainer
                variant={facetVariant}
                depth={facetDepth}
                interactive={facetInteractivity}
                enableRefraction={facetRefraction}
                className="bg-card/60 border-border/60 space-y-4 rounded-2xl border p-6"
              >
                <div className="border-border/40 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="text-primary h-4 w-4" />
                    <span className="text-foreground text-sm font-bold capitalize">
                      {facetVariant} Surface Preview
                    </span>
                  </div>
                  <span className="text-primary font-mono text-xs font-semibold">
                    Depth {facetDepth}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Gross Domestic Product</span>
                    <div className="text-foreground text-2xl font-bold">$450.8 Billion</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <TrendingUp className="h-3 w-3" /> +4.2% Annual Growth
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-muted-foreground block text-xs">Status Badges</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        ACTIVE
                      </span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        PENDING
                      </span>
                      <span className="bg-primary/10 border-primary/30 text-primary rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                        VERIFIED
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-muted-foreground block text-xs">Action Buttons</span>
                    <div className="flex gap-2">
                      <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all">
                        Execute
                      </button>
                      <button className="bg-accent/40 border-border/60 hover:bg-accent/60 text-foreground rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all">
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
