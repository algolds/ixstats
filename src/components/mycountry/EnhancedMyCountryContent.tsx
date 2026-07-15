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
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);

import { cn } from "~/lib/utils";

interface EnhancedMyCountryContentProps {
  variant?: "unified" | "standard" | "premium";
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
  v2?: boolean;
  onIssueDirective?: (goal?: string) => void;
}

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
    <div className="border-border/60 bg-white/[0.02] rounded-xl border p-4">
      <div className="mb-3">
        <h4 className="text-xs font-bold tracking-widest text-red-500 uppercase">Needs You</h4>
        <p className="text-muted-foreground text-[10px]">Critical national matters requiring executive attention.</p>
      </div>
      <div className="space-y-2">
        {list.map((i: any) => (
          <button
            key={i.id}
            onClick={() => onDeclare(i.title)}
            className="flex w-full items-start gap-3 rounded-lg border border-red-500/10 bg-red-500/5 p-3 text-left transition-colors hover:bg-red-500/10 active:scale-[0.99] cursor-pointer"
          >
            <span className="text-red-400 text-sm mt-0.5">🚨</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-foreground/90 leading-tight">{i.title}</div>
              <div className="text-muted-foreground truncate text-[11px] mt-1">{i.headline}</div>
            </div>
          </button>
        ))}
        {list.length === 0 && (
          <div className="text-muted-foreground py-4 text-center text-xs">All clear, leader.</div>
        )}
      </div>
    </div>
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

  if ((tree.data ?? []).length === 0) {
    return (
      <div className="border-border/60 bg-white/[0.02] rounded-xl border p-5 text-center">
        <h4 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-1">Your Agenda</h4>
        <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-3">
          Committed intents and their follow-ups will appear here as a dependency tree.
        </p>
        <button
          onClick={() => onIssueDirective?.()}
          className="text-xs font-bold text-amber-500 hover:underline cursor-pointer"
        >
          Issue your first directive →
        </button>
      </div>
    );
  }

  return (
    <div className="border-border/60 rounded-xl border p-4 bg-white/[0.02]">
      <div className="mb-3">
        <h4 className="text-xs font-bold tracking-widest text-amber-500 uppercase">Your Agenda</h4>
        <p className="text-muted-foreground text-[10px]">Your current active plans, directives, and goals.</p>
      </div>
      <div className="space-y-2">
        {(tree.data ?? [])
          .filter((it: any) => !it.parentId || !(tree.data ?? []).some((x: any) => x.id === it.parentId))
          .map((root: any) => (
            <div key={root.id} className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
              <div className="flex items-center gap-2 py-1 text-[12px]">
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", TONE_CLS[root.tier === "measured" ? "good" : root.tier === "moderate" ? "mid" : "bad"])}>{root.tier}</span>
                <span className="text-foreground/90 flex-1 truncate font-medium">{root.goal}</span>
                <span className="text-muted-foreground text-[10px]">{root.category}</span>
              </div>
              {(tree.data ?? []).filter((x: any) => x.parentId === root.id).map((kid: any) => (
                <div key={kid.id} className="ml-3 border-l border-white/10 pl-3 mt-1.5">
                  <div className="flex items-center gap-2 py-1 text-[12px]">
                    <span className="text-amber-400">↳</span>
                    <span className="text-foreground/80 flex-1 truncate">{kid.goal}</span>
                    <span className="text-muted-foreground text-[10px] font-medium uppercase text-[9px]">{kid.tier}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
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
