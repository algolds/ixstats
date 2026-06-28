# Statecraft Stage 4 (Power Brokers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Power Brokers system as the capstone of the Statecraft engine, summoning interest groups based on government components, satisfying them via department budget thresholds, applying dynamic gameplay lever buffs, and displaying them in a volumetric Facet UI panel.

**Architecture:** 
1. Create a pure-functional Power Broker catalog and derive function (`src/lib/statecraft-power-brokers.ts`).
2. Add a `getPowerBrokers` tRPC endpoint in a new elections sub-router (`src/server/api/routers/elections/brokers.ts`).
3. Interconnect satisfied broker bonuses directly inside the Capacity engine (`player.ts`) and political metrics / Storyteller Effects calculations (`government-component-effects.ts`).
4. Build a theme-compliant dashboard panel (`PowerBrokersPanel.tsx`) and mount it in the MyCountry politics tab view.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, tRPC 11, Prisma 6, Lucide icons, Facet UI design system.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per component or class file
* Style components using Facet UI primitives in `src/components/ui/facet-container.tsx`
* No placeholders (show exact code details)

---

### Task 1: Power Brokers Catalog & Derivation Utility

**Files:**
- Create: `src/lib/statecraft-power-brokers.ts`
- Create: `src/tests/statecraft-power-brokers.test.ts`

**Interfaces:**
- Produces: `deriveBrokers(activeComponents: ComponentType[], spendByCategory: Record<string, number>) => ActiveBroker[]`

- [ ] **Step 1: Create statecraft-power-brokers.ts**
  Create `src/lib/statecraft-power-brokers.ts` containing type definitions, the static catalog of the 5 archetypes, and the derivation logic.
  ```typescript
  import { ComponentType } from "@prisma/client";

  export interface PowerBrokerDefinition {
    id: string;
    name: string;
    description: string;
    requiredComponents: ComponentType[];
    spendCategories: string[];
    minSpendPercent: number;
    bonusDescription: string;
  }

  export interface ActiveBroker {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    satisfied: boolean;
    currentSpend: number;
    requiredSpend: number;
    gapPercent: number;
    bonusDescription: string;
  }

  export const POWER_BROKERS: PowerBrokerDefinition[] = [
    {
      id: "technocrats",
      name: "The Technocrats",
      description: "A coalition of senior civil servants, scientific advisors, and planning experts.",
      requiredComponents: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES],
      spendCategories: ["Science&Tech", "Education", "Commerce"],
      minSpendPercent: 15.0,
      bonusDescription: "-15% domestic policy upkeep (Capacity relief)"
    },
    {
      id: "party",
      name: "The Party",
      description: "The core partisan machinery and loyal political apparatus.",
      requiredComponents: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.OLIGARCHIC_PROCESS],
      spendCategories: ["Interior", "Intelligence", "Justice"],
      minSpendPercent: 15.0,
      bonusDescription: "+10% political stability and +5% leading party support drift"
    },
    {
      id: "generals",
      name: "The Generals",
      description: "The military command council and national defense establishment.",
      requiredComponents: [ComponentType.MILITARY_ADMINISTRATION], // fallback to MILITARY_ENFORCEMENT handled dynamically
      spendCategories: ["Defense"],
      minSpendPercent: 15.0,
      bonusDescription: "+10% military readiness (-5% political stability if Defense spend > 30%)"
    },
    {
      id: "magnates",
      name: "The Magnates",
      description: "The industrial giants, commerce chambers, and private enterprise consortiums.",
      requiredComponents: [ComponentType.OLIGARCHIC_PROCESS, ComponentType.ECONOMIC_INCENTIVES],
      spendCategories: ["Commerce", "Energy"],
      minSpendPercent: 15.0,
      bonusDescription: "+0.5% GDP growth modifier (-3% political stability due to social tension)"
    },
    {
      id: "clergy",
      name: "The Clergy",
      description: "The religious leaders, traditional councils, and moral guardians.",
      requiredComponents: [ComponentType.RELIGIOUS_LEGITIMACY], // fallback to TRADITIONAL_LEGITIMACY handled dynamically
      spendCategories: ["Culture"],
      minSpendPercent: 15.0,
      bonusDescription: "+5% political stability"
    }
  ];

  export function deriveBrokers(
    activeComponents: ComponentType[],
    spendByCategory: Record<string, number>
  ): ActiveBroker[] {
    const componentSet = new Set(activeComponents);

    return POWER_BROKERS.map((def) => {
      // Handle fallback/OR unlocks for Generals and Clergy
      let unlocked = false;
      if (def.id === "generals") {
        unlocked = componentSet.has(ComponentType.MILITARY_ADMINISTRATION) || 
                   componentSet.has(ComponentType.MILITARY_ENFORCEMENT);
      } else if (def.id === "clergy") {
        unlocked = componentSet.has(ComponentType.RELIGIOUS_LEGITIMACY) || 
                   componentSet.has(ComponentType.TRADITIONAL_LEGITIMACY);
      } else {
        unlocked = def.requiredComponents.every((c) => componentSet.has(c));
      }

      // Calculate total spend on the broker's favored categories
      let currentSpend = 0;
      def.spendCategories.forEach((cat) => {
        currentSpend += spendByCategory[cat] || 0;
      });

      const requiredSpend = def.minSpendPercent;
      const satisfied = unlocked && currentSpend >= requiredSpend;
      const gapPercent = Math.max(0, requiredSpend - currentSpend);

      return {
        id: def.id,
        name: def.name,
        description: def.description,
        unlocked,
        satisfied,
        currentSpend: Math.round(currentSpend * 100) / 100,
        requiredSpend,
        gapPercent: Math.round(gapPercent * 100) / 100,
        bonusDescription: def.bonusDescription
      };
    });
  }
  ```

