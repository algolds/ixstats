// src/components/wiki-os/reader/InfoboxWithMap.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapPreview").then((m) => ({
      default: m.CountryMapPreview,
    })),
  {
    ssr: false,
    loading: () => <div style={{ height: 200, background: "rgba(255,255,255,0.02)" }} />,
  }
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
    return (
      countries.find(
        (c: { name: string }) => c.name?.toLowerCase() === articleTitle.toLowerCase()
      ) ?? null
    );
  }, [countries, articleTitle]);

  const { data: blurbData } = api.blurbs.getResponsesForCountry.useInfiniteQuery(
    { countryId: matchedCountry?.id ?? "", limit: 3 },
    {
      enabled: !!matchedCountry,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const blurbs = blurbData?.pages.flatMap((p) => p.responses) ?? [];

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
          />
        </div>
      )}
      {matchedCountry && blurbs.length > 0 && (
        <div className="wikios-infobox-blurbs">
          <h3 className="wikios-infobox-blurbs-title">Blurbs</h3>
          {blurbs.map((r) => (
            <Link
              key={r.id}
              href={withBasePath(`/blurbs/${r.prompt.slug}`)}
              className="wikios-infobox-blurb-item"
            >
              <span className="wikios-infobox-blurb-prompt">{r.prompt.title}</span>
              <span className="wikios-infobox-blurb-content">{r.content}</span>
            </Link>
          ))}
          <Link href={withBasePath("/blurbs")} className="wikios-infobox-blurbs-more">
            View all blurbs →
          </Link>
        </div>
      )}
    </aside>
  );
}
