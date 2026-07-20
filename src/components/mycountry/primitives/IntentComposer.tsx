"use client";

import React, { useState, useEffect } from "react";
import { Command, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { FacetContainer } from "~/components/ui/facet-container";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { cn } from "~/lib/utils";

type Tone = "good" | "mid" | "bad" | "fog" | "info";

const TONE_CLS: Record<Tone, string> = {
  good: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  mid: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  bad: "text-red-300 bg-red-500/10 border-red-400/20",
  info: "text-blue-300 bg-blue-500/10 border-blue-400/20",
  fog: "text-muted-foreground bg-muted/40 border-border",
};

interface DomesticSuggestion {
  category: string;
  label: string;
  keywords: string[];
  icon: string;
}

const DOMESTIC_SUGGESTIONS: DomesticSuggestion[] = [
  { category: "Economy", label: "Cool the housing market", keywords: ["housing", "market", "rent", "property", "house"], icon: "🏠" },
  { category: "Economy", label: "Create industrial manufacturing jobs", keywords: ["job", "manufacturing", "employ", "labor", "work"], icon: "🏭" },
  { category: "Economy", label: "Increase the minimum wage", keywords: ["wage", "minimum", "pay", "income"], icon: "💵" },
  { category: "Fiscal", label: "Rein in inflation", keywords: ["inflation", "price", "cost"], icon: "📈" },
  { category: "Fiscal", label: "Reduce national debt deficit", keywords: ["debt", "deficit", "spend", "tax"], icon: "📊" },
  { category: "Social", label: "Invest in public school education", keywords: ["education", "school", "teach", "learn"], icon: "📚" },
  { category: "Social", label: "Improve healthcare and hospital access", keywords: ["health", "hospital", "medical", "doctor"], icon: "🏥" },
  { category: "Social", label: "Expand social welfare safety net", keywords: ["welfare", "poverty", "support", "benefit"], icon: "🤝" },
  { category: "Infrastructure", label: "Develop national highway transit", keywords: ["road", "highway", "transit", "infrastructure", "bridge"], icon: "🛣️" },
  { category: "Infrastructure", label: "Upgrade the national energy power grid", keywords: ["grid", "energy", "power", "electricity"], icon: "⚡" },
  { category: "Security", label: "Reduce urban crime rates", keywords: ["crime", "police", "security", "safety", "order"], icon: "👮" },
  { category: "Defense", label: "Modernize national defense forces", keywords: ["military", "navy", "army", "defense", "forces"], icon: "🛡️" },
];

interface IntentComposerProps {
  countryId: string;
  initialGoal?: string;
  onCommitted: (res: any) => void;
}

export function IntentComposer({ countryId, initialGoal = "", onCommitted }: IntentComposerProps) {
  const [q, setQ] = useState(initialGoal);
  const [goal, setGoal] = useState<string | null>(initialGoal || null);
  const [err, setErr] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [chainOf, setChainOf] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    if (initialGoal) {
      setQ(initialGoal);
      setGoal(initialGoal);
    }
  }, [initialGoal]);

  const suggest = api.intent.suggest.useQuery(
    { countryId, goal: goal ?? "" },
    { enabled: !!goal && typeof goal === "string" && goal.trim().length >= 2 }
  );

  React.useEffect(() => {
    if (suggest.error) {
      setErr(suggest.error.message);
      setGoal(null);
    }
  }, [suggest.error]);

  const commitM = api.intent.commit.useMutation({
    onSuccess: (res) => {
      onCommitted(res);
      setGoal(null);
      setQ("");
      setParentId(null);
      setChainOf(null);
      setJustCommitted({ id: res.intent.id, goal: res.intent.goal });
    },
    onError: (e) => setErr(e.message),
  });

  const propose = (g: string) => {
    setErr(null);
    if (g.trim().length >= 2) setGoal(g.trim());
  };

  const commitTier = (tier: string) => {
    setErr(null);
    commitM.mutate({
      countryId,
      goal: goal!,
      tier: tier as any,
      parentId: parentId ?? undefined,
    });
  };

  const data = suggest.data;
  const status = data?.status;
  const canCommit = (status?.canCommit ?? true) && !commitM.isPending;

  return (
    <div className="space-y-3">
      <FacetContainer variant="mycountry" depth={1} enableRefraction={false} className="p-0">
        <div className="flex items-center gap-3 p-4">
          <Command className="h-4 w-4 shrink-0 text-amber-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") propose(q);
            }}
            placeholder="What is your government trying to accomplish?  e.g. make housing affordable"
            className="placeholder:text-muted-foreground/50 facet-refraction-none flex-1 bg-transparent text-[16px] outline-none"
          />
          {suggest.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          ) : (
            <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]">
              ⏎
            </span>
          )}
        </div>
      </FacetContainer>

      {chainOf && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-200">
          ↳ continuing: <span className="font-semibold">{chainOf}</span>
          <button
            onClick={() => {
              setParentId(null);
              setChainOf(null);
            }}
            className="ml-auto text-amber-300/70 hover:text-amber-200"
          >
            ✕
          </button>
        </div>
      )}

      {justCommitted && !goal && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
          ✓ Committed: <span className="font-semibold">{justCommitted.goal}</span>
          <button
            onClick={() => {
              setParentId(justCommitted.id);
              setChainOf(justCommitted.goal);
              setJustCommitted(null);
            }}
            className="ml-auto rounded-md border border-emerald-400/40 px-2 py-0.5 font-semibold hover:bg-emerald-500/20"
          >
            Build on this →
          </button>
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {err}
        </div>
      )}

      {status && !status.canCommit && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          Your government is executing this week's agenda ({status.usedThisWeek}/{status.cap}). New
          intents open after the weekly cooldown.
        </div>
      )}

      {!goal ? (
        <div className="space-y-4">
          {/* Autocomplete Search Matches */}
          {q.trim().length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 shadow-2xl backdrop-blur-md">
              <div className="text-muted-foreground px-2 py-1 text-[10px] font-bold tracking-widest uppercase">
                Matching Suggestions
              </div>
              <div className="mt-1.5 max-h-[220px] overflow-y-auto space-y-1">
                {DOMESTIC_SUGGESTIONS.filter(
                  (s) =>
                    s.label.toLowerCase().includes(q.toLowerCase()) ||
                    s.keywords.some((k) => k.includes(q.toLowerCase()))
                ).map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setQ(s.label);
                      setErr(null);
                      propose(s.label);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all hover:bg-amber-500/10 hover:text-amber-300"
                  >
                    <span className="text-sm">{s.icon}</span>
                    <span className="font-semibold text-foreground/90">{s.label}</span>
                    <span className="text-[9px] text-muted-foreground/60 ml-auto bg-white/5 px-2 py-0.5 rounded uppercase font-black tracking-wider">{s.category}</span>
                  </button>
                ))}
                {DOMESTIC_SUGGESTIONS.filter(
                  (s) =>
                    s.label.toLowerCase().includes(q.toLowerCase()) ||
                    s.keywords.some((k) => k.includes(q.toLowerCase()))
                ).length === 0 && (
                  <div className="text-muted-foreground py-4 text-center text-xs">
                    No matching predefined goals. Press Enter to search custom intent.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Predefined suggestion grid */}
          {q.trim().length === 0 && (
            <div className="space-y-3">
              <div className="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">
                Suggested Domestic Cabinet Goals
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from(new Set(DOMESTIC_SUGGESTIONS.map((s) => s.category))).map((cat) => (
                  <div key={cat} className="rounded-xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
                    <div className="text-amber-400 text-[10px] font-black tracking-wider uppercase border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>{cat}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {DOMESTIC_SUGGESTIONS.filter((s) => s.category === cat).map((s) => (
                        <button
                          key={s.label}
                          onClick={() => {
                            setQ(s.label);
                            setErr(null);
                            propose(s.label);
                          }}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.02] hover:bg-amber-500/[0.04] px-2.5 py-2 text-left text-xs transition-all hover:text-amber-300 text-foreground/80 font-medium active:scale-[0.98]"
                        >
                          <span>{s.icon}</span>
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : suggest.isFetching || !data ? (
        <div className="text-muted-foreground px-1 py-6 text-center text-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-400" /> Your ministries
          are drawing up options…
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="px-1 text-[11px] font-bold tracking-widest text-amber-300/80 uppercase">
            “{goal}” — your government proposes
            {data.category && (
              <span className="text-muted-foreground ml-2 lowercase">
                · {data.category}
              </span>
            )}
          </div>

          {data.packages.map((p: any) => (
            <button
              key={p.tier}
              disabled={!canCommit}
              onClick={() => commitTier(p.tier)}
              className="w-full cursor-pointer rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 text-left shadow-lg transition-[border-color,background-color,transform] duration-150 ease-out hover:border-amber-500/30 hover:bg-amber-500/[0.04] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center justify-between">
                <div className="text-foreground/90 text-[13px] font-bold">{p.title}</div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                    TONE_CLS[p.acceptance as Tone]
                  )}
                >
                  {p.acceptance === "good"
                    ? "Broad support"
                    : p.acceptance === "mid"
                      ? "Contested"
                      : "Hard sell"}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                {p.blurb}
              </div>
              <ul className="mt-2.5 space-y-1.5 border-t border-white/5 pt-2.5">
                {p.changes.map((c: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="mt-[2px] text-xs font-bold text-amber-500">
                      {c.kind === "budget"
                        ? "▤"
                        : c.kind === "policy"
                          ? "◈"
                          : c.kind === "foreign"
                            ? "◇"
                            : "•"}
                    </span>
                    <span className="text-foreground/80 leading-normal">
                      {c.label}
                      <span className="text-muted-foreground/60"> — {c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-muted-foreground/60 mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-bold tracking-wider uppercase">
                <span>{p.risk}</span>
                <span>reserves {p.civCapCost} capacity</span>
              </div>
            </button>
          ))}

          {/* Propose for Deliberation Card (V2 Cabinet Integration) */}
          <button
            onClick={() => {
              setErr(null);
              commitM.mutate({
                countryId,
                goal: goal!,
                tier: "proposed",
                parentId: parentId ?? undefined,
              });
            }}
            className="w-full cursor-pointer rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-out hover:border-amber-500/50 hover:bg-amber-500/10 active:scale-[0.97]"
          >
            <div className="flex items-center justify-between">
              <div className="text-amber-300 text-[13px] font-bold">Propose as Cabinet Goal</div>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 uppercase">
                Schedule meeting
              </span>
            </div>
            <div className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
              Add this goal to the national proposed agenda list. This allows scheduling a dedicated cabinet meeting session to deliberate and select a ministry package. (Bypasses active weekly cooldown).
            </div>
          </button>

          {data.broker && (
            <div className="text-muted-foreground/80 px-1 text-[10px]">
              Acceptance weighted by{" "}
              <span className="text-foreground/80 font-semibold">{data.broker.name}</span>
              {data.broker.unlocked
                ? data.broker.satisfied
                  ? " · satisfied"
                  : " · restless"
                : " · not factor"}
              .
            </div>
          )}

          <div className="flex items-center justify-between px-1 pt-1.5">
            <button
              onClick={() => setGoal(null)}
              className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            >
              ← rethink goal
            </button>
            <button
              onClick={() => setPolicyOpen(true)}
              className="text-[11px] font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Draft custom package →
            </button>
          </div>
        </div>
      )}

      <PolicyCreatorSheet countryId={countryId} open={policyOpen} onOpenChange={setPolicyOpen} />
    </div>
  );
}
