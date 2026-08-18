"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface OverviewSidebarWidgetProps {
  countryId: string;
}

function sourceMeta(item: any) {
  switch (item.kind) {
    case "decision":
      return { who: "Government", gradient: "from-amber-500 to-yellow-600", glyph: "◉" };
    case "diplomacy":
      return { who: "World", gradient: "from-purple-500 to-fuchsia-600", glyph: "◇" };
    case "ledger":
      const isUp = (item.deltaValue ?? 0) >= 0;
      return {
        who: `Ledger · ${item.sourceType || "Action"}`,
        gradient: isUp ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600",
        glyph: "▤",
      };
    default:
      return { who: "Press", gradient: "from-slate-500 to-slate-700", glyph: "▦" };
  }
}

function fmtTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function OverviewSidebarWidget({ countryId }: OverviewSidebarWidgetProps) {
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: canonItems, isLoading } = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 12 },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo(() => {
    const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;
    const activeEmbassies =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const partyCount = parties?.length ?? 0;

    return [
      { label: "Policies", value: activePolicies },
      { label: "Embassies", value: activeEmbassies },
      { label: "Parties", value: partyCount },
    ];
  }, [policies, embassies, parties]);

  return (
    <div className="space-y-4">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-2 text-center shadow-inner"
          >
            <div className="text-sm font-bold text-amber-500 tabular-nums">{s.value}</div>
            <div className="text-muted-foreground/70 mt-0.5 text-[9px] font-medium tracking-wider uppercase">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Feed Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            News Feed
          </span>
        </div>
        {!isLoading && (
          <Badge
            variant="outline"
            className="text-muted-foreground/60 px-1.5 py-0 text-[9px] font-medium tabular-nums"
          >
            {canonItems?.length ?? 0}
          </Badge>
        )}
      </div>

      {/* Scrollable Feed List */}
      <div className="max-h-[460px] scrollbar-thin space-y-2.5 overflow-y-auto pr-1">
        {isLoading && (
          <div className="text-muted-foreground py-8 text-center text-xs">Loading news feed...</div>
        )}

        {!isLoading && (!canonItems || canonItems.length === 0) && (
          <div className="text-muted-foreground rounded-xl border border-dashed border-white/5 bg-white/[0.01] py-8 text-center text-xs">
            No recent activity. Execute actions to generate news.
          </div>
        )}

        {!isLoading &&
          canonItems?.map((item: any) => {
            const meta = sourceMeta(item);
            const isLedger = item.kind === "ledger";
            const isUp = (item.deltaValue ?? 0) >= 0;

            return (
              <FacetCard
                key={item.id}
                depth={2}
                interactive="hover"
                className="rounded-xl border-white/5 bg-white/[0.01] p-3 shadow-md transition-all hover:border-white/10"
              >
                <div className="mb-2 flex items-center gap-2">
                  {/* Visual Circle/Glyph indicator */}
                  <div
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm",
                      meta.gradient
                    )}
                  >
                    {meta.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-foreground/80 truncate text-[10px] font-semibold">
                        {meta.who}
                      </div>
                      {isLedger && item.targetField && (
                        <span
                          className={cn(
                            "shrink-0 rounded-sm border px-1 text-[8px] font-extrabold uppercase",
                            isUp
                              ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-400"
                              : "border-red-500/20 bg-red-500/15 text-red-400"
                          )}
                        >
                          {isUp ? "+" : ""}
                          {item.deltaValue} {item.targetField}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground/60 text-[8px] font-semibold">
                      {fmtTime(item.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="text-foreground/90 text-[11px] leading-relaxed font-medium">
                  {item.title}
                </div>
              </FacetCard>
            );
          })}
      </div>
    </div>
  );
}
