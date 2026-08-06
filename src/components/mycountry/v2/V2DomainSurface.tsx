"use client";

import dynamic from "next/dynamic";
import { Command, ArrowUpRight } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { useAbility } from "~/components/providers/AbilityProvider";
import { PremiumPreviewFrame } from "../primitives";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { V2DomainContext } from "./V2DomainContext";
import { DOMAIN_META, type V2Domain } from "./domain-meta";

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const SECTION_TO_DOMAIN: Record<string, V2Domain> = {
  diplomacy: "relations",
  defense: "defense",
  politics: "politics",
  economy: "economy",
  executive: "economy",
};

const DOMAIN_GLOW: Record<V2Domain, string> = {
  relations: "bg-teal-400",
  defense: "bg-red-400",
  politics: "bg-purple-400",
  economy: "bg-emerald-400",
};

const DOMAIN_BORDER: Record<V2Domain, string> = {
  relations: "border-t-teal-500/40",
  defense: "border-t-red-500/40",
  politics: "border-t-purple-500/40",
  economy: "border-t-emerald-500/40",
};

/**
 * V2DomainSurface — the full-page v2 surface for the four domain routes
 * (/mycountry/diplomacy, /defense, /politics, /executive). Renders the v2 chrome
 * (nav pill lives in V2CommandSurface) plus a themed domain hero and the domain's
 * v2 drill content inline as the primary body, with the shared v2 rail alongside.
 * Defense stays premium-gated via PremiumPreviewFrame.
 */
export function V2DomainSurface({
  countryId,
  section,
  onDeclare,
}: {
  countryId: string;
  section: "diplomacy" | "defense" | "politics" | "economy" | "executive";
  onDeclare?: (prefilled?: string) => void;
}) {
  const ability = useAbility();
  const domain = SECTION_TO_DOMAIN[section];
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;

  return (
    <div className="space-y-5">
      {/* Domain Hero — themed header card */}
      <FacetCard
        depth={1}
        className={cn(
          "relative overflow-hidden border-t-2 p-5 backdrop-blur-md",
          DOMAIN_BORDER[domain]
        )}
      >
        {/* Ambient glow + watermark glyph */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-15",
              DOMAIN_GLOW[domain]
            )}
          />
          <Icon
            className={cn(
              "absolute -right-3 -bottom-4 h-24 w-24 opacity-[0.06]",
              meta.accent
            )}
            strokeWidth={1}
          />
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white/5", meta.accent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {meta.title}
              </h1>
              <p className="text-muted-foreground mt-0.5 max-w-xl text-xs font-medium leading-relaxed">
                {meta.blurb}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDeclare?.(meta.prefilledGoal)}
            className="group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400 shadow-sm backdrop-blur-md"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10">
              <Command className="h-3 w-3" />
            </span>
            <span>Declare a Directive</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </button>
        </div>
      </FacetCard>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column — the domain's v2 drill content inline */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {domain === "defense" ? (
            <PremiumPreviewFrame
              feature="defense"
              locked={!ability.can("access", "MyCountryFeature", "defense")}
            >
              <DefenseCommandPanel countryId={countryId} />
            </PremiumPreviewFrame>
          ) : domain === "relations" ? (
            <EmbassiesAndRelationsPanel countryId={countryId} />
          ) : domain === "politics" ? (
            <PoliticsDrillDown countryId={countryId} />
          ) : (
            <EconomyDrillDown countryId={countryId} />
          )}
        </div>

        {/* Rail — per-domain contextual KPIs + recent activity */}
        <aside className="space-y-5">
          <V2DomainContext countryId={countryId} domain={domain} />
        </aside>
      </div>
    </div>
  );
}
