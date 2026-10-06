"use client";

import { usePathname } from "next/navigation";
import { MyCountryTabsList } from "~/components/mycountry/shared/tabs";
import { sectionFromPathname } from "~/lib/country/factbook-routes";

/**
 * FactbookSectionNav: Tier 2 navigation inside the Factbook tab, the five section pills
 * (minimalist text rail with a sliding underline). The overview is the country's own URL
 * (`/countries/[slug]`); the other sections are `/countries/[slug]/factbook/<section>`.
 */
export function FactbookSectionNav({ countrySlug }: { countrySlug: string }) {
  const pathname = usePathname();
  return (
    <div className="w-full min-w-0">
      <MyCountryTabsList
        activeTab={sectionFromPathname(pathname ?? "")}
        onChangeAction={() => {}}
        govComponentCount={0}
        baseHref={`/countries/${countrySlug}/factbook`}
        indexHref={`/countries/${countrySlug}`}
        showGovSetupBadge={false}
        variant="underline"
      />
    </div>
  );
}
