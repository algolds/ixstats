# Kistan Developer Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a high-fidelity, interactive developer sandbox and play area for Kistan at `/labs/sandbox` (`src/app/labs/sandbox/page.tsx`) that demonstrates client state interactions, tRPC API queries, and the Facet design system.

**Architecture:** A Next.js Client Component featuring a three-tab dashboard grid (Simulation, tRPC Database, and Facet Design) wrapped in glassmorphism layouts.

**Tech Stack:** React 19, Next.js 16 (App Router), Lucide React (icons), and tRPC React queries.

## Global Constraints
- **Framework versions:** React 19.2.6, Next.js 16.2.6, Tailwind CSS 4.3.0, Prisma 6.19.3.
- **Styling:** Vanilla CSS & Tailwind v4 classes with Glass Physics ("Facet") design tokens.
- **Clean builds:** The project must compile successfully without warnings or Typecheck errors.

---

### Task 1: Create Sandbox Page Component

**Files:**
- Create: `src/app/labs/sandbox/page.tsx`

**Interfaces:**
- Consumes: `~/components/ui/facet-container`, `~/hooks/usePermissions`, `~/trpc/react`
- Produces: Default export `SandboxPage` component rendering `/labs/sandbox`

- [ ] **Step 1: Write the Sandbox Page Component code**

Write the complete code to `src/app/labs/sandbox/page.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { FacetContainer } from "~/components/ui/facet-container";
import { usePermissions } from "~/hooks/usePermissions";
import { api } from "~/trpc/react";
import { Loader2, Sliders, Database, Layers, Sparkles, AlertCircle } from "lucide-react";

export default function SandboxPage() {
  const [activeTab, setActiveTab] = useState<"sim" | "trpc" | "design">("sim");

  // Tab 1: Simulation State
  const [taxRate, setTaxRate] = useState(25);
  const [defenseSpending, setDefenseSpending] = useState(40);
  const [educationSpending, setEducationSpending] = useState(30);

  // Simple reactive simulation formula
  const calculatedStability = Math.max(
    0,
    Math.min(100, Math.round(75 - taxRate * 0.6 + defenseSpending * 0.3 + educationSpending * 0.5))
  );

  // Tab 2: Full-Stack tRPC query
  const { data: profileData, isLoading: profileLoading, error: profileError } =
    api.users.getCurrentUserWithRole.useQuery(undefined, {
      retry: false,
      refetchOnWindowFocus: false,
    });

  // Tab 3: Design Physics State
  const [boxDepth, setBoxDepth] = useState<1 | 2 | 3 | 4>(2);
  const [refractionEnabled, setRefractionEnabled] = useState(true);

  return (
    <div className="relative min-h-screen bg-[#07090e] p-6 text-slate-100 md:p-8">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-500/5 blur-[150px] pointer-events-none" />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Block */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/5 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-400" />
              Labs Sandbox
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              A premium, Facet-compliant playground to test simulation logic, tRPC API endpoints, and design materials.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-slate-350 self-start md:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Sandbox Active
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-white/5 border border-white/10 p-1 rounded-xl max-w-md">
          <button
            onClick={() => setActiveTab("sim")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "sim"
                ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-950/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Simulation
          </button>
          <button
            onClick={() => setActiveTab("trpc")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "trpc"
                ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-950/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Database className="h-4 w-4" />
            tRPC Query
          </button>
          <button
            onClick={() => setActiveTab("design")}
            className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "design"
                ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-950/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="h-4 w-4" />
            Design Physics
          </button>
        </div>

        {/* Tab content area */}
        <div className="mt-4">
          {activeTab === "sim" && (
            <div className="grid gap-6 md:grid-cols-3">
              <FacetContainer
                variant="builder"
                depth={2}
                className="md:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6"
              >
                <h2 className="text-xl font-semibold text-white">Simulation Controls</h2>
                <div className="space-y-4">
                  {/* Tax Rate Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-350">Income Tax Rate</span>
                      <span className="font-bold text-indigo-400">{taxRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Defense Spending Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-350">Defense Allocation</span>
                      <span className="font-bold text-indigo-400">{defenseSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={defenseSpending}
                      onChange={(e) => setDefenseSpending(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Education Spending Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-350">Education & Infrastructure</span>
                      <span className="font-bold text-indigo-400">{educationSpending}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={educationSpending}
                      onChange={(e) => setEducationSpending(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </FacetContainer>

              <FacetContainer
                variant="overview"
                depth={3}
                className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-6 flex flex-col justify-between text-center relative overflow-hidden"
              >
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Stability Index</h3>
                  <div className="text-6xl font-black text-white py-4 transition-all duration-300">
                    {calculatedStability}
                  </div>
                  <p className="text-slate-400 text-xs">
                    Simulated index calculated reactively on local state changes.
                  </p>
                </div>
                <div className="mt-6 border-t border-white/5 pt-4 text-left text-xs text-slate-350 space-y-1">
                  <div>• High taxes reduce citizen approval.</div>
                  <div>• Defense boost buffers instability.</div>
                  <div>• Education investment yields long term stability.</div>
                </div>
              </FacetContainer>
            </div>
          )}

          {activeTab === "trpc" && (
            <FacetContainer
              variant="economy"
              depth={2}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">tRPC Database Hook Check</h2>
                <div className="text-xs text-slate-400">Endpoint: api.users.getCurrentUserWithRole</div>
              </div>

              {profileLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <span className="text-slate-400 text-sm">Querying database...</span>
                </div>
              ) : profileError ? (
                <div className="flex items-start gap-3 bg-red-950/30 border border-red-900/50 p-4 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Failed to load profile data.</span>
                    <p className="text-red-350/80 text-xs mt-1">{profileError.message}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-xl text-emerald-400 text-sm">
                    ✅ Success: Database response received cleanly.
                  </div>
                  <div className="bg-[#05060a] border border-white/5 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-indigo-350">
                      {JSON.stringify(profileData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </FacetContainer>
          )}

          {activeTab === "design" && (
            <div className="space-y-6">
              <FacetContainer
                variant="global"
                depth={2}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4"
              >
                <h2 className="text-xl font-semibold text-white">Glass Physics Controls</h2>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Box Depth (Z-axis):</span>
                    <select
                      value={boxDepth}
                      onChange={(e) => setBoxDepth(Number(e.target.value) as any)}
                      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                    >
                      <option value="1">Depth 1 (Low)</option>
                      <option value="2">Depth 2 (Standard)</option>
                      <option value="3">Depth 3 (High)</option>
                      <option value="4">Depth 4 (Max)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refractionEnabled}
                      onChange={(e) => setRefractionEnabled(e.target.checked)}
                      className="rounded border-white/10 bg-white/10 text-indigo-600 focus:ring-indigo-500"
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
                    className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-between h-[180px] hover:border-indigo-500/20"
                  >
                    <div>
                      <span className="text-xs text-indigo-400 font-semibold">LAYER</span>
                      <h3 className="text-lg font-bold text-white mt-1">Z-Depth {depthLevel}</h3>
                    </div>
                    <p className="text-slate-400 text-xs">
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
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit the sandbox code**

Run:
```bash
git add src/app/labs/sandbox/page.tsx
git commit -m "feat: implement interactive developer sandbox under /labs/sandbox"
```
