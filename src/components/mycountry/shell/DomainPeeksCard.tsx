"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { DOMAIN_TILES } from "./domain-tiles";

/** A plain left click switches section in place; modified clicks keep the link's own behaviour. */
function isPlainLeftClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface DomainPeeksCardProps {
  /** Switches the MyCountry section without a route transition. */
  onNavigate?: (section: string) => void;
}

/**
 * The four MyCountry domains as one navigation list: each row links to its section and shows a
 * one-line peek of real data (the open diplomacy inbox takes precedence on that row).
 */
export function DomainPeeksCard({ onNavigate }: DomainPeeksCardProps) {
  const { country } = useCountryData();
  const { count: inboxCount } = useDiplomacyInboxCount(country?.id);

  return (
    <Card role="region" aria-labelledby="domain-peeks-title" content="navigation">
      <CardHeader className="px-4 pt-4 pb-0">
        <h2 id="domain-peeks-title" className="text-headline text-label">
          Domains
        </h2>
      </CardHeader>
      <CardContent className="px-4 pt-1 pb-3">
        <FacetList variant="plain">
          <FacetListSection aria-label="MyCountry domains">
            {DOMAIN_TILES.map((tile) => {
              const Icon = tile.icon;
              const peek =
                tile.id === "diplomacy" && inboxCount > 0
                  ? `${inboxCount} awaiting your answer`
                  : tile.getPeek(country);
              return (
                <FacetRow
                  key={tile.id}
                  className="pl-0"
                  href={`/mycountry/${tile.id}`}
                  onClick={(event) => {
                    if (!onNavigate || !isPlainLeftClick(event)) return;
                    event.preventDefault();
                    onNavigate(tile.id);
                  }}
                  leading={<Icon className="size-5" />}
                  title={tile.title}
                  trailing={peek}
                />
              );
            })}
          </FacetListSection>
        </FacetList>
      </CardContent>
    </Card>
  );
}
