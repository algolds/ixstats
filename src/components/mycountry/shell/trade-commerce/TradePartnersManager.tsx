import React from "react";
import Link from "next/link";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Community as Handshake } from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatCompact } from "./trade-commerce-types";

interface TradePartnerItem {
  countryId: string;
  countryName: string;
  flagUrl?: string | null;
  status: string;
  /** True when the recorded relation carries a trade treaty. */
  tradeAgreement: boolean;
  /** Recorded bilateral trade volume; 0 when none is recorded. */
  tradeVolume: number;
}

interface TradePartnersManagerProps {
  partners: TradePartnerItem[];
  currencySymbol?: string;
}

export const TradePartnersManager = React.memo(function TradePartnersManager({
  partners,
  currencySymbol = "$",
}: TradePartnersManagerProps) {
  if (partners.length === 0) {
    return (
      <FacetCard surface="solid" className="rounded-2xl border-dashed px-4 py-8 text-center">
        <p className="text-muted-foreground text-xs">
          No active bilateral trade partners found. Establish diplomatic embassies to negotiate
          trade pacts.
        </p>
      </FacetCard>
    );
  }

  return (
    <FacetCard surface="solid" className="rounded-2xl">
      <FacetCardHeader className="gap-1 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Handshake aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
            <h3 className="text-foreground text-sm font-semibold">
              Bilateral Trade Agreements & Partners
            </h3>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {partners.length} connected
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          Agreement status comes from your recorded treaties. To sign a free trade agreement,
          propose one from the partner&apos;s country page (Country Actions).
        </p>
      </FacetCardHeader>

      <FacetCardContent className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <FacetCard
            key={partner.countryId}
            surface="solid"
            className="flex items-center justify-between gap-2 rounded-xl p-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <UnifiedCountryFlag
                flagUrl={partner.flagUrl}
                countryName={partner.countryName}
                className="h-4 w-6 shrink-0 rounded object-cover"
              />
              <div className="min-w-0">
                <span className="text-foreground block truncate text-xs font-medium">
                  {partner.countryName}
                </span>
                {partner.tradeVolume > 0 && (
                  <span className="text-muted-foreground block text-xs">
                    Trade volume: {currencySymbol}
                    {formatCompact(partner.tradeVolume)}
                  </span>
                )}
              </div>
            </div>

            {partner.tradeAgreement ? (
              <Badge variant="outline" className="shrink-0 text-emerald-600">
                <Handshake aria-hidden="true" />
                Trade treaty
              </Badge>
            ) : (
              <Button asChild variant="outline" size="xs" className="h-11 shrink-0 sm:h-7">
                <Link
                  href={`/countries/${partner.countryId}`}
                  title={`Open ${partner.countryName} to propose a free trade agreement`}
                >
                  <Handshake aria-hidden="true" />
                  Propose FTA
                </Link>
              </Button>
            )}
          </FacetCard>
        ))}
      </FacetCardContent>
    </FacetCard>
  );
});
