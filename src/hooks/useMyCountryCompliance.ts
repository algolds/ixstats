import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { readSavedRates } from "~/lib/economy/tax-channels";
import { economicRelationsOf } from "~/lib/economy/country-relations";
import { complianceSections } from "~/lib/mycountry/compliance";

export type { ComplianceSectionStatus } from "~/lib/mycountry/compliance";

/** The images live on the Country row (`flag`, `coatOfArms`), not on the national identity. */
interface CountryImages {
  flag?: string | null;
  coatOfArms?: string | null;
}

export function useMyCountryCompliance() {
  const { country, userProfile } = useCountryData();
  const countryId = country?.id ?? userProfile?.countryId ?? "";

  const { data: government, isLoading: governmentLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: Boolean(countryId) }
  );

  const sections = useMemo(() => {
    if (!countryId || !country) return [];
    const images = country as CountryImages;
    const saved = readSavedRates(economicRelationsOf(country).fiscalSystem);
    return complianceSections({
      flag: images.flag,
      coatOfArms: images.coatOfArms,
      identity: country.nationalIdentity,
      government,
      hasTaxRates: Object.values(saved).some((r) => r.rate !== null),
    });
  }, [countryId, country, government]);

  const isCompliant = sections.length > 0 && sections.every((s) => s.isComplete);

  return { sections, isCompliant, loading: governmentLoading, countryId };
}
