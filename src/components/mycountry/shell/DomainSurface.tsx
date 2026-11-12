"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "~/components/ui/skeleton";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives";
import { PoliticsDrillDown } from "./PoliticsDrillDown";
import { EconomyDrillDown } from "./EconomyDrillDown";
import { DomainContextRail } from "./DomainContextRail";
import type { MyCountryDomain } from "./domain-meta";

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
};

/**
 * The panel for the domain sections (/mycountry/economy, /diplomacy, /politics, /defense): the
 * domain's drill content with its rail alongside. The command ribbon above names the section, and
 * the command bar's Declare Directive opens on the domain's suggested goal, so the panel carries
 * neither a title row nor a second Declare button. Defense stays premium-gated via
 * PremiumPreviewFrame.
 */
interface DomainSurfaceProps {
  countryId: string;
  section: string;
  onDeclare?: (prefilled?: string) => void;
}

function DomainSurfaceComponent({
  countryId,
  section,
  onDeclare,
}: DomainSurfaceProps): React.JSX.Element {
  const hasDefenseAccess = useHasMycountryPremium("defense");
  const domain = SECTION_TO_DOMAIN[section] ?? "economy";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {domain === "defense" ? (
          <PremiumPreviewFrame feature="defense" locked={!hasDefenseAccess}>
            <DefenseCommandPanel countryId={countryId} />
          </PremiumPreviewFrame>
        ) : domain === "relations" ? (
          <EmbassiesAndRelationsPanel countryId={countryId} />
        ) : domain === "politics" ? (
          <PoliticsDrillDown countryId={countryId} />
        ) : (
          <EconomyDrillDown countryId={countryId} onDeclare={onDeclare} />
        )}
      </div>

      <aside className="min-w-0 space-y-6">
        <DomainContextRail countryId={countryId} domain={domain} />
      </aside>
    </div>
  );
}

export const DomainSurface = React.memo(DomainSurfaceComponent);