- [ ] **Step 2: Create statecraft-power-brokers.test.ts**
  Create `src/tests/statecraft-power-brokers.test.ts` testing the derivation logic for various component and budget setups.
  ```typescript
  import { ComponentType } from "@prisma/client";
  import { deriveBrokers } from "../lib/statecraft-power-brokers";

  describe("Statecraft Power Brokers Derivation", () => {
    it("should lock all brokers when no components match", () => {
      const active = deriveBrokers([], {});
      active.forEach((b) => {
        expect(b.unlocked).toBe(false);
        expect(b.satisfied).toBe(false);
      });
    });

    it("should unlock Technocrats but keep them unsatisfied when spend is low", () => {
      const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
      const spend = { "Science&Tech": 5.0, Education: 5.0 }; // 10% total, min 15%
      const brokers = deriveBrokers(components, spend);
      const tech = brokers.find((b) => b.id === "technocrats");
      expect(tech?.unlocked).toBe(true);
      expect(tech?.satisfied).toBe(false);
      expect(tech?.gapPercent).toBe(5.0);
    });

    it("should satisfy Technocrats when spend meets the threshold", () => {
      const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
      const spend = { "Science&Tech": 10.0, Education: 6.0 }; // 16% total
      const brokers = deriveBrokers(components, spend);
      const tech = brokers.find((b) => b.id === "technocrats");
      expect(tech?.unlocked).toBe(true);
      expect(tech?.satisfied).toBe(true);
      expect(tech?.gapPercent).toBe(0.0);
    });

    it("should support fallback Traditional unlock for the Clergy", () => {
      const components = [ComponentType.TRADITIONAL_LEGITIMACY];
      const spend = { Culture: 20.0 };
      const brokers = deriveBrokers(components, spend);
      const clergy = brokers.find((b) => b.id === "clergy");
      expect(clergy?.unlocked).toBe(true);
      expect(clergy?.satisfied).toBe(true);
    });
  });
  ```

