"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import Link from "next/link";
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
 * The four MyCountry domains as quick-action tiles for the overview rail: each links to its section
 * and shows a peek of real data (the open diplomacy inbox takes precedence on that tile).
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
      <CardContent className="p-4 pt-3">
        <ul aria-label="MyCountry domains" className="grid grid-cols-2 gap-2">
          {DOMAIN_TILES.map((tile) => {
            const Icon = tile.icon;
            const peek =
              tile.id === "diplomacy" && inboxCount > 0
                ? `${inboxCount} awaiting your answer`
                : tile.getPeek(country);
            return (
              <li key={tile.id} className="min-w-0">
                <Link
                  href={`/mycountry/${tile.id}`}
                  onClick={(event) => {
                    if (!onNavigate || !isPlainLeftClick(event)) return;
                    event.preventDefault();
                    onNavigate(tile.id);
                  }}
                  className="facet-well rounded-row facet-press-subtle hover:bg-fill-4 focus-visible:outline-tint duration-fast flex h-full min-h-11 flex-col gap-1 p-3 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Icon className="text-tint size-5" aria-hidden />
                  <span className="text-callout text-label mt-1 font-semibold">{tile.title}</span>
                  <span className="text-footnote text-label-secondary line-clamp-2">{peek}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
