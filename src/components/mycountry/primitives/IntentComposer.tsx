"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Command,
  Search,
  CheckCircle2,
  Zap,
  AlertCircle,
  Check,
  Building2,
  Layers,
  X,
  Sparkles,
} from "lucide-react";
import { api } from "~/trpc/react";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { cn } from "~/lib/utils";
import { useCountryData } from "./CountryDataProvider";
import { DirectivePresetsCatalog, DOMESTIC_SUGGESTIONS } from "./composer/DirectivePresetsCatalog";

export interface IntentComposerProps {
  countryId: string;
  initialGoal?: string;
  onCommitted?: (res: any) => void;
}

export const IntentComposer = React.memo(function IntentComposer({
  countryId,
  initialGoal = "",
  onCommitted,
}: IntentComposerProps) {
  const { country } = useCountryData();
  const [goal, setGoal] = useState(initialGoal);
  const [queryInput, setQueryInput] = useState(initialGoal);
  const [tier, setTier] = useState<"measured" | "moderate" | "extreme">("moderate");
  const [showPolicySheet, setShowPolicySheet] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Sync initialGoal prop when passed or changed
  useEffect(() => {
    if (initialGoal) {
      setGoal(initialGoal);
      setQueryInput(initialGoal);
    }
  }, [initialGoal]);

  // Country cooldown & weekly capacity status
  const { data: status } = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  // Simulation prediction query for the active goal
  const hasActiveGoal = Boolean(goal && goal.trim().length >= 2);
  const suggestQuery = api.intent.suggest.useQuery(
    { countryId, goal },
    { enabled: !!countryId && hasActiveGoal }
  );

  // Selected tier package
  const activePackage = useMemo(() => {
    if (!suggestQuery.data?.packages) return null;
    return (
      suggestQuery.data.packages.find((p) => p.tier === tier) ??
      suggestQuery.data.packages[1] ??
      suggestQuery.data.packages[0] ??
      null
    );
  }, [suggestQuery.data?.packages, tier]);

  // Commit mutation
  const commitMutation = api.intent.commit.useMutation({
    onSuccess: (data) => {
      setJustCommitted({ id: data.intent.id, goal });
      setGoal("");
      setQueryInput("");
      setErr(null);
      void utils.intent.getStatus.invalidate();
      void utils.intent.getTree.invalidate();
      void utils.mycountry.getCanonFeed.invalidate();
      onCommitted?.(data);
    },
    onError: (e) => setErr(e.message),
  });

  const handleSurpriseMe = useCallback(() => {
    const crime = country?.crimeRate ?? 40;
    const approval = country?.approvalRating ?? 65;
    const readiness = (country as any)?.militaryReadiness ?? 75;

    let candidates = DOMESTIC_SUGGESTIONS;
    if (crime > 50) {
      candidates = DOMESTIC_SUGGESTIONS.filter((s) => s.category === "Security");
    } else if (readiness < 80) {
      candidates = DOMESTIC_SUGGESTIONS.filter((s) => s.category === "Defense");
    } else if (approval < 50) {
      candidates = DOMESTIC_SUGGESTIONS.filter((s) => s.category === "Social");
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
    setGoal(picked.label);
    setQueryInput(picked.label);
  }, [country]);

  const canCommit = status?.canCommit ?? true;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="border-border/40 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Command className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-extrabold tracking-tight">
              Executive Directives
            </h3>
            <p className="text-muted-foreground text-[11px] font-medium">
              Issue executive decrees to drive national economic, social, and security policy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-extrabold text-amber-900 dark:text-amber-300">
              Capacity: {status.usedThisWeek}/{status.cap} used
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowPolicySheet(true)}
            className="border-border/60 bg-card/60 text-foreground hover:bg-card flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-all active:scale-95"
          >
            <span>+ Policy Sheet</span>
          </button>
        </div>
      </div>

      {/* Hero Unified Search Input (Apple Design) */}
      <div className="relative">
        <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
          <Search className="h-5 w-5 text-amber-500/80" />
        </div>
        <input
          type="text"
          value={queryInput}
          onChange={(e) => {
            setQueryInput(e.target.value);
            setGoal(e.target.value);
          }}
          placeholder="Search directive presets or type a custom goal..."
          className="border-border/70 bg-card/70 text-foreground placeholder:text-muted-foreground/70 focus:bg-card w-full rounded-2xl border py-4 pr-32 pl-12 text-sm font-semibold tracking-tight shadow-md backdrop-blur-xl transition-all duration-200 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden sm:text-base"
        />

        <div className="absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center gap-1.5">
          {goal && (
            <button
              type="button"
              onClick={() => {
                setGoal("");
                setQueryInput("");
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl p-1.5 transition-all active:scale-90"
              title="Clear active directive"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleSurpriseMe}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-900 transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Surprise Me</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {justCommitted && !goal && (
        <div className="animate-in fade-in slide-in-from-top-2 flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-900 backdrop-blur-md dark:text-emerald-300">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span>
            Executive Order Enacted: <strong className="font-bold">{justCommitted.goal}</strong>
          </span>
          <button
            onClick={() => {
              setParentId(justCommitted.id);
              setJustCommitted(null);
            }}
            className="ml-auto cursor-pointer rounded-lg border border-emerald-500/40 px-3 py-1 font-bold transition-all hover:bg-emerald-500/20 active:scale-95"
          >
            Chain Follow-Up →
          </button>
        </div>
      )}

      {/* Error Alert */}
      {err && (
        <div className="animate-in fade-in flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-900 backdrop-blur-md dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{err}</span>
        </div>
      )}

      {/* INTENSITY TIERS & SIMULATION PREVIEW — REVEALED ONLY WHEN DIRECTIVE IS CHOSEN */}
      {hasActiveGoal && (
        <div className="animate-in fade-in slide-in-from-top-3 space-y-5 duration-200">
          {/* Active Directive Badge Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-900 backdrop-blur-md dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Selected Goal: &ldquo;{goal}&rdquo;</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setGoal("");
                setQueryInput("");
              }}
              className="text-muted-foreground hover:text-foreground text-[11px] font-extrabold underline transition-colors"
            >
              Change Directive
            </button>
          </div>

          {/* Intensity Tier Selection Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>Executive Intensity Tier</span>
              </label>
              {status && (
                <span className="text-muted-foreground font-mono text-[11px] font-semibold">
                  Weekly Directives: {status.usedThisWeek}/{status.cap} used
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  id: "measured" as const,
                  label: "Measured",
                  defaultCap: "-15 CivCap",
                  defaultDesc: "Targeted administrative adjustment with low political friction.",
                  borderCls:
                    "border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300",
                  badgeCls: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
                },
                {
                  id: "moderate" as const,
                  label: "Moderate",
                  defaultCap: "-35 CivCap",
                  defaultDesc:
                    "Comprehensive structural reform carrying moderate stakeholder interest.",
                  borderCls:
                    "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-300",
                  badgeCls: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
                },
                {
                  id: "extreme" as const,
                  label: "Extreme",
                  defaultCap: "-60 CivCap",
                  defaultDesc: "Transformative executive decree reshaping statecraft baselines.",
                  borderCls: "border-red-500/50 bg-red-500/10 text-red-950 dark:text-red-300",
                  badgeCls: "bg-red-500/20 text-red-800 dark:text-red-300",
                },
              ].map((tierItem) => {
                const isSelected = tier === tierItem.id;
                const pkg = suggestQuery.data?.packages.find((p) => p.tier === tierItem.id);
                const civCapDisplay = pkg?.civCapCost
                  ? `-${pkg.civCapCost} CivCap`
                  : tierItem.defaultCap;

                return (
                  <button
                    key={tierItem.id}
                    type="button"
                    onClick={() => setTier(tierItem.id)}
                    className={cn(
                      "relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98]",
                      isSelected
                        ? cn(tierItem.borderCls, "shadow-lg ring-2 ring-amber-500/50")
                        : "border-border/40 bg-card/40 text-muted-foreground hover:bg-card/80 hover:text-foreground"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold">{tierItem.label}</span>
                        <span
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold",
                            tierItem.badgeCls
                          )}
                        >
                          {civCapDisplay}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed font-medium opacity-90">
                        {pkg?.title ?? tierItem.defaultDesc}
                      </p>
                    </div>

                    {pkg?.risk && (
                      <div className="mt-3 flex items-center justify-between font-mono text-[10px] font-bold uppercase opacity-80">
                        <span>Risk: {pkg.risk}</span>
                        <span>Acceptance: {pkg.acceptance}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulation Outcome & Enactment Panel */}
          <div className="animate-in fade-in space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 backdrop-blur-xl">
            {suggestQuery.isLoading ? (
              <div className="flex animate-pulse items-center justify-center p-6 text-xs font-bold text-amber-500">
                <Zap className="mr-2 h-4 w-4 animate-bounce" />
                <span>Assembling Statecraft Simulation Packages...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h4 className="text-foreground text-xs font-extrabold tracking-tight">
                      Projected Statecraft Outcome ({tier.toUpperCase()} TIER)
                    </h4>
                  </div>
                  {activePackage?.civCapCost && (
                    <span className="font-mono text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
                      -{activePackage.civCapCost} CivCap Cost
                    </span>
                  )}
                </div>

                {/* Package Blurb */}
                {activePackage?.blurb && (
                  <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                    {activePackage.blurb}
                  </p>
                )}

                {/* Specific Policy Levers & Changes */}
                {activePackage?.changes && activePackage.changes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-foreground text-[10px] font-extrabold tracking-wider uppercase">
                      Proposed Policy Levers & Budget Shifts
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activePackage.changes.map((c, idx) => (
                        <div
                          key={idx}
                          className="border-border/50 bg-card/60 flex items-start gap-2.5 rounded-xl border p-2.5 text-xs backdrop-blur-md"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <div>
                            <strong className="text-foreground font-bold">{c.label}</strong>
                            <p className="text-muted-foreground text-[11px] leading-snug">
                              {c.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Consequences Badges */}
                {activePackage?.consequences && activePackage.consequences.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activePackage.consequences.map((cons, idx) => {
                      const isPositive = cons.operation === "add";
                      return (
                        <span
                          key={idx}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-extrabold",
                            isPositive
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-950 dark:text-emerald-300"
                              : "border-red-500/40 bg-red-500/15 text-red-950 dark:text-red-300"
                          )}
                        >
                          {isPositive ? "+" : "-"}
                          {cons.value} {cons.targetField}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Aligned Power Broker Status */}
                {suggestQuery.data?.broker && (
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2.5 text-xs text-cyan-950 backdrop-blur-md dark:text-cyan-300">
                    <Building2 className="h-4 w-4 shrink-0 text-cyan-500" />
                    <span>
                      Aligned Power Broker: <strong>{suggestQuery.data.broker.name}</strong> (
                      {suggestQuery.data.broker.satisfied ? "Satisfied" : "Neutral"})
                    </span>
                  </div>
                )}

                {/* Enact Button */}
                <button
                  type="button"
                  disabled={commitMutation.isPending || !canCommit}
                  onClick={() => {
                    if (!goal) return;
                    commitMutation.mutate({
                      countryId,
                      goal,
                      tier,
                      parentId: parentId ?? undefined,
                    });
                  }}
                  className="w-full cursor-pointer rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-3.5 text-xs font-bold tracking-tight text-slate-950 shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {commitMutation.isPending
                    ? "Enacting Executive Order..."
                    : !canCommit
                      ? "Executive Cooldown Active"
                      : `Enact Executive Order (${tier.toUpperCase()} TIER)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Unified Preset Catalog Grid */}
      <DirectivePresetsCatalog
        activeGoal={goal}
        searchQuery={queryInput}
        onSelectGoal={(g) => {
          setGoal(g);
          setQueryInput(g);
        }}
      />

      {/* Custom Policy Sheet Modal */}
      <PolicyCreatorSheet
        open={showPolicySheet}
        onOpenChange={(op) => setShowPolicySheet(op)}
        countryId={countryId}
      />
    </div>
  );
});
