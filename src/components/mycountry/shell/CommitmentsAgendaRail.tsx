"use client";

import { useMemo } from "react";
import { KeyCommand as Command, Plus, ArrowUpRight } from "iconoir-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

const TIER_BADGE: Record<string, string> = {
  measured: "text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  moderate: "text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
  extreme: "text-red-800 dark:text-red-300 bg-red-500/10 border-red-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
  proposed: "bg-muted/40 text-muted-foreground border-border/60",
  completed: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
  abandoned: "bg-muted/40 text-muted-foreground border-border/60",
};

/**
 * Active Directives sidebar rail — active executive intents + slot usage + quick declare trigger.
 * Replaces legacy "Your Agenda" title to eliminate overlap with the main V2MyAgenda tab.
 */
export interface CommitmentsAgendaRailProps {
  countryId: string;
  onOpenIntent?: (id: string) => void;
  onDeclare?: (prefilled?: string) => void;
}

export type V2AgendaProps = CommitmentsAgendaRailProps;

export function CommitmentsAgendaRail({
  countryId,
  onOpenIntent,
  onDeclare,
}: CommitmentsAgendaRailProps) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const usedSlots = status.data?.usedThisWeek ?? 0;
  const slotCap = status.data?.cap ?? 3;

  const allIntents = useMemo(() => {
    return Array.isArray(tree.data) ? tree.data : (tree.data?.allIntents ?? []);
  }, [tree.data]);

  const roots = useMemo(() => {
    return allIntents.filter(
      (it: any) => !it.parentId || !allIntents.some((x: any) => x.id === it.parentId)
    );
  }, [allIntents]);

  const empty = roots.length === 0;

  return (
    <FacetCard
      depth={1}
      interactive="hover"
      className="bg-card/40 dark:bg-card/30 border-border/80 flex flex-col gap-3.5 p-4 shadow-lg backdrop-blur-md dark:border-white/10"
    >
      {/* ── Rail Header & Slot Capacity ──────────────────────────── */}
      <div className="border-border/60 flex items-center justify-between gap-2 border-b pb-2.5 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Command className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <h4 className="text-xs font-semibold tracking-wider text-amber-800 uppercase dark:text-amber-400">
            Active Directives
          </h4>
        </div>

        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800 dark:text-amber-300">
          {usedSlots} / {slotCap} Slots
        </span>
      </div>

      {/* ── Directive Rollout List ────────────────────────────────── */}
      {empty ? (
        <div className="border-border/60 bg-card/30 flex flex-col items-center justify-center rounded-xl border border-dashed px-3 py-5 text-center dark:border-white/10 dark:bg-white/[0.01]">
          <p className="text-muted-foreground text-[11px] leading-relaxed font-medium">
            No active directives. Declare an intent to steer the nation.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {roots.map((root: any) => {
            const children = allIntents.filter((x: any) => x.parentId === root.id);
            const tone =
              TIER_BADGE[root.tier] || "bg-muted/40 text-muted-foreground border-border/60";
            return (
              <motion.button
                key={root.id}
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenIntent?.(root.id)}
                className="group border-border/60 bg-card/50 hover:bg-card/90 hover:border-border flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border p-2.5 text-left shadow-xs transition-all dark:border-white/5 dark:bg-white/[0.01] dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase shadow-2xs",
                      tone
                    )}
                  >
                    {root.tier}
                  </span>
                  <span className="text-foreground min-w-0 flex-1 truncate text-xs leading-tight font-extrabold">
                    {root.goal}
                  </span>
                </div>
                <div className="pl-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="bg-muted/60 h-1 flex-1 overflow-hidden rounded-full dark:bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          (root.progress ?? 0) >= 100
                            ? "bg-emerald-500/80"
                            : (root.progress ?? 0) > 0
                              ? "bg-amber-500/80"
                              : "bg-slate-400/40"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, root.progress ?? 0))}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 font-mono text-[9px] font-bold">
                      {Math.round(root.progress ?? 0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-0.5">
                  <span className="text-muted-foreground text-[9px] font-semibold capitalize">
                    {root.category}
                  </span>
                  {children.length > 0 && (
                    <span className="text-muted-foreground/70 text-[9px] font-medium">
                      • {children.length} follow-up{children.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase",
                      STATUS_BADGE[root.status?.toLowerCase?.()] || STATUS_BADGE.active
                    )}
                  >
                    {root.status ?? "active"}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── Quick Action: Declare Directive Button ───────────────── */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onDeclare?.()}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-extrabold text-amber-800 shadow-xs transition-all hover:bg-amber-500/20 dark:text-amber-300"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Declare Directive</span>
        <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      </motion.button>
    </FacetCard>
  );
}

export const V2Agenda = CommitmentsAgendaRail;
