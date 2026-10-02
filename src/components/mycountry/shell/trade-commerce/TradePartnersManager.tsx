import React from "react";
import Link from "next/link";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Community as Handshake } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatCompact } from "./trade-commerce-types";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
      <Card className="rounded-card border-dashed px-4 py-8 text-center">
        <p className="text-label-secondary text-footnote">
          No active bilateral trade partners found. Establish diplomatic embassies to negotiate
          trade pacts.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-card">
      <CardHeader className="gap-1 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Handshake aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <h3 className="text-label text-headline">Bilateral Trade Agreements & Partners</h3>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {partners.length} connected
          </Badge>
        </div>
        <p className="text-label-secondary text-footnote">
          Agreement status comes from your recorded treaties. To sign a free trade agreement,
          propose one from the partner&apos;s country page (Country Actions).
        </p>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <Card
            variant="inset"
            key={partner.countryId}
            className="flex items-center justify-between gap-2 p-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <UnifiedCountryFlag
                flagUrl={partner.flagUrl}
                countryName={partner.countryName}
                className="h-4 w-6 shrink-0 rounded-xs object-cover"
              />
              <div className="min-w-0">
                <span className="text-label text-caption block truncate">
                  {partner.countryName}
                </span>
                {partner.tradeVolume > 0 && (
                  <span className="text-label-secondary text-footnote block">
                    Trade volume: {currencySymbol}
                    {formatCompact(partner.tradeVolume)}
                  </span>
                )}
              </div>
            </div>

            {partner.tradeAgreement ? (
              <Badge variant="green" className="shrink-0">
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
          </Card>
        ))}
      </CardContent>
    </Card>
  );
});
