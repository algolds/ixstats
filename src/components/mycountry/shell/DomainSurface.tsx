"use client";

import React from "react";
import dynamic from "next/dynamic";
import { KeyCommand as Command } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useAbility } from "~/components/providers/AbilityProvider";
import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { DomainContextRail } from "./DomainContextRail";
import { DOMAIN_META, type MyCountryDomain } from "./domain-meta";

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

const SECTION_TO_DOMAIN: Record<string, MyCountryDomain> = {
  diplomacy: "relations",
  defense: "defense",
  politics: "politics",
  economy: "economy",
  executive: "economy",
};

/**
 * The full-page surface for the domain routes (/mycountry/diplomacy, /defense, /politics,
 * /executive): a title row, the domain's drill content inline and the shared rail alongside.
 * Defense stays premium-gated via PremiumPreviewFrame.
 */
export interface DomainSurfaceProps {
  countryId: string;
  section: string;
  onDeclare?: (prefilled?: string) => void;
  onNavigate?: (section: string) => void;
}

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <meta.icon aria-hidden="true" className="text-label-secondary size-6 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-label text-title-2">{meta.title}</h2>
            <p className="text-label-secondary text-callout">{meta.blurb}</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onDeclare?.(meta.prefilledGoal)}
          className="h-11 shrink-0 sm:h-9"
          title={`Start a Directive with a suggested ${meta.title.toLowerCase()} goal`}
        >
          <Command aria-hidden="true" />
          Declare Directive
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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

        <aside className="min-w-0 space-y-6">
          <DomainContextRail countryId={countryId} domain={domain} />
        </aside>
      </div>
    </div>
  );
}

export const DomainSurface = React.memo(DomainSurfaceComponent);
