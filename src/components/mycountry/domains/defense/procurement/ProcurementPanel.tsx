"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { useDefenseOverview, useProcurement } from "~/hooks/useDefenseConsole";
import type { EquipmentPreset } from "~/lib/military/player-catalog";
import { BRANCH_DOMAINS } from "~/lib/military/model";
import { IndustryCard } from "./IndustryCard";
import { OpenOrders } from "./OpenOrders";
import { CatalogBrowser } from "./CatalogBrowser";
import { OrderSheet } from "./OrderSheet";

/** The Procurement tab: domestic industry, open orders and the catalog. */
export function ProcurementPanel({ countryId }: { countryId: string }) {
  const { owner } = useDefenseOverview(countryId);
  const { canEdit } = useCanEdit();
  const procurement = useProcurement(countryId, owner !== null);
  const reader = useNationClock();
  const now = useClockNow(reader);
  const [ordering, setOrdering] = useState<EquipmentPreset | null>(null);
  const catalog = api.militaryEquipment.getPlayerCatalog.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!owner) {
    return <Skeleton className="h-64 w-full" aria-label="Loading procurement" />;
  }
  const nowClockMs = now ?? owner.clockMs;
  const domains = BRANCH_DOMAINS.filter((d) => owner.branches.some((b) => b.domain === d));
  const branchNames = new Map(owner.branches.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <IndustryCard overview={owner} />
        <OpenOrders
          orders={procurement.orders}
          branchNames={branchNames}
          reader={reader}
          nowClockMs={nowClockMs}
          canEdit={canEdit}
          onCancel={procurement.cancelOrder}
        />
      </div>
      <CatalogBrowser
        equipment={catalog.data?.equipment ?? []}
        domains={domains}
        accessibleYear={owner.procurement.accessibleYear}
        canEdit={canEdit}
        isLoading={catalog.isLoading}
        onOrder={setOrdering}
      />
      {canEdit && (
        <OrderSheet
          key={ordering?.key ?? "none"}
          item={ordering}
          overview={owner}
          reader={reader}
          nowClockMs={nowClockMs}
          pending={procurement.placing}
          onOpenChange={(open) => {
            if (!open) setOrdering(null);
          }}
          onPlace={(order) => procurement.placeOrder(order, () => setOrdering(null))}
        />
      )}
    </div>
  );
}
