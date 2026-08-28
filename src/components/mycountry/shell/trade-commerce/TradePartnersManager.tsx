import React from "react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { Community as Handshake, Lock } from "iconoir-react";
import { cn } from "~/lib/utils";

interface TradePartnerItem {
  countryId: string;
  countryName: string;
  flagUrl?: string | null;
  status: string;
  tradeAgreement: boolean;
}

interface TradePartnersManagerProps {
  partners: TradePartnerItem[];
  onToggleAgreement: (countryId: string) => void;
}

export const TradePartnersManager = React.memo(function TradePartnersManager({
  partners,
  onToggleAgreement,
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

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <div
            key={partner.countryId}
            className="border-border/40 bg-card/60 flex items-center justify-between rounded-lg border p-2.5 backdrop-blur-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <UnifiedCountryFlag
                flagUrl={partner.flagUrl}
                countryName={partner.countryName}
                className="h-4 w-6 shrink-0 rounded object-cover"
              />
              <span className="text-foreground truncate text-xs font-medium">
                {partner.countryName}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onToggleAgreement(partner.countryId)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                partner.tradeAgreement
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Handshake className="h-3 w-3" />
              {partner.tradeAgreement ? "Free Trade" : "Standard"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
