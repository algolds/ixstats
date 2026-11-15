import React from "react";
import { CountryLink } from "~/components/shared/country-actions/CountryLink";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Community as Handshake } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { formatCompact } from "./trade-commerce-types";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface TradePartnerItem {
  countryId: string;
  countryName: string;
  flagUrl?: string | null;
  /** True when the recorded relation carries a trade treaty. */
  tradeAgreement: boolean;
  /** Recorded bilateral trade volume; 0 when none is recorded. */
  tradeVolume: number;
}

interface TradePartnersManagerProps {
  partners: TradePartnerItem[];
}

export function TradePartnersManager({ partners }: TradePartnersManagerProps) {
  if (partners.length === 0) {
    return (
      <Card className="rounded-card">
        <EmptyState
          compact
          icon={<Handshake />}
          title="No active bilateral trade partners"
          message="Establish diplomatic embassies to negotiate trade pacts."
        />
      </Card>
    );
  }

  return (
    <Card className="rounded-card">
      <CardHeader className="gap-1 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Handshake aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <h3 className="text-label text-headline">Bilateral trade agreements & partners</h3>
          </div>
          <span className="text-label-secondary text-footnote shrink-0 tabular-nums">
            {partners.length} connected
          </span>
        </div>
        <p className="text-label-secondary text-footnote">
          Agreement status comes from your recorded treaties. To sign a free trade agreement,
          propose one from the partner&apos;s country page (Country Actions).
        </p>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <Card
            variant="well"
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
                    Trade volume: ${formatCompact(partner.tradeVolume)}
                  </span>
                )}
              </div>
            </div>

            {partner.tradeAgreement ? (
              <Badge variant="success" className="shrink-0">
                <Handshake aria-hidden="true" />
                Trade treaty
              </Badge>
            ) : (
              <Button asChild variant="outline" size="xs" className="h-11 shrink-0 sm:h-7">
                {/* The nation's actions sheet holds the confirmed free trade proposal. */}
                <CountryLink
                  country={{ id: partner.countryId, name: partner.countryName }}
                  title={`Open ${partner.countryName} to propose a free trade agreement`}
                >
                  <Handshake aria-hidden="true" />
                  Propose FTA
                </CountryLink>
              </Button>
            )}
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
