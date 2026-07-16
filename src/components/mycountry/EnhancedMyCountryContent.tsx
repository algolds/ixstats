"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useState } from "react";
import dynamic from "next/dynamic";
import { useCountryData, SectionShell } from "./primitives";
// eslint-disable-next-line unused-imports/no-unused-imports
import { OverviewHero } from "./OverviewHero";
import { OverviewSidebarWidget } from "./sidebar-widgets/OverviewSidebarWidget";
import { SetupChecklist } from "./SetupChecklist";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { useMyCountryNavigation } from "~/hooks/useMyCountryNavigation";
import { CountryWireframe } from "./CountryWireframe";
import { Loader2, Clock } from "lucide-react";
import { api } from "~/trpc/react";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);

import { cn } from "~/lib/utils";

import { FacetCard } from "~/components/ui/facet-container";
import { IxTime } from "~/lib/ixtime";

interface EnhancedMyCountryContentProps {
  variant?: "unified" | "standard" | "premium";
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
  v2?: boolean;
  onIssueDirective?: (goal?: string) => void;
}

const SEVERITY_BADGE = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  HIGH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const getRelativeDeadline = (deadlineIxTime: number | null) => {
  if (deadlineIxTime === null) return null;
  const deadlineReal = IxTime.convertFromIxTime(deadlineIxTime);
  const nowReal = Date.now();
  const remaining = deadlineReal - nowReal;
  const daysRemaining = remaining / (24 * 60 * 60 * 1000);
  const inWorldDate = IxTime.formatIxTime(deadlineIxTime, false);

  if (daysRemaining <= 0) {
    return {
      text: "EXPIRED",
      isUrgent: true,
      inWorldDate,
    };
  }
  const roundedDays = Math.ceil(daysRemaining);
  return {
    text: `due in ${roundedDays} day${roundedDays > 1 ? "s" : ""}`,
    isUrgent: roundedDays < 3,
    inWorldDate,
    daysRemaining: roundedDays,
  };
};

