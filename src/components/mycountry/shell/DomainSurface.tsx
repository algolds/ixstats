"use client";

import React from "react";
import dynamic from "next/dynamic";
import { KeyCommand as Command, ArrowUpRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useAbility } from "~/components/providers/AbilityProvider";
import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { DomainContextRail } from "./DomainContextRail";
import { DOMAIN_META, type V2Domain } from "./domain-meta";
import { DOMAIN_HUE, HUE_ACCENT, HUE_BADGE } from "./domain-hue";
import { WatermarkGlyph } from "~/components/ui/facet/identity/FlagWatermark";
import { Card } from "~/components/ui/card";

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-card h-96" />,
  }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const SECTION_TO_DOMAIN: Record<string, V2Domain> = {
  diplomacy: "relations",
  defense: "defense",
  politics: "politics",
  economy: "economy",
  executive: "economy",
};

/**
 * V2DomainSurface — the full-page v2 surface for the four domain routes
 * (/mycountry/diplomacy, /defense, /politics, /executive). Renders the v2 chrome
 * plus a themed domain hero and the domain's drill content inline as the primary body,
 * with the shared rail alongside. Defense stays premium-gated via PremiumPreviewFrame.
 */
export interface DomainSurfaceProps {
  countryId: string;
  section: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: string) => void;
}

export type V2DomainSurfaceProps = DomainSurfaceProps;

function DomainSurfaceComponent({
  countryId,
  section,
  onDeclare,
}: DomainSurfaceProps): React.JSX.Element {
  const ability = useAbility();
  const domain = SECTION_TO_DOMAIN[section];
  const meta = DOMAIN_META[domain];
  const accent = HUE_ACCENT[DOMAIN_HUE[domain]];

  return (
    <div className="space-y-6">
      {/* Domain hero (c5c6b382) on the Facet 3.1 glass hero: the domain's v2 hue is the card's
          accent (glass wash, border, glow blob and tinted shadow), and paints the top accent, the
          icon badge and the fine-stroke glyph watermark; the gold primary starts a directive
          with a suggested goal for this domain. */}
      <Card variant="hero" className="group overflow-hidden p-5">
        {/* v2 `border-t-2 border-t-<hue>/40` accent (drawn as a bar: the material owns the border) */}
        <span
          aria-hidden="true"
          className="bg-facet-accent pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-40"
        />
        <WatermarkGlyph
          icon={meta.icon}
          className="text-facet-accent -right-3 -bottom-4 size-24 opacity-[0.06]"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "rounded-control flex size-11 shrink-0 items-center justify-center border",
                HUE_BADGE
              )}
            >
              <meta.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-label text-title-2 sm:text-title-1">{meta.title}</h2>
              <p className="text-label-secondary text-body mt-0.5 max-w-xl leading-relaxed">
                {meta.blurb}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => onDeclare?.(meta.prefilledGoal)}
            className="group/cta h-11 shrink-0 font-semibold sm:h-9"
            title={`Start a directive with a suggested ${meta.title.toLowerCase()} goal`}
          >
            <Command aria-hidden="true" />
            <span>Declare a Directive</span>
            <ArrowUpRight
              aria-hidden="true"
              className="opacity-60 transition-[opacity,translate] duration-150 group-hover/cta:opacity-100 group-focus-visible/cta:opacity-100 motion-safe:group-hover/cta:translate-x-0.5 motion-safe:group-hover/cta:-translate-y-0.5 motion-safe:group-focus-visible/cta:translate-x-0.5 motion-safe:group-focus-visible/cta:-translate-y-0.5"
            />
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column — the domain's v2 drill content inline */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
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
        <aside className="min-w-0 space-y-6">
          <DomainContextRail countryId={countryId} domain={domain} />
        </aside>
      </div>
    </div>
  );
}

export const DomainSurface = React.memo(DomainSurfaceComponent);
export const V2DomainSurface = DomainSurface;
