"use client";

import { Button } from "~/components/ui/button";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useDust } from "~/hooks/cards/useWorkshop";

/**
 * Your dust: the total on a button, each realm's balance in a popover (dust crafts that realm's cards). Nothing shows
 * until the balances arrive, so the total never reads 0 while it loads.
 */
export function DustBalances() {
  const { data } = useDust();
  if (!data) return null;
  const total = data.reduce((sum, d) => sum + d.balance, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="tabular-nums">
          Dust: {total.toLocaleString()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        {data.length > 0 ? (
          <FacetListSection
            header="Dust by realm"
            footer="Dust crafts cards from its own realm."
            variant="plain"
          >
            {data.map((d) => (
              <FacetRow key={d.realmId} title={d.realmName} trailing={d.balance.toLocaleString()} />
            ))}
          </FacetListSection>
        ) : (
          <p className="text-footnote text-label-secondary">
            No dust yet. Break down copies you don&apos;t need.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
