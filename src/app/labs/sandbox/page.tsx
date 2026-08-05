"use client";

import React, { useState, useTransition } from "react";
import { FacetContainer, FacetVariant, FacetDepth, FacetInteractivity } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import {
  Trophy,
  Lock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  Loader2,
  Sliders,
  Database,
  Layers,
  Zap,
  Code2,
  ChevronRight,
  AlertCircle,
  Shield,
  Briefcase,
  TrendingUp,
  Palette,
  Eye,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

// Import Kistan's 5 CS Intro Level Files
import * as Level1 from "./challenges/level1_variables";
import * as Level2 from "./challenges/level2_conditionals";
import * as Level3 from "./challenges/level3_arrays";
import * as Level4 from "./challenges/level4_objects";
import * as Level5 from "./challenges/level5_async";

export default function SandboxPage() {
  // Top-level Navigation Tabs
  const [activeTab, setActiveTab] = useState<"sim" | "trpc" | "facet" | "quiz">("sim");

  // Sub-tabs inside Quiz mode
  const [activeLevel, setActiveLevel] = useState<"lvl1" | "lvl2" | "lvl3" | "lvl4" | "lvl5">("lvl1");

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
  const { data: profileData, isLoading: profileLoading, error: profileError } =
    api.users.getCurrentUserWithRole.useQuery(undefined, {
      retry: false,
      refetchOnWindowFocus: false,
    });

  // ==========================================
  // TAB 3: FACET DESIGN LAB STATE
  // ==========================================
  const [facetVariant, setFacetVariant] = useState<FacetVariant>("overview");
  const [facetDepth, setFacetDepth] = useState<FacetDepth>(2);
  const [facetInteractivity, setFacetInteractivity] = useState<FacetInteractivity>("hover");
  const [facetRefraction, setFacetRefraction] = useState(true);

  // ==========================================
  // TAB 4: 5-LEVEL CS INTRO QUIZ VALIDATION
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

  // Level 3: Arrays & Iteration
  const [lvl3MinStab, setLvl3MinStab] = useState(80);
  const l3ArrayExported = Array.isArray(Level3.allNations) && Level3.allNations.length >= 3;
  const l3FilterExported = typeof Level3.filterHighStabilityNations === "function";
  const l3FilteredNations = l3FilterExported && l3ArrayExported ? Level3.filterHighStabilityNations(Level3.allNations, lvl3MinStab) : [];
  const l3Passed = l3ArrayExported && l3FilterExported && Level3.filterHighStabilityNations(Level3.allNations, 80).length > 0;

  // Level 4: Objects & Methods ('this')
  const [lvl4Reserves, setLvl4Reserves] = useState(1000);
  const l4ObjectExported = !!Level4.NationTreasuryVault && typeof Level4.NationTreasuryVault === "object";
  const l4MethodExported = l4ObjectExported && typeof Level4.NationTreasuryVault.allocateBudget === "function";
  const handleL4Allocate = (amount: number) => {
    if (l4MethodExported) {
      Level4.NationTreasuryVault.allocateBudget(amount);
      setLvl4Reserves(Level4.NationTreasuryVault.reserves);
    }
  };
  const l4Passed = l4MethodExported && lvl4Reserves !== 1000;
  const l4StatusString = l4ObjectExported && typeof Level4.NationTreasuryVault.getVaultStatus === "function" ? Level4.NationTreasuryVault.getVaultStatus() : "";

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
  const completedCount = (l1Passed ? 1 : 0) + (l2Passed ? 1 : 0) + (l3Passed ? 1 : 0) + (l4Passed ? 1 : 0) + (l5Passed ? 1 : 0);
  const progressPercent = (completedCount / 5) * 100;
  const l2Unlocked = l1Passed;
  const l3Unlocked = l1Passed && l2Passed;
  const l4Unlocked = l1Passed && l2Passed && l3Passed;
  const l5Unlocked = l1Passed && l2Passed && l3Passed && l4Passed;
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="relative min-h-screen bg-background p-6 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block */}
        <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Labs Sandbox
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              A premium, Facet-compliant playground to test simulation logic, tRPC endpoints, Facet design system components, and CS intro quizzes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-card border border-border/60 rounded-full px-3.5 py-1.5 text-muted-foreground self-start md:self-auto shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Sandbox Active
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex gap-2 bg-card border border-border/60 p-1.5 rounded-2xl max-w-2xl shadow-sm">
          <button
            onClick={() => setActiveTab("sim")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
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
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "trpc"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Database className="h-4 w-4" />
            tRPC Query
          </button>
          <button
            onClick={() => setActiveTab("facet")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "facet"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Palette className="h-4 w-4" />
            Facet Design Lab
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "quiz"
                ? "bg-amber-600 text-white shadow-md"
                : "text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
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
                className="md:col-span-2 bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-foreground">Simulation Controls</h2>
                  <span className="text-xs text-muted-foreground font-mono">Client State Hooks</span>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Income Tax Rate</span>
                      <span className="font-bold text-primary">{taxRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Defense Allocation</span>
                      <span className="font-bold text-primary">{defenseSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={defenseSpending}
                      onChange={(e) => setDefenseSpending(Number(e.target.value))}
                      className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Education & Infrastructure</span>
                      <span className="font-bold text-primary">{educationSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={educationSpending}
                      onChange={(e) => setEducationSpending(Number(e.target.value))}
                      className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </FacetContainer>

              <FacetContainer
                variant="overview"
                depth={3}
                className="bg-card/80 backdrop-blur-xl border border-border/80 rounded-2xl p-6 flex flex-col justify-between text-center relative overflow-hidden"
              >
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-primary font-semibold">Stability Index</h3>
                  <div className="text-6xl font-black text-foreground py-4 transition-all duration-300">
                    {calculatedStability}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Simulated index calculated reactively on local state changes.
                  </p>
                </div>
                <div className="mt-6 border-t border-border/40 pt-4 text-left text-xs text-muted-foreground space-y-1.5">
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
              className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">tRPC Database Hook Check</h2>
                <div className="text-xs text-muted-foreground font-mono">api.users.getCurrentUserWithRole</div>
              </div>

              {profileLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-muted-foreground text-sm">Querying database over tRPC pipeline...</span>
                </div>
              ) : profileError ? (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 p-4 rounded-xl text-destructive text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Failed to load profile data.</span>
                    <p className="text-muted-foreground text-xs mt-1">{profileError.message}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-emerald-500 text-sm font-medium">
                    ✅ Success: Database response received cleanly via tRPC.
                  </div>
                  <div className="bg-background border border-border/60 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-primary">
                      {JSON.stringify(profileData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </FacetContainer>
          )}

          {/* TAB 3: FACET DESIGN LAB (COMPONENTS & VARIANTS) */}
          {activeTab === "facet" && (
            <div className="space-y-6">
              {/* Interactive Controls Bar */}
              <FacetContainer
                variant="global"
                depth={2}
                className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Facet Component & Material Inspector
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono">Facet Design System v1.1</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Variant Surface</label>
                    <select
                      value={facetVariant}
                      onChange={(e) => setFacetVariant(e.target.value as FacetVariant)}
                      className="w-full bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-foreground"
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
                    <label className="text-xs text-muted-foreground font-medium">Z-Depth Elevation</label>
                    <select
                      value={facetDepth}
                      onChange={(e) => setFacetDepth(Number(e.target.value) as FacetDepth)}
                      className="w-full bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                    >
                      <option value="1">Depth 1 (Low Surface)</option>
                      <option value="2">Depth 2 (Standard Module)</option>
                      <option value="3">Depth 3 (High Card)</option>
                      <option value="4">Depth 4 (Max Overlay)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Interactivity</label>
                    <select
                      value={facetInteractivity}
                      onChange={(e) => setFacetInteractivity(e.target.value as FacetInteractivity)}
                      className="w-full bg-card border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                    >
                      <option value="none">None (Static)</option>
                      <option value="hover">Hover (Subtle Lift)</option>
                      <option value="click">Click (Active Spring)</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={facetRefraction}
                        onChange={(e) => setFacetRefraction(e.target.checked)}
                        className="rounded border-border/60 bg-card text-primary focus:ring-primary"
                      />
                      Enable Refraction Sheen
                    </label>
                  </div>
                </div>
              </FacetContainer>

              {/* Dynamic Live Inspector Card */}
              <FacetContainer
                variant={facetVariant}
                depth={facetDepth}
                interactive={facetInteractivity}
                enableRefraction={facetRefraction}
                className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground capitalize">{facetVariant} Surface Preview</span>
                  </div>
                  <span className="text-xs text-primary font-mono font-semibold">Depth {facetDepth}</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* KPI Display */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Gross Domestic Product</span>
                    <div className="text-2xl font-bold text-foreground">$450.8 Billion</div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                      <TrendingUp className="h-3 w-3" /> +4.2% Annual Growth
                    </div>
                  </div>

                  {/* Badges Gallery */}
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground block">Status Badges</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        PENDING
                      </span>
                      <span className="bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        VERIFIED
                      </span>
                    </div>
                  </div>

                  {/* Actions Gallery */}
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground block">Action Buttons</span>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold transition-all">
                        Execute
                      </button>
                      <button className="px-3 py-1.5 bg-accent/40 border border-border/60 hover:bg-accent/60 rounded-lg text-xs font-semibold text-foreground transition-all">
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>
              </FacetContainer>

              {/* Common Facet Gallery */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <FacetContainer
                  variant="economy"
                  depth={2}
                  interactive="hover"
                  className="bg-card/40 border border-border/60 rounded-xl p-5 space-y-3"
                >
                  <span className="text-xs text-amber-400 font-semibold font-mono">ECONOMY VARIANT</span>
                  <h4 className="text-base font-bold text-foreground">Treasury Reserve</h4>
                  <p className="text-xs text-muted-foreground">Gold/Amber refraction blend for fiscal panels.</p>
                </FacetContainer>

                <FacetContainer
                  variant="military"
                  depth={2}
                  interactive="hover"
                  className="bg-card/40 border border-border/60 rounded-xl p-5 space-y-3"
                >
                  <span className="text-xs text-rose-400 font-semibold font-mono">MILITARY VARIANT</span>
                  <h4 className="text-base font-bold text-foreground">Readiness Index</h4>
                  <p className="text-xs text-muted-foreground">Crimson/Red refraction gradient for defense alerts.</p>
                </FacetContainer>

                <FacetContainer
                  variant="security"
                  depth={2}
                  interactive="hover"
                  className="bg-card/40 border border-border/60 rounded-xl p-5 space-y-3"
                >
                  <span className="text-xs text-emerald-400 font-semibold font-mono">SECURITY VARIANT</span>
                  <h4 className="text-base font-bold text-foreground">Intel Watch</h4>
                  <p className="text-xs text-muted-foreground">Emerald/Cyan refraction blend for intelligence reports.</p>
                </FacetContainer>

                <FacetContainer
                  variant="cultural"
                  depth={2}
                  interactive="hover"
                  className="bg-card/40 border border-border/60 rounded-xl p-5 space-y-3"
                >
                  <span className="text-xs text-purple-400 font-semibold font-mono">CULTURAL VARIANT</span>
                  <h4 className="text-base font-bold text-foreground">Social Unity</h4>
                  <p className="text-xs text-muted-foreground">Purple/Violet refraction gradient for population stats.</p>
                </FacetContainer>
              </div>
            </div>
          )}

          {/* TAB 4: 5-LEVEL CS INTRO QUIZ */}
          {activeTab === "quiz" && (
            <div className="space-y-6">
              {/* Gamified Header */}
              <div className="flex flex-col gap-3 bg-card border border-border/60 p-4 rounded-2xl shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" /> Kistan's 5-Level CS/JS/TS Fundamentals Track
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edit level files in <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level*.ts</code> to unlock levels!
                  </p>
                </div>

                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs font-mono font-semibold">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-primary">{completedCount} / 5 Levels</span>
                    </div>
                    <div className="w-full bg-accent/40 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-500 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-tabs for Levels 1–5 */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 bg-card border border-border/60 p-1.5 rounded-2xl shadow-sm">
                <button
                  onClick={() => setActiveLevel("lvl1")}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeLevel === "lvl1"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  {l1Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Code2 className="h-4 w-4" />}
                  Lvl 1: Variables
                </button>

                <button
                  onClick={() => l2Unlocked && setActiveLevel("lvl2")}
                  disabled={!l2Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeLevel === "lvl2"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l2Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!l2Unlocked ? <Lock className="h-3.5 w-3.5" /> : l2Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Sliders className="h-4 w-4" />}
                  Lvl 2: Logic
                </button>

                <button
                  onClick={() => l3Unlocked && setActiveLevel("lvl3")}
                  disabled={!l3Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeLevel === "lvl3"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l3Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!l3Unlocked ? <Lock className="h-3.5 w-3.5" /> : l3Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Layers className="h-4 w-4" />}
                  Lvl 3: Arrays
                </button>

                <button
                  onClick={() => l4Unlocked && setActiveLevel("lvl4")}
                  disabled={!l4Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeLevel === "lvl4"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l4Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!l4Unlocked ? <Lock className="h-3.5 w-3.5" /> : l4Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Briefcase className="h-4 w-4" />}
                  Lvl 4: Objects
                </button>

                <button
                  onClick={() => l5Unlocked && setActiveLevel("lvl5")}
                  disabled={!l5Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeLevel === "lvl5"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : l5Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!l5Unlocked ? <Lock className="h-3.5 w-3.5" /> : l5Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Database className="h-4 w-4" />}
                  Lvl 5: Async
                </button>
              </div>

              {/* LEVEL 1: VARIABLES */}
              {activeLevel === "lvl1" && (
                <div className="grid gap-6 md:grid-cols-3">
                  <FacetContainer
                    variant="builder"
                    depth={2}
                    className="md:col-span-2 bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                          <Code2 className="h-5 w-5 text-primary" />
                          Level 1: Variables & Data Formatting
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          File: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level1_variables.ts</code>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowHint(!showHint)}
                        className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {showHint ? "Hide Hint" : "Need Hint?"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Test Assertions</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                          l1Exported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}>
                          {l1Exported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                          <span>Exported <code>formatNationHeader</code> function</span>
                        </div>
                        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                          l1Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}>
                          {l1Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                          <span>Returns <code>"Nation: Faneria | Population: 40M"</code></span>
                        </div>
                      </div>
                    </div>

                    {showHint && (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 text-xs space-y-1.5">
                        <strong>💡 Hint for Level 1:</strong>
                        <p>Open <code>level1_variables.ts</code> and return a template literal:</p>
                        <code className="block bg-background/80 p-2 rounded border border-amber-500/20 font-mono text-primary">
                          return `Nation: ${`name`} | Population: ${`populationMillions`}M`;
                        </code>
                      </div>
                    )}

                    <div className="space-y-4 border-t border-border/40 pt-5">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Interactive Input Canvas</h3>
                      <div className="grid gap-4 sm:grid-cols-2 bg-background/50 border border-border/40 p-4 rounded-xl">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Nation Name</label>
                          <input
                            type="text"
                            value={lvl1Name}
                            onChange={(e) => setLvl1Name(e.target.value)}
                            className="w-full bg-card border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Population (M)</label>
                          <input
                            type="number"
                            value={lvl1Pop}
                            onChange={(e) => setLvl1Pop(Number(e.target.value))}
                            className="w-full bg-card border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  </FacetContainer>

                  <FacetContainer
                    variant="overview"
                    depth={3}
                    className="bg-card/80 backdrop-blur-xl border border-border/80 rounded-2xl p-6 flex flex-col justify-between text-center relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <h3 className="text-xs uppercase tracking-wider text-primary font-semibold font-mono">LIVE FUNCTION OUTPUT</h3>
                      <div className="p-4 bg-background/80 border border-border/60 rounded-xl font-mono text-sm text-primary font-semibold py-8">
                        {l1LiveHeader || "Function returned empty string"}
                      </div>
                    </div>

                    {l1Passed && (
                      <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
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
                    className="md:col-span-2 bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                          <Sliders className="h-5 w-5 text-primary" />
                          Level 2: Economic Tier Classifier (Conditionals)
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          File: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level2_conditionals.ts</code>
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                        l2Exported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}>
                        {l2Exported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                        <span>Exported <code>getEconomicTier</code> function</span>
                      </div>
                      <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                        l2Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}>
                        {l2Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                        <span>Passes Advanced (≥40k), Developing (≥15k), Emerging tests</span>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-border/40 pt-5">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live GDP Per Capita Slider</h3>
                      <div className="space-y-2 bg-background/50 border border-border/40 p-4 rounded-xl">
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
                          className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    </div>
                  </FacetContainer>

                  <FacetContainer
                    variant="overview"
                    depth={3}
                    className="bg-card/80 backdrop-blur-xl border border-border/80 rounded-2xl p-6 flex flex-col justify-between text-center relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      <h3 className="text-xs uppercase tracking-wider text-primary font-semibold">ECONOMIC TIER RESULT</h3>
                      <div className="text-3xl font-black text-foreground py-6">
                        {l2LiveTier || "Empty"}
                      </div>
                    </div>

                    {l2Passed && (
                      <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                        <span>Level 2 Passed! Level 3 Unlocked!</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </FacetContainer>
                </div>
              )}

              {/* LEVEL 3: ARRAYS */}
              {activeLevel === "lvl3" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Level 3: Alliance Stability Filter (.filter())
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level3_arrays.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l3ArrayExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l3ArrayExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>allNations</code> array (≥3 items)</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l3Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l3Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span><code>filterHighStabilityNations</code> filters array correctly</span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Filtered Nations Canvas</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Min Stability:</span>
                        <input
                          type="number"
                          value={lvl3MinStab}
                          onChange={(e) => setLvl3MinStab(Number(e.target.value))}
                          className="w-16 bg-card border border-border/60 rounded px-2 py-1 text-xs text-foreground"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {l3FilteredNations.map((nation, idx) => (
                        <FacetContainer
                          key={idx}
                          variant="overview"
                          depth={2}
                          className="bg-card/60 border border-border/60 p-4 rounded-xl space-y-1.5"
                        >
                          <span className="text-xs text-primary font-semibold">{nation.name}</span>
                          <div className="text-xs text-muted-foreground">GDP: ${nation.gdp}B</div>
                          <div className="text-xs text-emerald-400 font-medium">Stability: {nation.stability}%</div>
                        </FacetContainer>
                      ))}
                    </div>
                  </div>
                </FacetContainer>
              )}

              {/* LEVEL 4: OBJECTS & METHODS */}
              {activeLevel === "lvl4" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Level 4: Treasury Vault Manager (Objects & 'this')
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level4_objects.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l4ObjectExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l4ObjectExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>NationTreasuryVault</code> object</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l4Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l4Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span><code>allocateBudget(amount)</code> mutates reserves via <code>this</code></span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Vault State Inspector</h3>
                    <div className="bg-background/50 border border-border/40 p-6 rounded-xl space-y-4 text-center">
                      <span className="text-xs text-muted-foreground font-mono">CURRENT VAULT RESERVES</span>
                      <div className="text-4xl font-black text-emerald-400">${lvl4Reserves}M</div>
                      <p className="text-xs text-muted-foreground font-mono">{l4StatusString}</p>

                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={() => handleL4Allocate(100)}
                          disabled={!l4MethodExported}
                          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
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
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Level 5: Async Intelligence Dispatcher (Promises)
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/level5_async.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l5FunctionExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l5FunctionExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>async fetchNationIntelReport</code> function</span>
                    </div>
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      l5Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {l5Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Promise resolves to IntelReport object</span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Async Intel Dispatcher</h3>
                    <div className="bg-background/50 border border-border/40 p-6 rounded-xl space-y-4 text-center">
                      <button
                        onClick={handleLvl5RunIntel}
                        disabled={lvl5Loading || !l5FunctionExported}
                        className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-40"
                      >
                        {lvl5Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Execute await fetchNationIntelReport("faneria")
                      </button>

                      {lvl5Result && (
                        <div className="bg-card border border-border/60 p-4 rounded-xl max-w-sm mx-auto space-y-1 text-left">
                          <span className="text-xs text-primary font-mono font-semibold">PROMISE FULFILLED</span>
                          <div className="text-sm font-bold text-foreground">Nation: {lvl5Result.nation}</div>
                          <div className="text-xs text-emerald-400 font-semibold">Intel Score: {lvl5Result.intelScore} / 100</div>
                          <div className="text-xs text-muted-foreground">Status: {lvl5Result.status}</div>
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
