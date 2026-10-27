"use client";

import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { conditionPillars, toDnaAxes } from "./derive";
import type { HeroCover } from "./HeroMedia";
import { ProfileHero } from "./ProfileHero";
import { StandingBand } from "./StandingBand";

/** Approval and stability are already among the panel's figures. */
const PANEL_READINGS = new Set(["approval", "stability"]);

/**
 * ProfileFace — the country document's face from the profile layer: `ProfileHero` with the
 * identity, figures and Country DNA footer row filled in.
 */
export function ProfileFace({
  layer,
  cover,
  action,
  onExpandMap,
}: {
  layer: CountryProfileLayer;
  cover: HeroCover | null;
  action?: React.ReactNode;
  onExpandMap?: () => void;
}) {
  const { identity, vitals, land, world, state } = layer;
  return (
    <ProfileHero
      countryId={layer.countryId}
      slug={layer.slug}
      name={identity.name}
      officialName={identity.officialName}
      flagUrl={identity.flagUrl}
      region={[identity.continent, identity.region].filter(Boolean).join(" · ") || null}
      governmentType={state.government?.type ?? identity.governmentType}
      capital={identity.capital ?? land.capital?.name}
      realm={identity.realm}
      sovereign={identity.sovereign}
      claim={identity.claim}
      stats={{
        population: vitals.population ?? 0,
        currentTotalGdp: vitals.gdpTotal ?? 0,
        gdpPerCapita: vitals.gdpPerCapita ?? 0,
      }}
      cover={cover}
      action={action}
      onExpandMap={onExpandMap}
      footer={({ rings, openVitality }) => (
        <StandingBand
          axes={toDnaAxes(world.rankings)}
          pillars={conditionPillars(vitals).filter((p) => !PANEL_READINGS.has(p.key))}
          rings={rings}
          onOpenRings={openVitality}
        />
      )}
    />
  );
}
