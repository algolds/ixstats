"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface OverviewSidebarWidgetProps {
  countryId: string;
}

function sourceMeta(kind: string) {
  switch (kind) {
    case "decision":
      return { who: "Government", gradient: "from-amber-500 to-yellow-600", glyph: "◉" };
    case "diplomacy":
      return { who: "World", gradient: "from-purple-500 to-fuchsia-600", glyph: "◇" };
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
            className="bg-white/[0.02] border border-white/5 rounded-xl p-2 text-center shadow-inner"
          >
            <div className="text-sm font-black text-amber-500">{s.value}</div>
            <div className="text-muted-foreground/60 text-[9px] font-bold uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Feed Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            News Feed
          </span>
        </div>
        {!isLoading && (
          <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-bold text-muted-foreground/60">
            {canonItems?.length ?? 0}
          </Badge>
        )}
      </div>

      {/* Scrollable Feed List */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
        {isLoading && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Loading news feed...
          </div>
        )}

        {!isLoading && (!canonItems || canonItems.length === 0) && (
          <div className="text-muted-foreground py-8 text-center text-xs bg-white/[0.01] rounded-xl border border-dashed border-white/5">
            No recent activity. Execute actions to generate news.
          </div>
        )}

        {!isLoading &&
          canonItems?.map((item: any) => {
            const meta = sourceMeta(item.kind);
            return (
              <FacetCard
                key={item.id}
                depth={2}
                interactive="hover"
                className="p-3 bg-white/[0.01] border-white/5 hover:border-white/10 shadow-md transition-all rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  {/* Visual Circle/Glyph indicator */}
                  <div
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br text-[10px] font-black text-white shrink-0 shadow-sm",
                      meta.gradient
                    )}
                  >
                    {meta.glyph}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-foreground/80">{meta.who}</div>
                    <div className="text-[8px] text-muted-foreground/60 font-semibold">
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
