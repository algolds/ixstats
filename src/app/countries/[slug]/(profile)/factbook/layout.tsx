"use client";

import { use, useMemo } from "react";
import { usePathname } from "next/navigation";
import { MyCountryTabsList } from "~/components/mycountry/tabs";
import { FactbookMetricsProvider } from "~/components/mycountry/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/FactbookModals";
import { useCountryData } from "~/components/mycountry/primitives";
import { FactbookSidebar } from "../../_components/FactbookSidebar";
import { calculateVitalityData } from "../../_utils/countryDataTransformers";
import { sectionFromPathname } from "~/lib/wiki";

/**
 * FactbookLayout — persistent shell for all five factbook sections
 * (`/factbook`, `/factbook/economy`, `/factbook/labor`, ...). Wraps the section
 * page in `FactbookMetricsProvider` (state persists across navigations), renders
 * the inner section pills (Tier 2), the persistent sidebar, and the shared modals.
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
  const { country } = useCountryData();

  const vitalityData = useMemo(() => {
    if (!country) return null;
    return calculateVitalityData({
      economicTier: country.economicTier,
      adjustedGdpGrowth: country.adjustedGdpGrowth,
      populationGrowthRate: country.populationGrowthRate,
      populationDensity: country.populationDensity ?? null,
    });
  }, [country]);

  return (
    <FactbookMetricsProvider section={section}>
      <div className="space-y-4">
        {/* Tier 2 — inner section pills (minimalist text rail + sliding underline) */}
        <div className="min-w-0 w-full">
          <MyCountryTabsList
            activeTab={section}
            onChangeAction={() => {}}
            govComponentCount={0}
            baseHref={`/countries/${slug}/factbook`}
            showGovSetupBadge={false}
            variant="underline"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">{children}</div>
          <FactbookSidebar vitalityData={vitalityData} countrySlug={slug} />
        </div>
      </div>

      <FactbookModals />
    </FactbookMetricsProvider>
  );
}
