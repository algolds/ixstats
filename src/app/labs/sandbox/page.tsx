"use client";

import React, { useState, useTransition } from "react";
import { FacetContainer } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { Loader2, Sliders, Database, Layers, Sparkles, AlertCircle, Trophy, Zap, Code2, Play } from "lucide-react";

/**
 * Kistan's Developer Sandbox & Knowledge Testing Lab
 * 
 * Theme Compliant: Uses semantic Tailwind tokens (bg-background, bg-card, border-border, text-muted-foreground)
 * Easter Eggs & Knowledge Tests: Contains 3 interactive code challenges for Kistan to test his understanding of JS/TS concepts.
 */
export default function SandboxPage() {
  const [activeTab, setActiveTab] = useState<"sim" | "trpc" | "design" | "quiz">("sim");

  // ==========================================
  // TAB 1: REACTIVE SIMULATION STATE
  // ==========================================
  const [taxRate, setTaxRate] = useState(25);
  const [defenseSpending, setDefenseSpending] = useState(40);
  const [educationSpending, setEducationSpending] = useState(30);

  // Reactive calculation formula (Pure logic)
  const calculatedStability = Math.max(
    0,
    Math.min(100, Math.round(75 - taxRate * 0.6 + defenseSpending * 0.3 + educationSpending * 0.5))
  );

  // KISTAN EASTER EGG #1: Const Object Mutation Test
  // Notice that 'nationalTreasury' is declared with 'const'!
  // Can we modify 'nationalTreasury.reserves' inside the method below? YES!
  const [treasuryState, setTreasuryState] = useState(500);
  const [easterEgg1Unlocked, setEasterEgg1Unlocked] = useState(false);

  const handleInjectEmergencyFund = () => {
    // Demonstrates mutating properties of an object reference
    const nationalTreasury = {
      country: "Faneria",
      reserves: treasuryState,
      injectCapital(amount: number) {
        this.reserves += amount; // 'this' automatically points to nationalTreasury
      },
    };

    nationalTreasury.injectCapital(100);
    setTreasuryState(nationalTreasury.reserves);
    if (nationalTreasury.reserves >= 800) {
      setEasterEgg1Unlocked(true);
    }
  };

  // ==========================================
  // TAB 2: tRPC & ASYNC PIPELINE DEMO
  // ==========================================
  const { data: profileData, isLoading: profileLoading, error: profileError } =
    api.users.getCurrentUserWithRole.useQuery(undefined, {
      retry: false,
      refetchOnWindowFocus: false,
    });

  // KISTAN EASTER EGG #2: Coding Dominoes (Serial vs Parallel Async Race)
  const [isRacing, startRaceTransition] = useTransition();
  const [raceResults, setRaceResults] = useState<{ serialMs: number; parallelMs: number } | null>(null);

  const runAsyncDominoRace = () => {
    startRaceTransition(async () => {
      // Mock async delay function returning a Promise
      const simulateAsyncWork = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // 1. SERIAL DOMINOES (await one by one)
      const serialStart = performance.now();
      await simulateAsyncWork(300);
      await simulateAsyncWork(300);
      await simulateAsyncWork(300);
      const serialEnd = performance.now();

      // 2. PARALLEL DOMINOES (Promise.all concurrent execution)
      const parallelStart = performance.now();
      await Promise.all([simulateAsyncWork(300), simulateAsyncWork(300), simulateAsyncWork(300)]);
      const parallelEnd = performance.now();

      setRaceResults({
        serialMs: Math.round(serialEnd - serialStart),
        parallelMs: Math.round(parallelEnd - parallelStart),
      });
    });
  };

  // ==========================================
  // TAB 3: FACET DESIGN & METHOD SCOPE
  // ==========================================
  const [boxDepth, setBoxDepth] = useState<1 | 2 | 3 | 4>(2);
  const [refractionEnabled, setRefractionEnabled] = useState(true);

  // KISTAN EASTER EGG #3: Detached Method Scope Quiz
  const [scopeQuizResult, setScopeQuizResult] = useState<string | null>(null);

  const testMethodScope = (mode: "attached" | "detached") => {
    const heroObject = {
      heroName: "Kistan",
      getGreeting() {
        return `Commander ${this?.heroName ?? "Unknown"}`;
      },
    };

    if (mode === "attached") {
      // Called in relation to object: heroObject.getGreeting() -> 'this' is heroObject
      setScopeQuizResult(`✅ Attached Call: "${heroObject.getGreeting()}" (this.heroName resolved correctly!)`);
    } else {
      // Detached call: assigning function to loose variable loses 'this' binding
      const detachedFn = heroObject.getGreeting;
      try {
        const result = detachedFn();
        setScopeQuizResult(`⚠️ Detached Call returned: "${result}" ('this' was unbound/lost!)`);
      } catch (err: any) {
        setScopeQuizResult(`❌ Detached Call Failed: ${err.message} ('this' was undefined!)`);
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-background p-6 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block */}
        <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Labs Sandbox
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Interactive theme-compliant playground & knowledge challenges for JS/TS architecture.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-card border border-border/60 rounded-full px-3.5 py-1.5 text-muted-foreground self-start md:self-auto shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Sandbox Active
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-card border border-border/60 p-1.5 rounded-xl max-w-xl shadow-sm">
          <button
            onClick={() => setActiveTab("sim")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "sim"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Simulation
          </button>
          <button
            onClick={() => setActiveTab("trpc")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "trpc"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Database className="h-4 w-4" />
            tRPC Query
          </button>
          <button
            onClick={() => setActiveTab("design")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "design"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Layers className="h-4 w-4" />
            Design Physics
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "quiz"
                ? "bg-amber-600 text-white shadow-md"
                : "text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <Trophy className="h-4 w-4" />
            Quizzes
          </button>
        </div>

        {/* Tab content area */}
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

                {/* Kistan Test #1 Interactive Card */}
                <div className="border-t border-border/40 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-amber-500" />
                      Test #1: Const Object Mutation
                    </div>
                    <span className="text-xs text-muted-foreground">Reserves: ${treasuryState}M</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notice <code className="text-amber-500 font-mono">const nationalTreasury</code> in the source code. Can we call a method to mutate its internal property? Test it below:
                  </p>
                  <button
                    onClick={handleInjectEmergencyFund}
                    className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Call method nationalTreasury.injectCapital(+100M)
                  </button>

                  {easterEgg1Unlocked && (
                    <div className="bg-amber-500/10 border border-amber-500/40 p-3 rounded-lg text-amber-400 text-xs flex items-center gap-2 animate-bounce">
                      <Trophy className="h-4 w-4 shrink-0" />
                      <span><strong>Easter Egg #1 Unlocked!</strong> You proved that <code>const</code> allows mutating nested object properties!</span>
                    </div>
                  )}
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

          {/* TAB 2: tRPC & ASYNC PIPELINES */}
          {activeTab === "trpc" && (
            <div className="space-y-6">
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

              {/* Kistan Test #2: Async Domino Race */}
              <FacetContainer
                variant="builder"
                depth={2}
                className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Test #2: Async "Coding Dominoes" Benchmark
                  </h3>
                  <span className="text-xs text-muted-foreground">Serial vs Promise.all</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Test your domino mental model! Run 3 async operations sequentially (one after another) vs in parallel with <code>Promise.all</code>:
                </p>
                <button
                  onClick={runAsyncDominoRace}
                  disabled={isRacing}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isRacing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Run Async Race
                </button>

                {raceResults && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="bg-card border border-border/60 p-4 rounded-xl space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">Sequential (await step by step)</span>
                      <div className="text-2xl font-bold text-foreground">{raceResults.serialMs} ms</div>
                      <p className="text-xs text-muted-foreground">Time = Step 1 + Step 2 + Step 3</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl space-y-1">
                      <span className="text-xs text-emerald-400 font-medium">Parallel (Promise.all)</span>
                      <div className="text-2xl font-bold text-emerald-500">{raceResults.parallelMs} ms 🚀</div>
                      <p className="text-xs text-emerald-400/80">All 3 dominoes fell simultaneously!</p>
                    </div>
                  </div>
                )}
              </FacetContainer>
            </div>
          )}

          {/* TAB 3: DESIGN & SCOPE */}
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

          {/* TAB 4: KISTAN QUIZ & METHOD SCOPE CHALLENGE */}
          {activeTab === "quiz" && (
            <FacetContainer
              variant="builder"
              depth={2}
              className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-amber-500" />
                  Test #3: Method Receiver & 'this' Binding Quiz
                </h2>
                <span className="text-xs text-muted-foreground font-mono">Scope & Context Test</span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Test what happens when a method is called in relation to its object (<strong>attached</strong>) versus when it is extracted into a standalone variable (<strong>detached</strong>):
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => testMethodScope("attached")}
                  className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-semibold transition-all"
                >
                  Run Attached Call: heroObject.getGreeting()
                </button>
                <button
                  onClick={() => testMethodScope("detached")}
                  className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-semibold transition-all"
                >
                  Run Detached Call: const fn = heroObject.getGreeting; fn()
                </button>
              </div>

              {scopeQuizResult && (
                <div className="bg-background border border-border/60 p-4 rounded-xl font-mono text-xs">
                  {scopeQuizResult}
                </div>
              )}
            </FacetContainer>
          )}
        </div>
      </div>
    </div>
  );
}
