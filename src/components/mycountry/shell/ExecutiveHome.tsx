"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KeyCommand as Command,
  ClockRotateRight as FileClock,
  Clock,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { soundEffects } from "~/lib/sound/cuelume";
import { ExecutiveOpportunityHero } from "./ExecutiveOpportunityHero";
import { ExecutiveAgenda } from "./ExecutiveAgenda";
import { StandingBands } from "./StandingBands";
import { TerritoryMapWidget } from "./TerritoryMapWidget";
import {
  ExecutiveActionCards,
  DomainActionTiles,
  DOMAIN_TILES,
  CATEGORY_STYLE,
} from "./ExecutiveActionCards";
import { ExecutiveRecordFeed } from "./ExecutiveRecordFeed";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

export {
  ExecutiveActionCards,
  DomainActionTiles,
  DOMAIN_TILES,
  CATEGORY_STYLE,
  TerritoryMapWidget,
  ExecutiveRecordFeed,
};

function formatCooldownTime(cooldownUntil: number | null | undefined, now = Date.now()): string {
  if (!cooldownUntil) return "Resets next weekly cycle";
  const diffMs = Math.max(0, cooldownUntil - now);
  if (diffMs <= 0) return "Cooldown expiring soon";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function ExecutiveHomeComponent({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
  onNavigate,
}: {
  countryId: string;
  onDeclare: (prefilled?: string) => void;
  onOpenDrill: (d: DrillSheetKind) => void;
  onOpenIntent: (intentId: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const focusParam = searchParams?.get("focus");

  useEffect(() => {
    if (focusParam === "directives") {
      onDeclare();
    } else if (focusParam === "agenda") {
      const el = document.getElementById("executive-agenda");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [focusParam, onDeclare]);

  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 60 },
    { enabled: !!countryId }
  );
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!status?.data?.onCooldown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.data?.onCooldown]);

  const items = useMemo(() => feed.data ?? [], [feed.data]);
  const canCommit = status?.data?.canCommit ?? true;

  return (
    <div className="space-y-5">
      {/* Primary Opportunity Briefing Hero */}
      <ExecutiveOpportunityHero
        countryId={countryId}
        onDeclare={onDeclare}
        onNavigate={onNavigate}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main Column: Pulse & Agenda Widget + Recent Activity Feed */}
        <div className="space-y-5 lg:col-span-2">
          {/* Primary Agenda Widget */}
          <ExecutiveAgenda
            countryId={countryId}
            onIssueDirective={onDeclare}
            onOpenIntent={onOpenIntent}
            onOpenDrill={onOpenDrill}
          />

          {/* Main Feed */}
          <FacetCard
            depth={1}
            interactive="none"
            className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md"
          >
            <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Recent Activity - National log
            </h4>
            <ExecutiveRecordFeed items={items} onOpenDrill={onOpenDrill} />
          </FacetCard>
        </div>

        {/* Rail */}
        <aside className="space-y-5">
          {/* 1. National Standing & Vitality Rings */}
          <StandingBands countryId={countryId} />

          {/* 2. Executive CivCap Throughput & Trigger */}
          {canCommit ? (
            <button
              type="button"
              onClick={() => {
                soundEffects.bloom();
                onDeclare();
              }}
              className="group border-border/50 bg-card/40 hover:bg-card/70 text-foreground relative flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-bold shadow-xs backdrop-blur-md transition-all duration-200 hover:border-amber-500/40 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 transition-all group-hover:scale-105 group-hover:bg-amber-500/20 dark:text-amber-400">
                <Command className="h-3.5 w-3.5" />
              </span>
              <span className="transition-colors group-hover:text-amber-500 dark:group-hover:text-amber-400">
                Declare a new Directive
              </span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <button
                    type="button"
                    disabled
                    className="border-border/40 bg-card/20 text-muted-foreground flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-bold opacity-75 backdrop-blur-md transition-all"
                  >
                    <span className="border-border/40 bg-muted/20 text-muted-foreground flex h-7 w-7 items-center justify-center rounded-lg border">
                      <FileClock className="h-3.5 w-3.5" />
                    </span>
                    <span>Directive on Cooldown</span>
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className="bg-popover/95 max-w-xs space-y-1.5 rounded-xl border border-amber-500/30 p-3 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Executive Cooldown Active</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your government has issued maximum weekly directives (
                  {status?.data?.usedThisWeek ?? 3}/{status?.data?.cap ?? 3}).
                </p>
                <div className="border-border/30 text-foreground flex items-center justify-between border-t pt-1.5 font-mono text-[10px] font-bold">
                  <span>Next Available Slot:</span>
                  <span className="text-amber-500 dark:text-amber-400">
                    {formatCooldownTime(status?.data?.cooldownUntil, now)}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 3. Interactive Territory Map Canvas */}
          <TerritoryMapWidget countryId={countryId} />
        </aside>
      </div>
    </div>
  );
}

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
export const V2Home = ExecutiveHome;
