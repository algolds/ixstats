import React from "react";
import Link from "next/link";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Community as Handshake } from "iconoir-react";
import { cn } from "~/lib/utils";
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
      <div className="border-border/50 text-muted-foreground rounded-xl border border-dashed py-8 text-center text-xs">
        No active bilateral trade partners found. Establish diplomatic embassies to negotiate trade
        pacts.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Bilateral Trade Agreements & Partners
        </h4>
        <span className="text-muted-foreground text-xs">{partners.length} Connected</span>
      </div>
      <p className="text-muted-foreground text-xs">
        Agreement status comes from your recorded treaties. To sign a free trade agreement, propose
        one from the partner&apos;s country page (Country Actions).
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <div
            key={partner.countryId}
            className="border-border/40 bg-card/60 flex items-center justify-between gap-2 rounded-lg border p-2.5 backdrop-blur-sm"
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
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}
              >
                <Handshake className="h-3 w-3" />
                Trade treaty
              </span>
            ) : (
              <Link
                href={`/countries/${partner.countryId}`}
                title={`Open ${partner.countryName} to propose a free trade agreement`}
                className="bg-muted text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
              >
                <Handshake className="h-3 w-3" />
                Propose FTA
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
