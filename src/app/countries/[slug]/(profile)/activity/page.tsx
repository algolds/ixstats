"use client";

import { useCountryData } from "~/components/mycountry/primitives";
import { CountryActivityPanel } from "../../_components/CountryActivityPanel";

/**
 * ActivityPage — `/countries/[slug]/activity`. Renders the full public
 * activity feed for the country profile. Data flows from the
 * `CountryDataProvider` mounted in the `(profile)` layout.
 */
export default function ActivityPage() {
  const { country } = useCountryData();

  if (!country) return null;

  return <CountryActivityPanel countryId={country.id} countryName={country.name} />;
}
