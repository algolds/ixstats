"use client";

import { use } from "react";
import { usePathname } from "next/navigation";
import { FactbookMetricsProvider } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/shared/modals/FactbookModals";
import { FactbookSectionNav } from "../../_components/FactbookSectionNav";
import { sectionFromPathname } from "~/lib/country/factbook-routes";

/**
 * FactbookLayout: persistent shell for the Factbook's section routes (`/factbook/economy`,
 * `/factbook/labor`, ...). The Factbook overview is the country's own URL (`/countries/[slug]`);
 * `/factbook` itself redirects there. Wraps the section page in `FactbookMetricsProvider` (state
 * persists across navigations), renders the inner section pills (Tier 2) and the shared modals.
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

  return (
    <FactbookMetricsProvider section={section}>
      <div className="space-y-4">
        {/* Tier 2: inner section pills (minimalist text rail + sliding underline) */}
        <FactbookSectionNav countrySlug={slug} />

        <div className="min-w-0 space-y-6">{children}</div>
      </div>

      <FactbookModals />
    </FactbookMetricsProvider>
  );
}
