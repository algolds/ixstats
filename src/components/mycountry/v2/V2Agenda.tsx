"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

const TIER_BADGE: Record<string, string> = {
  measured: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  moderate: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  extreme: "text-red-300 bg-red-500/10 border-red-400/20",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  proposed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  abandoned: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

/**
 * The commitments rail — active intents + their follow-ups (flat tree nested by
 * parentId). "Your Agenda": the plans you are steering, kept compact for the rail.
 */
export function V2Agenda({
  countryId,
  onOpenIntent,
}: {
  countryId: string;
  onOpenIntent?: (id: string) => void;
}) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });

  const roots = useMemo(() => {
    const items = tree.data ?? [];
    return items.filter((it: any) => !it.parentId || !items.some((x: any) => x.id === it.parentId));
  }, [tree.data]);

  const empty = roots.length === 0;

  return (
    <FacetCard depth={1} interactive="hover" className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-amber-500" />
        <h4 className="text-xs font-bold tracking-widest text-amber-500 uppercase">Your Agenda</h4>
      </div>

      {empty ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-3 py-5 text-center text-[11px] leading-relaxed">
          No active directives. Declare an intent to start steering the nation.
        </p>
      ) : (
        <div className="space-y-2.5">
          {roots.map((root: any) => {
            const children = (tree.data ?? []).filter((x: any) => x.parentId === root.id);
            const tone = TIER_BADGE[root.tier] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
            return (
              <button
                key={root.id}
                type="button"
                onClick={() => onOpenIntent?.(root.id)}
                className="group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.01] p-2.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase",
                      tone
                    )}
                  >
                    {root.tier}
                  </span>
                  <span className="text-foreground/90 min-w-0 flex-1 truncate text-[12px] leading-tight font-semibold">
                    {root.goal}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-0.5">
                  <span className="text-muted-foreground/60 text-[9px] font-medium capitalize">
                    {root.category}
                  </span>
                  {children.length > 0 && (
                    <span className="text-muted-foreground/50 text-[9px]">
                      {children.length} follow-up{children.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase",
                      STATUS_BADGE[root.status?.toLowerCase?.()] || STATUS_BADGE.active
                    )}
                  >
                    {root.status ?? "active"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </FacetCard>
  );
}