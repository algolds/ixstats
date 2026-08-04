"use client";

import React, { useState, useTransition } from "react";
import { FacetContainer } from "~/components/ui/facet-container";
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
} from "lucide-react";

// Import Kistan's challenge files
import * as Challenge1 from "./challenges/challenge1_calculator";
import * as Challenge2 from "./challenges/challenge2_grid";
import * as Challenge3 from "./challenges/challenge3_methods";
import * as Challenge4 from "./challenges/challenge4_async";

export default function SandboxPage() {
  // Top-level Navigation Tabs
  const [activeTab, setActiveTab] = useState<"sim" | "trpc" | "design" | "quiz">("sim");

  // Sub-tabs inside Quiz mode
  const [activeQuizTab, setActiveQuizTab] = useState<"mod1" | "mod2" | "mod3" | "mod4">("mod1");

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
  // TAB 3: DESIGN PHYSICS STATE
  // ==========================================
  const [boxDepth, setBoxDepth] = useState<1 | 2 | 3 | 4>(2);
  const [refractionEnabled, setRefractionEnabled] = useState(true);

  // ==========================================
  // TAB 4: QUIZ / CHALLENGES VALIDATION STATE
  // ==========================================
  // Module 1
  const [m1TaxRate, setM1TaxRate] = useState(25);
  const [m1Population, setM1Population] = useState(40);
  const m1Exported = typeof Challenge1.calculateTaxYield === "function";
  const m1TestCalc = m1Exported ? Challenge1.calculateTaxYield(20, 50) : 0;
  const m1Passed = m1Exported && m1TestCalc === 1000;
  const m1CalculatedYield = m1Exported ? Challenge1.calculateTaxYield(m1TaxRate, m1Population) : 0;

  // Module 2
  const m2ArrayExported = Array.isArray(Challenge2.nations) && Challenge2.nations.length >= 3;
  const m2FormatExported = typeof Challenge2.formatNationCard === "function";
  const m2TestFormat = m2FormatExported && m2ArrayExported ? Challenge2.formatNationCard(Challenge2.nations[0]) : "";
  const m2Passed = m2ArrayExported && m2FormatExported && m2TestFormat.length > 0;

  // Module 3
  const [m3Reserves, setM3Reserves] = useState(500);
  const m3ObjectExported = !!Challenge3.NationTreasury && typeof Challenge3.NationTreasury === "object";
  const m3MethodExported = m3ObjectExported && typeof Challenge3.NationTreasury.addReserves === "function";
  const handleM3AddReserves = (amount: number) => {
    if (m3MethodExported) {
      Challenge3.NationTreasury.addReserves(amount);
      setM3Reserves(Challenge3.NationTreasury.reserves);
    }
  };
  const m3Passed = m3MethodExported && m3Reserves > 500;

  // Module 4
  const [m4Result, setM4Result] = useState<{ nation: string; intelScore: number } | null>(null);
  const [m4Loading, setM4Loading] = useState(false);
  const [, startM4Transition] = useTransition();
  const m4FunctionExported = typeof Challenge4.fetchNationIntelligence === "function";
  const handleM4RunIntel = () => {
    if (!m4FunctionExported) return;
    setM4Loading(true);
    startM4Transition(async () => {
      try {
        const res = await Challenge4.fetchNationIntelligence("Faneria");
        setM4Result(res);
      } catch (e) {
        console.error("Module 4 error:", e);
      } finally {
        setM4Loading(false);
      }
    });
  };
  const m4Passed = m4FunctionExported && !!m4Result && m4Result.intelScore > 0;

  // Progress
  const completedCount = (m1Passed ? 1 : 0) + (m2Passed ? 1 : 0) + (m3Passed ? 1 : 0) + (m4Passed ? 1 : 0);
  const progressPercent = (completedCount / 4) * 100;
  const m2Unlocked = m1Passed;
  const m3Unlocked = m1Passed && m2Passed;
  const m4Unlocked = m1Passed && m2Passed && m3Passed;
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="relative min-h-screen bg-background p-6 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block (No Sparkles Icon) */}
        <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Labs Sandbox
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              A premium, Facet-compliant playground to test simulation logic, tRPC endpoints, design materials, and IDE challenges.
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
            onClick={() => setActiveTab("design")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "design"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <Layers className="h-4 w-4" />
            Design Physics
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
          {/* ==================================================== */}
          {/* TAB 1: SIMULATION CONTROLS */}
          {/* ==================================================== */}
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
                  {/* Tax Rate Slider */}
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

                  {/* Defense Spending Slider */}
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

                  {/* Education Spending Slider */}
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

          {/* ==================================================== */}
          {/* TAB 2: tRPC QUERY CHECK */}
          {/* ==================================================== */}
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

          {/* ==================================================== */}
          {/* TAB 3: DESIGN PHYSICS */}
          {/* ==================================================== */}
          {activeTab === "design" && (
            <div className="space-y-6">
              <FacetContainer
                variant="global"
                depth={2}
                className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-4"
              >
                <h2 className="text-xl font-semibold text-foreground">Glass Physics Controls</h2>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Box Depth (Z-axis):</span>
                    <select
                      value={boxDepth}
                      onChange={(e) => setBoxDepth(Number(e.target.value) as any)}
                      className="bg-card border border-border/60 rounded-lg px-2.5 py-1 text-sm text-foreground"
                    >
                      <option value="1">Depth 1 (Low)</option>
                      <option value="2">Depth 2 (Standard)</option>
                      <option value="3">Depth 3 (High)</option>
                      <option value="4">Depth 4 (Max)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refractionEnabled}
                      onChange={(e) => setRefractionEnabled(e.target.checked)}
                      className="rounded border-border/60 bg-card text-primary focus:ring-primary"
                    />
                    Enable Refraction Blend
                  </label>
                </div>
              </FacetContainer>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((depthLevel) => (
                  <FacetContainer
                    key={depthLevel}
                    variant="builder"
                    depth={depthLevel as any}
                    enableRefraction={refractionEnabled}
                    interactive="hover"
                    className="bg-card/40 border border-border/60 rounded-xl p-5 flex flex-col justify-between h-[180px] hover:border-primary/40 transition-colors"
                  >
                    <div>
                      <span className="text-xs text-primary font-semibold">LAYER</span>
                      <h3 className="text-lg font-bold text-foreground mt-1">Z-Depth {depthLevel}</h3>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {depthLevel === 1 && "Lies flat on background surface."}
                      {depthLevel === 2 && "Default standard elevation index."}
                      {depthLevel === 3 && "High layered dashboard module."}
                      {depthLevel === 4 && "Floating popover/modal layer depth."}
                    </p>
                  </FacetContainer>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: IDE QUIZZES & CHALLENGES */}
          {/* ==================================================== */}
          {activeTab === "quiz" && (
            <div className="space-y-6">
              {/* Gamified Progress Bar Header */}
              <div className="flex flex-col gap-3 bg-card border border-border/60 p-4 rounded-2xl shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" /> Kistan's IDE Challenge System
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edit challenge files in <code className="text-primary font-mono">src/app/labs/sandbox/challenges/</code> to unlock modules!
                  </p>
                </div>

                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs font-mono font-semibold">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-primary">{completedCount} / 4 Done</span>
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

              {/* Sub-tabs inside Quiz mode */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-card border border-border/60 p-1.5 rounded-2xl shadow-sm">
                <button
                  onClick={() => setActiveQuizTab("mod1")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    activeQuizTab === "mod1"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  {m1Passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Sliders className="h-4 w-4" />}
                  Mod 1: Calculator
                </button>

                <button
                  onClick={() => m2Unlocked && setActiveQuizTab("mod2")}
                  disabled={!m2Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    activeQuizTab === "mod2"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : m2Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!m2Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : m2Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                  Mod 2: Object Grid
                </button>

                <button
                  onClick={() => m3Unlocked && setActiveQuizTab("mod3")}
                  disabled={!m3Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    activeQuizTab === "mod3"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : m3Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!m3Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : m3Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Mod 3: Methods & 'this'
                </button>

                <button
                  onClick={() => m4Unlocked && setActiveQuizTab("mod4")}
                  disabled={!m4Unlocked}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    activeQuizTab === "mod4"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : m4Unlocked
                      ? "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      : "opacity-40 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  {!m4Unlocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : m4Passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Mod 4: Async Pipelines
                </button>
              </div>

              {/* Quiz Module 1 */}
              {activeQuizTab === "mod1" && (
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
                          Module 1: The Reactive State Calculator
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          File to edit: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/challenge1_calculator.ts</code>
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

                    {/* Test Assertions */}
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Test Assertions</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                          m1Exported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}>
                          {m1Exported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                          <span>Exported <code>calculateTaxYield</code> function</span>
                        </div>

                        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                          m1Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                        }`}>
                          {m1Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                          <span>Returns formula <code>(taxRate * population * 10)</code></span>
                        </div>
                      </div>
                    </div>

                    {showHint && (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 text-xs space-y-1.5">
                        <strong>💡 Hint for Module 1:</strong>
                        <p>Open <code>challenge1_calculator.ts</code> in your IDE and update the function return line to:</p>
                        <code className="block bg-background/80 p-2 rounded border border-amber-500/20 font-mono text-primary">
                          return taxRate * population * 10;
                        </code>
                      </div>
                    )}

                    {/* Live Output Canvas */}
                    <div className="space-y-4 border-t border-border/40 pt-5">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live UI Preview Canvas</h3>
                      <div className="space-y-4 bg-background/50 border border-border/40 p-4 rounded-xl">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax Rate</span>
                            <span className="font-bold text-primary">{m1TaxRate}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={m1TaxRate}
                            onChange={(e) => setM1TaxRate(Number(e.target.value))}
                            className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Population</span>
                            <span className="font-bold text-primary">{m1Population} Million</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="200"
                            value={m1Population}
                            onChange={(e) => setM1Population(Number(e.target.value))}
                            className="w-full h-1.5 bg-accent/40 rounded-lg appearance-none cursor-pointer accent-primary"
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
                      <h3 className="text-xs uppercase tracking-wider text-primary font-semibold">Calculated Revenue Output</h3>
                      <div className="text-5xl font-black text-foreground py-4 transition-all duration-300">
                        ${m1CalculatedYield}M
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Rendered live by executing <code>calculateTaxYield({m1TaxRate}, {m1Population})</code>
                      </p>
                    </div>

                    {m1Passed && (
                      <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                        <span>Module 1 Passed! Module 2 Unlocked!</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </FacetContainer>
                </div>
              )}

              {/* Quiz Module 2 */}
              {activeQuizTab === "mod2" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Module 2: Object Array Grid Renderer (.map())
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File to edit: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/challenge2_grid.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m2ArrayExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m2ArrayExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>nations</code> array with ≥3 objects</span>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m2FormatExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m2FormatExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>formatNationCard</code> helper function</span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Mapped Facet Cards Canvas</h3>
                    {!m2Passed ? (
                      <div className="p-8 text-center bg-background/50 border border-border/40 rounded-xl text-muted-foreground text-sm">
                        Complete the TODOs in <code>challenge2_grid.ts</code> to render the live object grid!
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {Challenge2.nations.map((nation, idx) => (
                          <FacetContainer
                            key={idx}
                            variant="overview"
                            depth={2}
                            className="bg-card/60 border border-border/60 p-4 rounded-xl space-y-2 hover:border-primary/40 transition-colors"
                          >
                            <span className="text-xs text-primary font-mono font-semibold">NATION #{idx + 1}</span>
                            <h4 className="text-lg font-bold text-foreground">{nation.name}</h4>
                            <div className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                              {Challenge2.formatNationCard(nation)}
                            </div>
                          </FacetContainer>
                        ))}
                      </div>
                    )}
                  </div>
                </FacetContainer>
              )}

              {/* Quiz Module 3 */}
              {activeQuizTab === "mod3" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Module 3: Object Methods & 'this' Binding
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File to edit: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/challenge3_methods.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m3ObjectExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m3ObjectExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>NationTreasury</code> object</span>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m3MethodExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m3MethodExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span><code>addReserves(amount)</code> mutates internal state via <code>this</code></span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Treasury State Inspector</h3>
                    <div className="bg-background/50 border border-border/40 p-6 rounded-xl space-y-4 text-center">
                      <span className="text-xs text-muted-foreground font-mono">CURRENT TREASURY RESERVES</span>
                      <div className="text-4xl font-black text-emerald-400">${m3Reserves}M</div>

                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={() => handleM3AddReserves(100)}
                          disabled={!m3MethodExported}
                          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                        >
                          Call NationTreasury.addReserves(100)
                        </button>
                      </div>
                    </div>
                  </div>
                </FacetContainer>
              )}

              {/* Quiz Module 4 */}
              {activeQuizTab === "mod4" && (
                <FacetContainer
                  variant="builder"
                  depth={2}
                  className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Module 4: Async Pipelines & Promises
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        File to edit: <code className="text-primary font-mono">src/app/labs/sandbox/challenges/challenge4_async.ts</code>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m4FunctionExported ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m4FunctionExported ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Exported <code>async fetchNationIntelligence</code> function</span>
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      m4Passed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      {m4Passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>Promise resolves to <code>{`{ nation, intelScore }`}</code></span>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-5">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Async Promise Dispatcher</h3>
                    <div className="bg-background/50 border border-border/40 p-6 rounded-xl space-y-4 text-center">
                      <button
                        onClick={handleM4RunIntel}
                        disabled={m4Loading || !m4FunctionExported}
                        className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-40"
                      >
                        {m4Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Execute await fetchNationIntelligence("Faneria")
                      </button>

                      {m4Result && (
                        <div className="bg-card border border-border/60 p-4 rounded-xl max-w-sm mx-auto space-y-1 text-left">
                          <span className="text-xs text-primary font-mono font-semibold">PROMISE FULFILLED</span>
                          <div className="text-sm font-bold text-foreground">Nation: {m4Result.nation}</div>
                          <div className="text-xs text-emerald-400 font-semibold">Intel Score: {m4Result.intelScore} / 100</div>
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
