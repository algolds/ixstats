"use client";

import { use, useMemo } from "react";
import { usePathname } from "next/navigation";
import { FactbookMetricsProvider } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/shared/modals/FactbookModals";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { FactbookSectionNav } from "../../_components/FactbookSectionNav";
import { FactbookSidebar } from "../../_components/FactbookSidebar";
import { sectionFromPathname } from "~/lib/country/factbook-routes";
import type { VitalityData } from "../../_types";

/**
 * FactbookLayout: persistent shell for the Factbook's section routes (`/factbook/economy`,
 * `/factbook/labor`, ...). The Factbook overview is the country's own URL (`/countries/[slug]`);
 * `/factbook` itself redirects there. Wraps the section page in `FactbookMetricsProvider` (state
 * persists across navigations), renders the inner section pills (Tier 2), the persistent
 * sidebar, and the shared modals.
 */
export default function FactbookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname();
  const section = sectionFromPathname(pathname);
  const { activityRingsData } = useCountryData();

  // The rings are the server's own scores (`countries.getActivityRingsData`); none is estimated here.
  const vitalityData = useMemo<VitalityData | null>(
    () =>
      activityRingsData
        ? {
            economicVitality: activityRingsData.economicVitality,
            populationWellbeing: activityRingsData.populationWellbeing,
            diplomaticStanding: activityRingsData.diplomaticStanding,
            governmentalEfficiency: activityRingsData.governmentalEfficiency,
          }
        : null,
    [activityRingsData]
  );

  return (
    <FactbookMetricsProvider section={section}>
      <div className="space-y-4">
        {/* Tier 2: inner section pills (minimalist text rail + sliding underline) */}
        <FactbookSectionNav countrySlug={slug} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">{children}</div>
          <FactbookSidebar vitalityData={vitalityData} countrySlug={slug} />
        </div>
      </div>

      <FactbookModals />
    </FactbookMetricsProvider>
  );
}
