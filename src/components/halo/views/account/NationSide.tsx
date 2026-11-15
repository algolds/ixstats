"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import {
  destinationsFor,
  OpenIn,
  PosterHeader,
  VitalityStrip,
} from "~/components/mycountry/dossier/CountryActionsHeader";
import {
  EditNationMenu,
  ManageGrid,
  ShareCountryButton,
} from "~/components/mycountry/dossier/CountryActionsParts";
import { HeroDetailModal } from "~/components/shared/country-hero/CountryHeroCard";
import type { HeroModal } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { HaloWell } from "../shared/HaloViewParts";

export interface NationSideProps {
  country: { id: string; name: string };
  membershipTier: string | null | undefined;
  /** Closes Halo, then routes to `path`. */
  onNavigate: (path: string) => void;
  /** Closes Halo (a link in the poster or Open in navigates by itself). */
  onClose: () => void;
}

/**
 * Halo's Nation side: the viewer's nation as the country actions sheet shows it (poster, vitality, Manage, Open in),
 * in Halo's size, with the membership tier on the poster. Passport is left out of Open in: it is the other side of
 * the switch.
 */
export function NationSide({ country, membershipTier, onNavigate, onClose }: NationSideProps) {
  const [detail, setDetail] = useState<HeroModal | null>(null);
  const { data: facts } = api.countries.getByIdBasic.useQuery({ id: country.id });
  const { data: detailRings } = api.countries.getActivityRingsData.useQuery(
    { countryId: country.id },
    { enabled: detail === "vitality", staleTime: 5 * 60_000 }
  );
  const destinations = destinationsFor(country.id, country.name, facts ?? null).filter(
    (d) => d.label !== "Passport"
  );
  const premium = membershipTier === "mycountry_premium";

  return (
    <div className="space-y-2">
      <PosterHeader
        countryId={country.id}
        name={country.name}
        isOwnCountry
        enabled
        onNavigate={onClose}
        size="halo"
        badges={
          <Badge variant={premium ? "warning" : "default"}>{premium ? "Premium" : "Basic"}</Badge>
        }
        corner={
          <>
            <EditNationMenu onNavigate={onNavigate} />
            <ShareCountryButton name={country.name} slugOrId={facts?.slug ?? country.id} />
          </>
        }
      >
        <VitalityStrip countryId={country.id} enabled onOpen={setDetail} />
      </PosterHeader>
      <HaloWell>
        <ManageGrid onNavigate={onNavigate} />
      </HaloWell>
      <HaloWell>
        <OpenIn destinations={destinations} onNavigate={onClose} />
      </HaloWell>
      {detail && (
        <HeroDetailModal
          modal={detail}
          countryId={country.id}
          countryName={country.name}
          ringData={detailRings}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
