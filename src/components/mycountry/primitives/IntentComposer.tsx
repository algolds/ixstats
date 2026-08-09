"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Command, Loader2, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { cn } from "~/lib/utils";
import { useCountryData } from "./CountryDataProvider";
import { DirectivePresetsCatalog, DOMESTIC_SUGGESTIONS } from "./composer/DirectivePresetsCatalog";
import { DirectiveTuningControls } from "./composer/DirectiveTuningControls";
import { DirectiveDiffPreview, type ProjectedDiff } from "./composer/DirectiveDiffPreview";

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
  const [intensity, setIntensity] = useState<"measured" | "moderate" | "extreme">("moderate");
  const [department, setDepartment] = useState("Finance & Treasury");
  const [spendingAllocation, setSpendingAllocation] = useState(50);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPolicySheet, setShowPolicySheet] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: status } = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  // Simulation prediction query
  const assembleQuery = api.intent.assemble.useQuery(
    {
      countryId,
      goal,
      intensity,
      department,
      spendingAllocation,
    },
    { enabled: !!countryId && !!goal }
  );

  // Commit mutation
  const commitMutation = api.intent.commit.useMutation({
    onSuccess: (data) => {
      setJustCommitted({ id: data.intent.id, goal });
      setGoal("");
      setQueryInput("");
      setErr(null);
      void utils.intent.getStatus.invalidate();
      void utils.intent.getTree.invalidate();
      onCommitted?.(data);
    },
    onError: (e) => setErr(e.message),
  });

  const handleSurpriseMe = useCallback(() => {
    // Inspect telemetry deficits
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

  return (
    <div className="space-y-5">
      {/* Active Directive Input / Prompt Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-foreground flex items-center gap-2 text-xs font-black tracking-tight">
            <Command className="h-4 w-4 text-amber-500" />
            <span>Tune Custom Executive Directive</span>
          </label>

          <button
            type="button"
            onClick={() => setShowPolicySheet(true)}
            className="flex cursor-pointer items-center gap-1 text-xs font-extrabold text-amber-500 hover:text-amber-400"
          >
            <span>+ Advanced Policy Form</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => {
              setQueryInput(e.target.value);
              setGoal(e.target.value);
            }}
            placeholder="e.g. Expand national healthcare grants, boost naval defense readiness..."
            className="border-border/60 bg-card/60 text-foreground placeholder:text-muted-foreground w-full rounded-xl border p-2.5 text-xs font-semibold focus:ring-1 focus:ring-amber-500/50 focus:outline-hidden"
          />
          {goal && (
            <button
              type="button"
              onClick={() => {
                setGoal("");
                setQueryInput("");
              }}
              className="text-muted-foreground hover:text-foreground text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {justCommitted && !goal && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Enacted: <strong className="font-bold">{justCommitted.goal}</strong>
          </span>
          <button
            onClick={() => {
              setParentId(justCommitted.id);
              setJustCommitted(null);
            }}
            className="ml-auto cursor-pointer rounded-lg border border-emerald-500/40 px-2.5 py-1 font-bold transition-colors hover:bg-emerald-500/20"
          >
            Chain Follow-Up →
          </button>
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-800 dark:text-red-300">
          {err}
        </div>
      )}

      {/* Preset Catalog (when no active goal tuned) */}
      {!goal ? (
        <DirectivePresetsCatalog
          onSelectGoal={(g) => {
            setGoal(g);
            setQueryInput(g);
          }}
          onSurpriseMe={handleSurpriseMe}
        />
      ) : (
        /* Tuning Controls & Projected Statecraft Outcome Diff */
        <div className="space-y-5">
          <DirectiveTuningControls
            intensity={intensity}
            onChangeIntensity={setIntensity}
            department={department}
            onChangeDepartment={setDepartment}
            spendingAllocation={spendingAllocation}
            onChangeSpendingAllocation={setSpendingAllocation}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          />

          <DirectiveDiffPreview
            assembled={(assembleQuery.data as ProjectedDiff) ?? null}
            loading={assembleQuery.isLoading}
            committing={commitMutation.isPending}
            onCommit={() => {
              if (!goal) return;
              commitMutation.mutate({
                countryId,
                goal,
                intensity,
                department,
                spendingAllocation,
                parentId: parentId ?? undefined,
              });
            }}
          />
        </div>
      )}

      {/* Policy Creator Sheet Modal */}
      <PolicyCreatorSheet
        isOpen={showPolicySheet}
        onClose={() => setShowPolicySheet(false)}
        countryId={countryId}
      />
    </div>
  );
});
