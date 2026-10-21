"use client";

import { useState } from "react";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SearchField } from "~/components/ui/search-field";
import { usePartnerSearch, type TradePartnerView } from "~/hooks/cards/useTradeBuilder";

/** Find a trade partner by IxnayID handle. */
export function TradePartnerPicker({ onPick }: { onPick: (partner: TradePartnerView) => void }) {
  const [query, setQuery] = useState("");
  const { data } = usePartnerSearch(query);

  return (
    <div className="space-y-2">
      <SearchField
        placeholder="IxnayID handle, like @ixnay"
        value={query}
        onValueChange={setQuery}
        aria-label="Find a player by handle"
      />
      {data && data.length > 0 && (
        <FacetListSection aria-label="Players" variant="plain">
          {data.map((p) => {
            const subtitle = !p.privacy.allowed
              ? "Not taking offers from you"
              : (p.countryName ?? p.displayName ?? "a player");
            return (
              <FacetRow
                key={p.id}
                title={`@${p.handle}`}
                subtitle={subtitle}
                disabled={!p.privacy.allowed}
                onClick={() => onPick(p)}
              />
            );
          })}
        </FacetListSection>
      )}
    </div>
  );
}
