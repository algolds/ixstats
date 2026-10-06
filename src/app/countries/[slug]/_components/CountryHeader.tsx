"use client";

import { CountryHero } from "~/components/country-profile/CountryHero";
import { headlineVitals } from "~/components/country-profile/vitals";
import { realNumber } from "../_utils/profileLayer";
import { useProfileShell } from "./ProfileShellContext";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * CountryHeader: the header of the Factbook sections, the Dossier and Activity: the country's
 * hero (cover, flag, name, realm and IxnayID, identity strip, headline figures) from the loaded
 * country record. The Factbook overview (`/countries/[slug]`) renders the same `CountryHero` from
 * the richer profile layer (wiki infobox fallbacks) inside `CommandProfileView`.
 */
export function CountryHeader() {
  const { country, flagUrl, cover } = useProfileShell();
  // `getByIdWithEconomicData` returns `any`; narrow the fields the header reads.
  const c = country as Record<string, any>;
  const identity = (c.nationalIdentity ?? null) as Record<string, unknown> | null;
  const name = String(c.name).replace(/_/g, " ");

  const stats = headlineVitals({
    population: realNumber(c.currentPopulation),
    populationGrowth: realNumber(c.populationGrowthRate, { allowZero: true }),
    populationTier: str(c.populationTier),
    gdpTotal: realNumber(c.currentTotalGdp),
    gdpGrowth: realNumber(c.adjustedGdpGrowth, { allowZero: true }),
    gdpPerCapita: realNumber(c.currentGdpPerCapita),
    economicTier: str(c.economicTier),
    landArea: realNumber(c.landArea),
    density: realNumber(c.populationDensity),
  });

  return (
    <CountryHero
      name={name}
      officialName={str(identity?.officialName)}
      flagUrl={flagUrl}
      eyebrow={[str(c.continent), str(c.region)].filter(Boolean).join(" · ") || null}
      motto={str(identity?.motto)}
      facts={[
        { label: "Capital", value: str(identity?.capitalCity) },
        { label: "Anthem", value: str(identity?.nationalAnthem) },
        { label: "Demonym", value: str(identity?.demonym) },
      ]}
      realm={c.realm ? { name: String(c.realm.name), slug: String(c.realm.slug) } : null}
      sovereign={
        c.owner
          ? {
              username: str(c.owner.forumUsername) ?? str(c.owner.wikiUsername),
              roleName: str(c.owner.role?.displayName) ?? str(c.owner.role?.name),
            }
          : null
      }
      stats={stats}
      cover={cover}
      countrySlug={str(c.slug) ?? name.replace(/\s+/g, "_")}
    />
  );
}
