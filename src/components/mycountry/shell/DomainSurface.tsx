"use client";

import React from "react";
import dynamic from "next/dynamic";
import { KeyCommand as Command } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";
import { useAbility } from "~/components/providers/AbilityProvider";
import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { DomainContextRail } from "./DomainContextRail";
import { DOMAIN_META, type V2Domain } from "./domain-meta";
import { STATUS_TEXT } from "./status-tone";

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 rounded-3xl" />,
  }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <Skeleton className="h-64 rounded-3xl" /> }
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

  return (
    <div className="space-y-6">
      {/* Domain header: domain glyph, title, one-line purpose and a domain-scoped directive */}
      <FacetCard depth={1} interactive="none" className="rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <meta.icon aria-hidden="true" className="text-muted-foreground mt-1 h-6 w-6 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
                {meta.title}
              </h2>
              <p className="text-muted-foreground mt-0.5 max-w-xl text-sm leading-relaxed">
                {meta.blurb}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              soundEffects.bloom();
              onDeclare?.(meta.prefilledGoal);
            }}
            className="h-11 shrink-0 sm:h-9"
            title={`Start a directive with a suggested ${meta.title.toLowerCase()} goal`}
          >
            <Command aria-hidden="true" className={STATUS_TEXT.accent} />
            <span>{meta.title} directive</span>
          </Button>
        </div>
      </FacetCard>

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
