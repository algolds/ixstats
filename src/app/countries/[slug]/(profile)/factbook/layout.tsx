"use client";

import { use } from "react";
import { usePathname } from "next/navigation";
import { MyCountryTabsList } from "~/components/mycountry/shared/tabs";
import { FactbookMetricsProvider } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { FactbookModals } from "~/components/mycountry/shared/modals/FactbookModals";
import { sectionFromPathname } from "~/lib/wiki-os/adapters/ixstates/factbook-routes";

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

  return (
    <FactbookMetricsProvider section={section}>
      <div className="space-y-6">
        {/* Tier 2 — inner section pills (minimalist text rail + sliding underline) */}
        <div className="w-full min-w-0">
          <MyCountryTabsList
            activeTab={section}
            onChangeAction={() => {}}
            govComponentCount={0}
            baseHref={`/countries/${slug}/factbook`}
            showGovSetupBadge={false}
            variant="underline"
          />
        </div>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>

      <FactbookModals />
    </FactbookMetricsProvider>
  );
}