- [ ] **Step 3: Run the test suite**
  Run: `bun run test -- src/tests/statecraft-power-brokers.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit Task 1 changes**
  ```bash
  git add src/lib/statecraft-power-brokers.ts src/tests/statecraft-power-brokers.test.ts
  git commit -m "feat(statecraft): create power brokers catalog and deriveBrokers logic with tests"
  ```

---

### Task 2: Implement tRPC getPowerBrokers Query

**Files:**
- Create: `src/server/api/routers/elections/brokers.ts`
- Modify: `src/server/api/routers/elections/index.ts`

**Interfaces:**
- Produces: `api.elections.getPowerBrokers({ countryId: string })` router procedure.

- [ ] **Step 1: Create brokers.ts router file**
  Create `src/server/api/routers/elections/brokers.ts` querying the country's components, departments, and active allocations to derive the current Power Brokers list.
  ```typescript
  import { z } from "zod";
  import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
  import { deriveBrokers } from "~/lib/statecraft-power-brokers";

  export const electionsBrokersRouter = createTRPCRouter({
    getPowerBrokers: publicProcedure
      .input(z.object({ countryId: z.string() }))
      .query(async ({ ctx, input }) => {
        // Load active components
        const components = await ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
          select: { componentType: true }
        });

        // Load current budget allocations + department categories
        const allocations = await ctx.db.budgetAllocation.findMany({
          where: { governmentStructure: { countryId: input.countryId } },
          include: {
            department: {
              select: { category: true }
            }
          }
        });

        // Calculate total allocation percentages by department category
        const spendByCategory: Record<string, number> = {};
        allocations.forEach((alloc) => {
          const cat = alloc.department.category;
          spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
        });

        const activeComponentTypes = components.map((c) => c.componentType);
        return deriveBrokers(activeComponentTypes, spendByCategory);
      })
  });
  ```

- [ ] **Step 2: Merge the sub-router**
  Modify `src/server/api/routers/elections/index.ts` to import and merge `electionsBrokersRouter`:
  ```typescript
  import { mergeRouters } from "~/server/api/trpc";
  import { electionsPartiesRouter } from "./parties";
  import { electionsLegislatureRouter } from "./legislature";
  import { electionsElectionsRouter } from "./elections";
  import { electionsBrokersRouter } from "./brokers";

  export const electionsRouter = mergeRouters(
    electionsPartiesRouter,
    electionsLegislatureRouter,
    electionsElectionsRouter,
    electionsBrokersRouter
  );
  ```

- [ ] **Step 3: Commit Task 2 changes**
  ```bash
  git add src/server/api/routers/elections/brokers.ts src/server/api/routers/elections/index.ts
  git commit -m "feat(statecraft): add getPowerBrokers tRPC endpoint"
  ```

---

### Task 3: Apply Broker Bonuses to the Statecraft Simulation Engine

**Files:**
- Modify: `src/lib/government-component-effects.ts`
- Modify: `src/server/api/routers/national-issues/player.ts`
- Modify: `src/lib/politics-drift-cron.ts`

**Interfaces:**
- Consumes: `deriveBrokers` in `src/lib/statecraft-power-brokers.ts`

- [ ] **Step 1: Apply Broker Bonuses to government-component-effects.ts**
  Modify `applyGovernmentComponentEffects` inside `src/lib/government-component-effects.ts` to calculate active satisfied power brokers and write their respective political stability metrics and Storyteller Effects.
  
  *Target `applyGovernmentComponentEffects` (deactivation update):*
  ```typescript
    // Deactivate previous government component and broker effects (prevent stacking)
    const prevIds = await db.storytellerEffect.findMany({
      where: {
        countryId,
        isActive: true,
        OR: [
          { description: { startsWith: "[GovComponent]" } },
          { description: { startsWith: "[BrokerComponent]" } }
        ]
      },
      select: { id: true },
    });
    if (prevIds.length > 0) {
      await db.storytellerEffect.updateMany({
        where: { id: { in: prevIds.map((e) => e.id) } },
        data: { isActive: false },
      });
    }
  ```

  *Target political stability delta recalculation:*
  ```typescript
    // Calculate allocations to derive brokers
    const allocations = await db.budgetAllocation.findMany({
      where: { governmentStructure: { countryId } },
      include: { department: { select: { category: true } } }
    });
    const spendByCategory: Record<string, number> = {};
    allocations.forEach((alloc) => {
      const cat = alloc.department.category;
      spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
    });

    const activeComponentTypes = activeComponents.map((c) => c.componentType);
    const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
    const satisfiedSet = new Set(activeBrokers.filter((b) => b.satisfied).map((b) => b.id));

    // Update GovernmentStructure political metrics
    const deltas = computePoliticalDeltas(activeComponents);
    
    // Apply satisfied broker political metric bonuses
    if (satisfiedSet.has("party")) {
      deltas.politicalStability = (deltas.politicalStability ?? 0) + 0.10; // +10% stability
    }
    if (satisfiedSet.has("clergy")) {
      deltas.politicalStability = (deltas.politicalStability ?? 0) + 0.05; // +5% stability
    }

    // Apply satisfied broker tensions
    if (satisfiedSet.has("generals")) {
      const defenseSpend = spendByCategory["Defense"] || 0;
      if (defenseSpend > 30.0) {
        deltas.politicalStability = (deltas.politicalStability ?? 0) - 0.05; // Over-fed generals trigger tension
      }
    }
    if (satisfiedSet.has("magnates")) {
      deltas.politicalStability = (deltas.politicalStability ?? 0) - 0.03; // Magnates trigger social inequality tension
    }
  ```

  *Target `effectsData.push` section (append broker StorytellerEffects):*
  Insert before `db.storytellerEffect.createMany`:
  ```typescript
    // Build StorytellerEffect records for brokers
    if (satisfiedSet.has("technocrats")) {
      effectsData.push({
        countryId,
        ixTimeTimestamp: now,
        inputType: "CAPACITY_RELIEF",
        value: 0.15,
        duration: 5,
        description: "[BrokerComponent] The Technocrats: -15% domestic policy upkeep",
        isActive: true,
      });
    }
    if (satisfiedSet.has("party")) {
      effectsData.push({
        countryId,
        ixTimeTimestamp: now,
        inputType: "PARTY_INFLUENCE",
        value: 0.05,
        duration: 5,
        description: "[BrokerComponent] The Party: +5% leading-party strength",
        isActive: true,
      });
    }
    if (satisfiedSet.has("generals")) {
      effectsData.push({
        countryId,
        ixTimeTimestamp: now,
        inputType: "MILITARY_READINESS",
        value: 0.10,
        duration: 5,
        description: "[BrokerComponent] The Generals: +10% military readiness",
        isActive: true,
      });
    }
    if (satisfiedSet.has("magnates")) {
      effectsData.push({
        countryId,
        ixTimeTimestamp: now,
        inputType: "GROWTH_RATE_MODIFIER",
        value: 0.005, // +0.5% GDP growth
        duration: 5,
        description: "[BrokerComponent] The Magnates: +0.5% GDP growth modifier",
        isActive: true,
      });
    }
  ```

- [ ] **Step 2: Apply Capacity Upkeep Relief to loadReconContext**
  Modify `loadReconContext` in `src/server/api/routers/national-issues/player.ts` to reduce `govStaff` staff requirements if the Technocrats broker is satisfied.
  
  *Target `loadReconContext` internal logic:*
  ```typescript
  // Around line 38 inside loadReconContext, load current budget allocations:
  const [country, structure, components, pendingRecon, allocations] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, governmentalEfficiency: true },
    }),
    db.governmentStructure.findUnique({
      where: { countryId },
      select: {
        governmentEffectiveness: true,
        departments: { where: { isActive: true }, select: { category: true } },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true },
    }),
    db.nationalIssue.count({ where: { countryId, reconReadyIxTime: { gt: now } } }),
    db.budgetAllocation.findMany({
      where: { governmentStructure: { countryId } },
      include: { department: { select: { category: true } } }
    })
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isTechnocratsSatisfied = activeBrokers.some((b) => b.id === "technocrats" && b.satisfied);

  const effectiveness = structure?.governmentEffectiveness ?? country?.governmentalEfficiency ?? 50;
  const capacity = calculateCivilServiceCapacity(country?.currentPopulation ?? 0, effectiveness);
  
  const govStaff = calculateTotalConsumedStaff(
    components.map((c) => c.componentType as any),
    [],
    []
  );
  
  // Apply 15% domestic policy upkeep Capacity relief if satisfied
  const effectiveGovStaff = isTechnocratsSatisfied ? Math.round(govStaff * 0.85) : govStaff;
  const used = effectiveGovStaff + pendingRecon * RECON_CAPACITY_COST;
  ```
  *(Remember to import `deriveBrokers` at the top of `src/server/api/routers/national-issues/player.ts`: `import { deriveBrokers } from "~/lib/statecraft-power-brokers";`)*

- [ ] **Step 3: Apply Party Support Drift Modifier to politics-drift-cron.ts**
  Modify `runPoliticsDrift` inside `src/lib/politics-drift-cron.ts` to increase the drift strength of the governing party if `The Party` broker is satisfied.
  
  *Target `runPoliticsDrift` internal loop:*
  ```typescript
  // Load current budget allocations to check satisfied brokers:
  const [parties, country, allocations, components] = await Promise.all([
    db.politicalParty.findMany({ where: { countryId, isActive: true } }),
    db.country.findUnique({ where: { id: countryId }, select: { adjustedGdpGrowth: true } }),
    db.budgetAllocation.findMany({
      where: { governmentStructure: { countryId } },
      include: { department: { select: { category: true } } }
    }),
    db.governmentComponent.findMany({
      where: { countryId, isActive: true },
      select: { componentType: true }
    })
  ]);

  const spendByCategory: Record<string, number> = {};
  allocations.forEach((alloc) => {
    const cat = alloc.department.category;
    spendByCategory[cat] = (spendByCategory[cat] || 0) + alloc.allocatedPercent;
  });

  const activeComponentTypes = components.map((c) => c.componentType);
  const activeBrokers = deriveBrokers(activeComponentTypes, spendByCategory);
  const isPartyBrokerSatisfied = activeBrokers.some((b) => b.id === "party" && b.satisfied);

  if (parties.length >= 2) {
    const econMod = clamp((country?.adjustedGdpGrowth ?? 0) * 100, -5, 5);
    const governing = parties.reduce((a, b) => (b.currentSupport > a.currentSupport ? b : a));
    const oppositionSplit = parties.length - 1;

    for (const p of parties) {
      const meanRevert = (p.baseSupport - p.currentSupport) * 0.1;
      
      // The Party satisfied gives +5% base support drift toward governing party
      let partyBrokerEffect = 0;
      if (isPartyBrokerSatisfied) {
        partyBrokerEffect = p.id === governing.id ? 0.5 : -0.5 / oppositionSplit;
      }

      const econEffect = (p.id === governing.id ? econMod : -econMod / oppositionSplit) * 0.3;
      const jitter = ((p.id.charCodeAt(0) % 7) - 3) * 0.1;
      const next = clamp(p.currentSupport + meanRevert + econEffect + partyBrokerEffect + jitter, 1, 99);
  ```
  *(Remember to import `deriveBrokers` at the top of `src/lib/politics-drift-cron.ts`: `import { deriveBrokers } from "~/lib/statecraft-power-brokers";`)*

- [ ] **Step 4: Commit Task 3 changes**
  ```bash
  git add src/lib/government-component-effects.ts src/server/api/routers/national-issues/player.ts src/lib/politics-drift-cron.ts
  git commit -m "feat(statecraft): integrate power broker buffs into simulation calculations, capacity, and party support drift"
  ```

---

### Task 4: Create & Embed the Power Brokers UI Panel

**Files:**
- Create: `src/components/executive/politics/PowerBrokersPanel.tsx`
- Modify: `src/components/mycountry/EnhancedPoliticsContent.tsx`

**Interfaces:**
- Consumes: `api.elections.getPowerBrokers` query hook

- [ ] **Step 1: Create PowerBrokersPanel.tsx**
  Create `src/components/executive/politics/PowerBrokersPanel.tsx` displaying active/satisfied/unsatisfied brokers with a budget allocation progress bar.
  ```typescript
  "use client";

  import React from "react";
  import { api } from "~/trpc/react";
  import { FacetCard } from "~/components/ui/facet-container";
  import { Shield, Sparkles, Building2, Users2, Compass, AlertCircle } from "lucide-react";

  interface PowerBrokersPanelProps {
    countryId: string;
  }

  const BROKER_ICONS: Record<string, React.ComponentType<any>> = {
    technocrats: Compass,
    party: Users2,
    generals: Shield,
    magnates: Building2,
    clergy: Sparkles
  };

  const BROKER_COLORS: Record<string, string> = {
    technocrats: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    party: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    generals: "text-red-500 bg-red-500/10 border-red-500/20",
    magnates: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    clergy: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
  };

  export function PowerBrokersPanel({ countryId }: PowerBrokersPanelProps) {
    const { data: brokers, isLoading } = api.elections.getPowerBrokers.useQuery(
      { countryId },
      { enabled: !!countryId }
    );

    if (isLoading) {
      return (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          Loading power brokers...
        </div>
      );
    }

    const activeBrokers = brokers?.filter((b) => b.unlocked) || [];

    return (
      <div className="flex w-full flex-col gap-4">
        <div>
          <h3 className="text-xs font-bold tracking-wider uppercase opacity-70">
            Power Brokers
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Internal interest groups unlocked by your country structure and budget allocation
          </p>
        </div>

        {activeBrokers.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed border-black/10 py-8 text-center text-xs dark:border-white/10">
            <AlertCircle className="h-6 w-6 opacity-30 mb-2" />
            No Power Brokers are currently active.
            <span className="text-[10px] opacity-75 mt-1">
              Select government components in the editor to summon interest groups.
            </span>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeBrokers.map((broker) => {
              const Icon = BROKER_ICONS[broker.id] || Compass;
              const colorClass = BROKER_COLORS[broker.id] || "text-slate-500 bg-slate-500/10 border-slate-500/20";
              const percent = broker.requiredSpend > 0 
                ? Math.min(100, (broker.currentSpend / broker.requiredSpend) * 100) 
                : 100;

              return (
                <FacetCard
                  key={broker.id}
                  className={`flex flex-col justify-between border p-3.5 transition-all hover:border-black/25 dark:hover:border-white/25 ${
                    broker.satisfied
                      ? "border-emerald-500/25 bg-emerald-500/[0.02]"
                      : "border-black/5 dark:border-white/5"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`rounded p-1 border ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold">{broker.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          broker.satisfied
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        }`}
                      >
                        {broker.satisfied ? "Satisfied" : "Neglected"}
                      </span>
                    </div>

                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {broker.description}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {/* Budget allocation satisfaction bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-medium text-muted-foreground">
                        <span>Favored Budget Allocation</span>
                        <span>{broker.currentSpend}% / {broker.requiredSpend}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                        <div
                          className={`h-full transition-all duration-300 ${
                            broker.satisfied ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="border-t border-black/5 dark:border-white/5 pt-2">
                      <p className="text-[9px] font-semibold text-muted-foreground">
                        ACTIVE EFFECT:
                      </p>
                      <p className={`text-[10px] font-medium mt-0.5 ${
                        broker.satisfied ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {broker.satisfied ? broker.bonusDescription : "Inactive (satisfy budget requirement to activate)"}
                      </p>
                    </div>
                  </div>
                </FacetCard>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Embed PowerBrokersPanel in EnhancedPoliticsContent.tsx**
  Modify `src/components/mycountry/EnhancedPoliticsContent.tsx` to render the newly created `<PowerBrokersPanel />` component directly.
  ```typescript
  // Around line 13: import PowerBrokersPanel
  import { PowerBrokersPanel } from "~/components/executive/politics/PowerBrokersPanel";

  // Inside EnhancedPoliticsContent return, render PowerBrokersPanel below ApprovalPanel:
  <div className="grid gap-3 lg:grid-cols-2">
    <BillsPanel countryId={country.id} />
    <ApprovalPanel countryId={country.id} />
  </div>

  <div className="glass-hierarchy-child border-border rounded-xl border p-4">
    <PowerBrokersPanel countryId={country.id} />
  </div>
  ```

- [ ] **Step 3: Commit Task 4 changes**
  ```bash
  git add src/components/executive/politics/PowerBrokersPanel.tsx src/components/mycountry/EnhancedPoliticsContent.tsx
  git commit -m "feat(statecraft): create and mount PowerBrokersPanel in politics view"
  ```
