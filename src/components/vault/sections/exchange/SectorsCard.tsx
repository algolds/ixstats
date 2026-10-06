"use client";

import { useState } from "react";
import { StatUp } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { formatSovereigns, parseAmount, useRequestId } from "./shared";

type Sector = RouterOutputs["exchange"]["getSectors"][number];

/** A small line of the index's recent values. */
function IndexLine({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) {
    return <p className="text-caption text-label-secondary">History appears after two updates.</p>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((v, i) => `${(i / (points.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={`${label} index, last ${points.length} updates`}
    >
      <polyline
        points={path}
        className="stroke-tint fill-none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SectorTile({
  sector,
  isOpen,
  onDone,
}: {
  sector: Sector;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [raw, setRaw] = useState("");
  const [buyId, rotateBuy] = useRequestId();
  const [sellId, rotateSell] = useRequestId();
  const amount = parseAmount(raw);
  const first = sector.history[0]?.value ?? sector.value;
  const change = first > 0 ? ((sector.value - first) / first) * 100 : 0;

  const buy = api.exchange.buySectorUnits.useMutation({
    onSuccess: (r) => {
      notify.success("Units bought", `${formatSovereigns(r.sovereigns)} in ${sector.label}`);
      setRaw("");
      rotateBuy();
      onDone();
    },
    onError: (e) => notify.error("Could not buy", e.message),
  });
  const sell = api.exchange.sellSectorUnits.useMutation({
    onSuccess: (r) => {
      notify.success("Units sold", `${formatSovereigns(r.sovereigns)} back to your wallet`);
      rotateSell();
      onDone();
    },
    onError: (e) => notify.error("Could not sell", e.message),
  });

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body text-label font-medium">{sector.label}</p>
        <p className="text-body text-label font-medium tabular-nums">
          {sector.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </p>
      </div>
      <IndexLine points={sector.history.map((h) => h.value)} label={sector.label} />
      <p className="text-caption text-label-secondary">
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}% over the shown period · unit {formatSovereigns(sector.unitPrice)} ·
        fund {formatSovereigns(sector.fund)}
      </p>
      {sector.position && (
        <p className="text-footnote text-label">
          You hold {sector.position.units.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
          units worth {formatSovereigns(sector.position.value)}
        </p>
      )}
      {isOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24">
            <Input
              aria-label={`Sovereigns to put in ${sector.label}`}
              inputMode="numeric"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Amount"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={buy.isPending || Number.isNaN(amount)}
            onClick={() => buy.mutate({ sectorKey: sector.sectorKey, amount, requestId: buyId })}
          >
            Buy
          </Button>
          {sector.position && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={sell.isPending}
                onClick={() =>
                  sell.mutate({ sectorKey: sector.sectorKey, fraction: 0.5, requestId: sellId })
                }
              >
                Sell half
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={sell.isPending}
                onClick={() =>
                  sell.mutate({ sectorKey: sector.sectorKey, fraction: 1, requestId: sellId })
                }
              >
                Sell all
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/** The four sector indices, their history and the sector funds. */
export function SectorsCard({ isOpen, onChanged }: { isOpen: boolean; onChanged: () => void }) {
  const sectors = api.exchange.getSectors.useQuery();
  const refresh = () => {
    void sectors.refetch();
    onChanged();
  };
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<StatUp />}>Sectors</CardTitle>
      <p className="text-footnote text-label-secondary">
        Each index follows company capital, standing and completed contracts in its sector, moving
        at most 5% per update. Funds are rebalanced toward the sectors that outperform; no
        Sovereigns are created, so gains come from the other funds. Sell 24 hours after buying.
      </p>
      {sectors.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(sectors.data ?? []).map((s) => (
            <SectorTile key={s.sectorKey} sector={s} isOpen={isOpen} onDone={refresh} />
          ))}
        </div>
      )}
    </Card>
  );
}