function NeedsYou({
  countryId,
  onDeclare,
}: {
  countryId: string;
  onDeclare: (title?: string) => void;
}) {
  const { data } = api.nationalIssues.getMyIssues.useQuery(
    { countryId, status: "active" } as any,
    { enabled: !!countryId, retry: false }
  );
  const list = (data?.issues ?? []).slice(0, 3);
  return (
    <FacetCard depth={1} interactive="hover" className="p-5 flex flex-col gap-4 bg-card/30 backdrop-blur-md">
      <div>
        <h4 className="text-xs font-bold tracking-widest text-red-500 uppercase">Needs You</h4>
        <p className="text-muted-foreground text-[10px] mt-0.5">Critical national matters requiring executive attention.</p>
      </div>
      <div className="space-y-3">
        {list.map((i: any) => {
          const deadline = getRelativeDeadline(i.deadlineIxTime);
          const isUrgent = deadline?.isUrgent || i.severity?.toLowerCase() === "critical";

          return (
            <button
              key={i.id}
              onClick={() => onDeclare(i.title)}
              className={cn(
                "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all active:scale-[0.99] cursor-pointer shadow-lg",
                isUrgent
                  ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10 border-l-4 border-l-red-500 shadow-red-500/5"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] border-l-4 border-l-blue-500"
              )}
            >
              <span className={cn("text-lg mt-0.5", isUrgent && "animate-pulse")}>🚨</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-bold text-foreground/90 leading-tight truncate">{i.title}</div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      SEVERITY_BADGE[i.severity as keyof typeof SEVERITY_BADGE] || SEVERITY_BADGE.medium
                    )}
                  >
                    {i.severity}
                  </span>
                </div>
                <div className="text-muted-foreground line-clamp-2 text-[11px] mt-1.5 leading-relaxed">{i.description || i.headline}</div>
                {deadline && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold">
                    <Clock className={cn("h-3 w-3", isUrgent ? "text-red-400" : "text-muted-foreground")} />
                    <span className={cn(isUrgent ? "text-red-400 animate-pulse" : "text-muted-foreground")}>
                      {deadline.text}
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-muted-foreground/70">
                      {deadline.inWorldDate}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-xs bg-white/[0.01] rounded-xl border border-dashed border-white/5">
            All clear, leader.
          </div>
        )}
      </div>
    </FacetCard>
  );
}

function AgendaTree({
  countryId,
  onIssueDirective,
}: {
  countryId: string;
  onIssueDirective?: (goal?: string) => void;
}) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const TONE_CLS = {
    good: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
    mid: "text-amber-300 bg-amber-500/10 border-amber-400/20",
    bad: "text-red-300 bg-red-500/10 border-red-400/20",
    info: "text-blue-300 bg-blue-500/10 border-blue-400/20",
    fog: "text-muted-foreground bg-muted/40 border-border",
  };

  const TIER_LINE_COLOR: Record<string, string> = {
    measured: "bg-emerald-500/30",
    moderate: "bg-amber-500/30",
    extreme: "bg-red-500/30",
  };

  const STATUS_BADGE_STYLE: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    abandoned: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  if ((tree.data ?? []).length === 0) {
    return (
      <FacetCard depth={1} interactive="hover" className="p-5 flex flex-col gap-4 bg-card/30 backdrop-blur-md text-center">
        <div>
          <h4 className="text-xs font-bold tracking-widest text-amber-500 uppercase">Your Agenda</h4>
          <p className="text-muted-foreground text-[10px] mt-0.5">Your current active plans, directives, and goals.</p>
        </div>
        <div className="py-8 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
          <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-4">
            Committed intents and their follow-ups will appear here as a dependency tree.
          </p>
          <button
            onClick={() => onIssueDirective?.()}
            className="text-xs font-bold text-amber-500 hover:underline cursor-pointer"
          >
            Issue your first directive →
          </button>
        </div>
      </FacetCard>
    );
  }

  const rootIntents = (tree.data ?? []).filter(
    (it: any) => !it.parentId || !(tree.data ?? []).some((x: any) => x.id === it.parentId)
  );

  return (
    <FacetCard depth={1} interactive="hover" className="p-5 flex flex-col gap-4 bg-card/30 backdrop-blur-md">
      <div>
        <h4 className="text-xs font-bold tracking-widest text-amber-500 uppercase">Your Agenda</h4>
        <p className="text-muted-foreground text-[10px] mt-0.5">Your current active plans, directives, and goals.</p>
      </div>
      <div className="space-y-4">
        {rootIntents.map((root: any) => {
          const children = (tree.data ?? []).filter((x: any) => x.parentId === root.id);
          const hasChildren = children.length > 0;
          const toneKey = root.tier === "measured" ? "good" : root.tier === "moderate" ? "mid" : "bad";
          const trackColor = TIER_LINE_COLOR[root.tier] || "bg-white/10";

          return (
            <div key={root.id} className="relative rounded-xl border border-white/5 bg-white/[0.01] p-4">
              {/* Root Row */}
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    TONE_CLS[toneKey]
                  )}
                >
                  {root.tier}
                </span>
                <span className="text-foreground/90 flex-1 truncate font-semibold leading-tight">{root.goal}</span>
                <span className="text-muted-foreground/60 text-[10px] font-medium capitalize bg-white/5 px-2 py-0.5 rounded border border-white/5 shrink-0">
                  {root.category}
                </span>
              </div>

              {/* Children Sub-Tree */}
              {hasChildren && (
                <div className="relative ml-6 mt-4 pl-5">
                  {/* Vertical Connect Track */}
                  <div className={cn("absolute left-0 top-1 bottom-4 w-[2px] rounded-full", trackColor)} />

                  <div className="space-y-3.5">
                    {children.map((kid: any) => {
                      const kidStatus = kid.status?.toLowerCase() || "active";
                      return (
                        <div key={kid.id} className="relative flex items-center justify-between gap-3 text-xs">
                          {/* Horizontal Connect Connector Line */}
                          <div className={cn("absolute left-[-20px] top-1/2 -translate-y-1/2 w-4 h-[2px]", trackColor)} />
                          
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-amber-400/70 font-bold leading-none select-none">↳</span>
                            <span className="text-foreground/80 truncate font-medium">{kid.goal}</span>
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider shrink-0",
                              STATUS_BADGE_STYLE[kidStatus] || STATUS_BADGE_STYLE.active
                            )}
                          >
                            {kidStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}

export function EnhancedMyCountryContent({
  variant = "unified",
  activeSection,
  onNavigate,
  notifications,
  v2 = false,
  onIssueDirective,
}: EnhancedMyCountryContentProps) {
  const { country, isLoading } = useCountryData();
  const { activeTab } = useMyCountryNavigation();

  const { data: geoBundle, isLoading: isGeoLoading } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id && activeTab === "geography", staleTime: 30_000 }
  );

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  const geographyHero = (
    <div className="border-border bg-card/40 relative h-72 w-full overflow-hidden rounded-xl border shadow-lg sm:h-96">
      {isGeoLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-[#0a1628]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <CountryWireframe
          geometry={(geoBundle?.geometry as import("geojson").Geometry | null) ?? null}
          cities={geoBundle?.cities ?? []}
          label="Country Outline"
        />
      )}
    </div>
  );

  return (
    <SectionShell
      section="overview"
      contextWidget={<OverviewSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
      hero={activeTab === "geography" ? geographyHero : undefined}
      v2={v2}
      onIssueDirective={onIssueDirective}
    >
      {/* New-player onboarding — self-hides once established */}
      {country?.id && <SetupChecklist countryId={country.id} onNavigate={onNavigate} />}

      {v2 ? (
        <div className="space-y-4">
          <NeedsYou countryId={country.id} onDeclare={onIssueDirective || (() => {})} />
          <AgendaTree countryId={country.id} onIssueDirective={onIssueDirective} />
        </div>
      ) : (
        /* Economy, Labor, Government, Geography tabs */
        <div id="tabs">
          <MyCountryTabSystem variant={variant} v2={v2} />
        </div>
      )}
    </SectionShell>
  );
}
