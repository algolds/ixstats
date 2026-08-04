"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Globe2,
  Shield,
  Landmark,
  Map as MapIcon,
  TrendingUp,
  Heart,
  AlertTriangle,
  Scale,
  FileClock,
  ArrowUpRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { V2Agenda } from "./V2Agenda";
import type { V2Drill } from "./V2DrillSheets";

const CATEGORY_STYLE: Record<string, { icon: typeof Globe2; cls: string; label: string }> = {
  diplomatic: { icon: Globe2, cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", label: "Diplomacy" },
  economic: { icon: TrendingUp, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Economy" },
  social: { icon: Heart, cls: "text-pink-400 bg-pink-500/10 border-pink-500/20", label: "Society" },
  emergency: { icon: AlertTriangle, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Crisis" },
  governance: { icon: Landmark, cls: "text-purple-400 bg-purple-500/10 border-purple-500/20", label: "Governance" },
  ledger: { icon: Scale, cls: "text-slate-400 bg-slate-500/10 border-slate-500/20", label: "Ledger" },
  military: { icon: Shield, cls: "text-red-400 bg-red-500/10 border-red-500/20", label: "Security" },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StandingBands({ countryId }: { countryId: string }) {
  const { data } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const bands: { label: string; value: number | undefined; accent: string }[] = [
    { label: "Economic Vitality", value: data?.economicVitality, accent: "bg-emerald-500" },
    { label: "Population Wellbeing", value: data?.populationWellbeing, accent: "bg-pink-500" },
    { label: "Diplomatic Standing", value: data?.diplomaticStanding, accent: "bg-cyan-500" },
    { label: "Government Efficiency", value: data?.governmentalEfficiency, accent: "bg-purple-500" },
  ];

  const bandLabel = (v?: number) => {
    if (v === undefined) return "—";
    if (v >= 75) return "Strong";
    if (v >= 50) return "Moderate";
    if (v >= 30) return "Strained";
    return "Weak";
  };

  return (
    <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md">
      <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        National Standing
      </h4>
      <div className="space-y-2.5">
        {bands.map(({ label, value, accent }) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
              <span className="text-foreground/80 text-[11px] font-bold">{bandLabel(value)}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full transition-all duration-500", accent)}
                style={{ width: `${value ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}

function ActionGrid({
  onOpenDrill,
  onOpenMap,
}: {
  onOpenDrill: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onOpenMap: () => void;
}) {
  const tiles = [
    {
      title: "Foreign Relations",
      blurb: "Embassies, treaties and stance",
      icon: Globe2,
      accent: "text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10",
      onClick: () => onOpenDrill({ kind: "relations" }),
    },
    {
      title: "National Security",
      blurb: "Defense posture & readiness",
      icon: Shield,
      accent: "text-red-400 border-red-500/20 hover:bg-red-500/10",
      onClick: () => onOpenDrill({ kind: "defense" }),
    },
    {
      title: "Governance Config",
      blurb: "Parties, legislature & fiat",
      icon: Landmark,
      accent: "text-purple-400 border-purple-500/20 hover:bg-purple-500/10",
      onClick: () => onOpenDrill({ kind: "politics" }),
    },
    {
      title: "Territory & Map",
      blurb: "Claim & shape your geography",
      icon: MapIcon,
      accent: "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10",
      onClick: onOpenMap,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ title, blurb, icon: Icon, accent, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className={cn(
            "group flex cursor-pointer flex-col items-start gap-2 rounded-xl border bg-white/[0.02] p-4 text-left transition-all active:scale-[0.98]",
            accent
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-foreground/90 text-sm font-bold">{title}</span>
          <span className="text-muted-foreground text-[11px] leading-snug">{blurb}</span>
          <span className="text-muted-foreground/60 mt-auto flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase opacity-0 transition-opacity group-hover:opacity-100">
            Open <ArrowUpRight className="h-3 w-3" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function V2Home({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
}: {
  countryId: string;
  onDeclare: () => void;
  onOpenDrill: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onOpenIntent: (id: string) => void;
}) {
  const router = useRouter();
  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId }
  );
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  const briefing = useMemo(() => {
    if (items.length === 0) return null;
    const latest = items[0];
    return {
      latest,
      weekCount: items.length,
    };
  }, [items]);

  const canCommit = status?.data?.canCommit ?? true;

  return (
    <div className="space-y-5">
      {/* Briefing — since-you-last-session summary (bands, no raw numbers) */}
      {briefing && (
        <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Since your last session
            </h4>
          </div>
          <p className="text-foreground/90 text-sm leading-relaxed">
            <span className="font-semibold">{briefing.weekCount}</span> canon events recorded. The
            latest:{" "}
            <span className="font-semibold">{briefing.latest.title}</span>{" "}
            <span className="text-muted-foreground text-xs">({relativeTime(briefing.latest.timestamp)})</span>
          </p>
        </FacetCard>
      )}

      {/* Action-domain grid — one click to every domain */}
      <ActionGrid
        onOpenDrill={onOpenDrill}
        onOpenMap={() => router.push(withBasePath("/mycountry/map-editor"))}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main feed */}
        <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md lg:col-span-2">
          <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            The Record — your nation&apos;s story
          </h4>
          {items.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-3 py-8 text-center text-xs">
              No canon events yet. Declare a directive to start the record.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {items.map((item: any) => {
                const meta = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.ledger;
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                        meta.cls
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground/85 text-[13px] leading-snug font-medium">
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                        <span className="text-muted-foreground/60">{meta.label}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-muted-foreground/60">{relativeTime(item.timestamp)}</span>
                        {item.kind === "ledger" && item.targetField && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="text-muted-foreground/70 rounded border border-white/10 bg-white/[0.03] px-1.5 py-px font-mono">
                              {item.targetField}
                              {item.deltaValue !== null && item.deltaValue !== undefined
                                ? ` ${item.deltaValue > 0 ? "+" : ""}${item.deltaValue}`
                                : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FacetCard>

        {/* Rail */}
        <aside className="space-y-5">
          <button
            type="button"
            onClick={onDeclare}
            className={cn(
              "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold transition-all active:scale-[0.98]",
              canCommit
                ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-500/5 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:bg-amber-500/20"
                : "cursor-not-allowed border-white/10 bg-white/[0.02] text-muted-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            {canCommit ? "Declare an Intent" : "Directive on cooldown"}
          </button>

          <StandingBands countryId={countryId} />
          <V2Agenda countryId={countryId} onOpenIntent={onOpenIntent} />
        </aside>
      </div>
    </div>
  );
}