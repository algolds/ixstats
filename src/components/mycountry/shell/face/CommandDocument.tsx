"use client";

import React from "react";
import Link from "next/link";
import { ProfileCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { countryTransitionName, SharedElement } from "~/components/ui/view-transition";
import { CountryHeroCard } from "~/components/shared/country-hero/CountryHeroCard";
import { DocumentRibbon } from "~/components/shared/document/DocumentRibbon";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { assetUrl } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { tabForSection, visibleTabs, type MyCountryTab } from "../mycountry-tabs";
import { CommandActions } from "../headers/UnifiedGlassCommandBar";
import { CommandBand } from "./CommandBand";
import { CommandIdentity } from "./CommandIdentity";
import { CommandMedia } from "./CommandMedia";
import { deriveFigures } from "./command-figures";

interface CommandDocumentProps {
  /** The section on screen (the ribbon highlights its tab). */
  section: string;
  onNavigate?: (section: MyCountryTab) => void;
  /** Opens the Directive composer (with a domain preset when on a domain tab). */
  onDeclare?: () => void;
  /** Shared with the section panel the ribbon controls. */
  idBase: string;
  /** Receives the face's `<h1>` for the sticky command bar. */
  titleRef?: (el: HTMLHeadingElement | null) => void;
}

/**
 * CommandDocument — MyCountry as the back of the country's document: the same anatomy as the
 * public profile (a face over the live territory with a frosted identity Lens and a footer band,
 * then a ribbon attached to it), in MyCountry's gold, carrying the owner's private readings and
 * the app's one section navigation. The section itself follows below as the ribbon's panel.
 */
function CommandDocumentComponent({
  section,
  onNavigate,
  onDeclare,
  idBase,
  titleRef,
}: CommandDocumentProps) {
  const { country } = useCountryData();
  const countryId = country?.id ?? "";
  const hasDefense = useHasMycountryPremium("defense");
  const { count: inboxCount } = useDiplomacyInboxCount(country?.id);
  const { data: pending } = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const figures = deriveFigures(country);
  const name = country?.name?.replace(/_/g, " ") ?? "MyCountry";
  const profileHref = country?.slug ? `/countries/${country.slug}` : "/countries";

  return (
    // Clip, not hidden: hidden would make the card a scroll container.
    <Card data-testid="command-document" className="relative overflow-clip">
      <SharedElement name={countryTransitionName("face", country?.slug)}>
        <CountryHeroCard
          frameless
          countryId={countryId}
          countryName={name}
          flagUrl={assetUrl(country?.flagUrl || country?.flag) ?? null}
          stats={{
            population: figures.population ?? 0,
            currentTotalGdp: figures.totalGdp ?? 0,
            gdpPerCapita: figures.gdpPerCapita ?? 0,
          }}
          media={({ insetRight }) => <CommandMedia countryId={countryId} insetRight={insetRight} />}
          identity={<CommandIdentity titleRef={titleRef} />}
          action={
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href={profileHref}>
                <ProfileCircle aria-hidden />
                <span className="max-sm:sr-only">Public profile</span>
              </Link>
            </Button>
          }
          footer={({ rings, openVitality }) => (
            <CommandBand countryId={countryId} rings={rings} onOpenRings={openVitality} />
          )}
        />
      </SharedElement>
      <div className="scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]">
        <DocumentRibbon
          tabs={visibleTabs(hasDefense)}
          activeTab={tabForSection(section)}
          onSelectTab={(tab) => onNavigate?.(tab)}
          counts={{ executive: pending?.total ?? 0, diplomacy: inboxCount }}
          idBase={idBase}
          label="MyCountry sections"
          actions={<CommandActions section={section} onDeclare={onDeclare} size="sm" />}
        />
      </div>
    </Card>
  );
}

export const CommandDocument = React.memo(CommandDocumentComponent);
