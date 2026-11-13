"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, MoreHoriz, NavArrowRight } from "iconoir-react";
import { LensCard } from "~/components/ui/lens-card";
import { Button } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { HealthRing } from "~/components/ui/health-ring";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { heroRings, vitalityStanding } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { api, type RouterOutputs } from "~/trpc/react";
import { useHydrated } from "~/hooks/useHydrated";
import { cn } from "~/lib/utils";

type ExploreCountry = RouterOutputs["countries"]["getCountriesToExplore"][number];
/** The menu stays mounted after its first open so it can animate closed. */
type ActionsMenu = { country: ExploreCountry; open: boolean } | null;

/**
 * Four nations of the viewer's realm to discover, weighted toward the least followed: who they are (flag, name),
 * how they are doing (vitality standing) and everything you can do with them (the country actions
 * menu). The name opens the profile.
 */
export function CountriesToExploreCard({ currentUserCountryId }: { currentUserCountryId: string }) {
  // A random pick is fetched in the browser only, never during the server render.
  const hydrated = useHydrated();
  const { data: countries } = api.countries.getCountriesToExplore.useQuery(
    { limit: 4 },
    { enabled: hydrated, staleTime: 0 }
  );
  const [menu, setMenu] = useState<ActionsMenu>(null);

  if (!countries || countries.length === 0) return null;

  return (
    <LensCard padding="md" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <CardTitle icon={<Globe />}>Countries to explore</CardTitle>
        <Link
          href="/countries"
          className="text-label-secondary hover:text-label text-footnote duration-fast focus-visible:outline-tint rounded-control-sm inline-flex items-center gap-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          All
          <NavArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      <ul data-content="feed">
        {countries.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 py-1 last:pb-0">
            {/* A fixed slot, so names line up whatever the flag's proportions. */}
            <span className="flex w-8 shrink-0 justify-center">
              <UnifiedCountryFlag
                showTooltip={false}
                countryName={c.name}
                flagUrl={c.flagUrl}
                size="sm"
                className="max-w-8"
              />
            </span>
            <Link
              href={`/countries/${c.slug}`}
              className="text-label text-subhead focus-visible:outline-tint rounded-control-sm min-w-0 flex-1 truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {c.name}
            </Link>
            <CountryStanding countryId={c.id} />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Actions for ${c.name}`}
              className="shrink-0 pointer-coarse:size-11"
              onClick={() => setMenu({ country: c, open: true })}
            >
              <MoreHoriz aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {menu && (
        <CountryActionsMenu
          targetCountryId={menu.country.id}
          targetCountryName={menu.country.name}
          viewerCountryId={currentUserCountryId || undefined}
          isOpen={menu.open}
          onClose={() => setMenu({ ...menu, open: false })}
        />
      )}
    </LensCard>
  );
}

/** Vitality standing: a ring and its rating, as on the profile hero. Region and more are in the actions menu. */
function CountryStanding({ countryId }: { countryId: string }) {
  const { data } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { staleTime: 5 * 60_000 }
  );
  const standing = data ? vitalityStanding(heroRings(data)) : null;
  if (!standing) return null;
  return (
    <div className={cn("text-footnote flex shrink-0 items-center gap-1.5", standing.color)}>
      <HealthRing value={standing.score} size={14} color="currentColor" label="Vitality standing" />
      {standing.label}
    </div>
  );
}
