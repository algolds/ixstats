// src/components/wikios/reader/InfoboxWithMap.tsx
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
  { ssr: false, loading: () => <div style={{ height: 200, background: "rgba(255,255,255,0.02)" }} /> }
);

interface InfoboxWithMapProps {
  infoboxHtml: string;
  articleTitle: string;
}

export function InfoboxWithMap({ infoboxHtml, articleTitle }: InfoboxWithMapProps) {
  const { data: countries } = api.countries.getSelectList.useQuery(
    { search: articleTitle, limit: 5 },
    { staleTime: 10 * 60 * 1000 }
  );

  const matchedCountry = useMemo(() => {
    if (!countries || countries.length === 0) return null;
    return countries.find(
      (c) => c.name?.toLowerCase() === articleTitle.toLowerCase()
    ) ?? null;
  }, [countries, articleTitle]);

  return (
    <aside className="wikios-infobox glass-hierarchy-child">
      <div dangerouslySetInnerHTML={{ __html: infoboxHtml }} />
      {matchedCountry && (
        <div className="wikios-infobox-map-embed">
          <CountryMapEmbed
            countryId={matchedCountry.id}
            height="h-48"
            showNeighbors
            showCities
            interactive
          />
        </div>
      )}
    </aside>
  );
}
