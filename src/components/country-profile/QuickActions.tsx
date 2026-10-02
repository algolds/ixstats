"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Calculator, Map as MapIcon, OpenBook, Page, StatsReport } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";

const CountryComparisonModal = dynamic(
  () =>
    import("~/app/countries/_components/CountryComparisonModal").then((m) => ({
      default: m.CountryComparisonModal,
    })),
  { ssr: false }
);

export interface QuickActionsProps {
  countryId: string;
  /** The country's URL slug (`/countries/[slug]/…`). */
  slug: string;
  wikiHref: string | null;
  hasGeometry: boolean;
  layout?: "stack" | "row";
  className?: string;
}

/**
 * QuickActions — the Command dock's sovereign tools: Compare (the explore comparison modal,
 * loaded on demand), the Factbook deep-dive, economic modeling, Open on map and the wiki
 * article. Gray buttons: the one filled button on the page is the header's Country Actions.
 */
export function QuickActions({
  countryId,
  slug,
  wikiHref,
  hasGeometry,
  layout = "stack",
  className,
}: QuickActionsProps) {
  const [compareOpen, setCompareOpen] = useState(false);
  const countries = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { enabled: compareOpen, staleTime: 10 * 60_000 }
  );
  const item = cn("justify-start", layout === "stack" && "w-full");

  return (
    <>
      <div
        className={cn(
          layout === "stack" ? "flex flex-col gap-1" : "flex flex-wrap gap-2",
          className
        )}
      >
        <Button variant="secondary" size="sm" className={item} onClick={() => setCompareOpen(true)}>
          <StatsReport aria-hidden />
          Compare
        </Button>
        <Button asChild variant="secondary" size="sm" className={item}>
          <Link href={createUrl(`/countries/${slug}/factbook`)}>
            <Page aria-hidden />
            Factbook deep-dive
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className={item}>
          <Link href={createUrl(`/countries/${slug}/modeling`)}>
            <Calculator aria-hidden />
            Economic modeling
          </Link>
        </Button>
        {hasGeometry && (
          <Button asChild variant="secondary" size="sm" className={item}>
            <Link href={createUrl(`/maps?country=${encodeURIComponent(countryId)}`)}>
              <MapIcon aria-hidden />
              Open on map
            </Link>
          </Button>
        )}
        {wikiHref && (
          <Button asChild variant="secondary" size="sm" className={item}>
            <Link href={createUrl(wikiHref)}>
              <OpenBook aria-hidden />
              Wiki article
            </Link>
          </Button>
        )}
      </div>
      {compareOpen && (
        <CountryComparisonModal
          isOpen={compareOpen}
          onClose={() => setCompareOpen(false)}
          availableCountries={(countries.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            continent: c.continent ?? null,
            economicTier: c.economicTier ?? "Unknown",
          }))}
        />
      )}
    </>
  );
}
