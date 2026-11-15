"use client";

import { Globe } from "iconoir-react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { economicRelationsOf } from "~/lib/economy/country-relations";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { api } from "~/trpc/react";
import { RailCard, RailCount } from "../rails/shared";

export function TradeCommerceInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { economicProfile } = economicRelationsOf(country);
  const recordedSectorCount = parseSectorBreakdown(economicProfile?.sectorBreakdown).length;

  const partnerCount = diplomaticRelations?.length ?? 0;
  const ftaCount =
    diplomaticRelations?.filter((r) => r.treaties?.some((t) => t.toLowerCase().includes("trade")))
      ?.length ?? 0;

  return (
    <RailCard
      title="Trade & commerce"
      icon={Globe}
      accessory={<RailCount>{partnerCount} partners</RailCount>}
    >
      <dl className="divide-separator grid grid-cols-2 divide-x">
        <div className="pr-3">
          <dt className="text-label-secondary text-footnote">Free trade pacts</dt>
          <dd className="text-label text-title-3 mt-0.5 tabular-nums">{ftaCount}</dd>
        </div>
        <div className="pl-3">
          <dt className="text-label-secondary text-footnote">Recorded sectors</dt>
          <dd className="text-label text-title-3 mt-0.5 tabular-nums">
            {recordedSectorCount > 0 ? recordedSectorCount : "None"}
          </dd>
        </div>
      </dl>
    </RailCard>
  );
}
