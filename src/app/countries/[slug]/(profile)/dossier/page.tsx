"use client";

import { useCountryData } from "~/components/mycountry/primitives";
import { DossierTab } from "~/components/countries/DossierTab";

/**
 * DossierPage — `/countries/[slug]/dossier`. Renders the wiki-synced dossier +
 * native-lore canvas for the public country profile. Data flows from the
 * `CountryDataProvider` mounted in the `(profile)` layout.
 */
export default function DossierPage() {
  const { country } = useCountryData();

  if (!country) return null;

  return (
    <DossierTab
      countryName={country.name}
      countryData={{
        currentPopulation: country.currentPopulation,
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        economicTier: country.economicTier,
        continent: country.continent ?? undefined,
        governmentType: country.governmentType ?? undefined,
      }}
      viewerClearanceLevel="PUBLIC"
    />
  );
}
