"use client";

import { useState } from "react";
import { StatUp } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { formatSovereigns, parseAmount, useRequestId, type Sector } from "./shared";

type SectorRow = RouterOutputs["exchange"]["getSectors"][number];

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
  realmId,
  sector,
  isOpen,
  onDone,
}: {
  realmId: string;
  sector: SectorRow;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [tileState, setTileState] = useState({
    raw: "",
    dmOpen: false,
    rawDm: String(sector.dmModifier),
  });
  const [buyId, rotateBuy] = useRequestId();
  const [sellId, rotateSell] = useRequestId();
  const amount = parseAmount(tileState.raw);
  const dmValue = Number(tileState.rawDm);
  const dmValid = Number.isFinite(dmValue) && dmValue >= -0.5 && dmValue <= 2;
  const first = sector.history[0]?.value ?? sector.value;
  const change = first > 0 ? ((sector.value - first) / first) * 100 : 0;

  const buy = api.exchange.buySectorUnits.useMutation({
    onSuccess: (r) => {
      notify.success("Units bought", `${formatSovereigns(r.sovereigns)} in ${sector.label}`);
      setTileState((prev) => ({ ...prev, raw: "" }));
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
  const setDm = api.exchange.setSectorDmModifier.useMutation({
    onSuccess: () => {
      notify.success("Sector modifier updated");
      setTileState((prev) => ({ ...prev, dmOpen: false }));
      onDone();
    },
    onError: (e) => notify.error("Could not update modifier", e.message),
  });

  const sectorKey = sector.sectorKey as Sector;

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-body text-label font-medium">{sector.label}</p>
          <Badge variant="outline">
            Macro {(sector.macroWeight * 100).toFixed(0)}%
          </Badge>
          {sector.dmModifier !== 0 && (
            <Badge variant={sector.dmModifier > 0 ? "info" : "warning"}>
              DM {sector.dmModifier > 0 ? "+" : ""}
              {Math.round(sector.dmModifier * 100)}%
            </Badge>
          )}
        </div>
        <p className="text-body text-label font-medium tabular-nums">
          {sector.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </p>
      </div>
      <IndexLine points={sector.history.map((h) => h.value)} label={sector.label} />
      <p className="text-caption text-label-secondary tabular-nums">
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}% over the shown period · unit {formatSovereigns(sector.unitPrice)} ·
        fund {formatSovereigns(sector.fund)}
      </p>
      {sector.position && (
        <p className="text-footnote text-label tabular-nums">
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
              value={tileState.raw}
              onChange={(e) =>
                setTileState({ ...tileState, raw: e.target.value.replace(/[^0-9]/g, "") })
              }
              placeholder="Amount"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={buy.isPending || Number.isNaN(amount)}
            onClick={() =>
              buy.mutate({ realmId, sectorKey, amount, requestId: buyId })
            }
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
                  sell.mutate({ realmId, sectorKey, fraction: 0.5, requestId: sellId })
                }
              >
                Sell half
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={sell.isPending}
                onClick={() =>
                  sell.mutate({ realmId, sectorKey, fraction: 1, requestId: sellId })
                }
              >
                Sell all
              </Button>
            </>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setTileState({ ...tileState, dmOpen: !tileState.dmOpen })}
          >
            {tileState.dmOpen ? "Hide DM lever" : "DM lever"}
          </Button>
        </div>
      )}
      {tileState.dmOpen && (
        <div className="border-separator flex flex-wrap items-end gap-2 border-t pt-2">
          <div className="w-28">
            <Input
              aria-label={`DM modifier for ${sector.label}`}
              type="number"
              step="0.05"
              min="-0.5"
              max="2"
              value={tileState.rawDm}
              onChange={(e) => setTileState({ ...tileState, rawDm: e.target.value })}
            />
          </div>
          <Button
            size="xs"
            variant="secondary"
            disabled={setDm.isPending || !dmValid}
            onClick={() => setDm.mutate({ realmId, sectorKey, value: dmValue })}
          >
            Apply modifier
          </Button>
          <span className="text-caption text-label-secondary tabular-nums">
            Range -0.5 to +2.0 (realm moderators and admins)
          </span>
        </div>
      )}
    </Card>
  );
}

/** The four sector indices, their history and the sector funds. */
export function SectorsCard({
  realmId = "default",
  isOpen,
  onChanged,
}: {
  realmId?: string;
  isOpen: boolean;
  onChanged: () => void;
}) {
  const sectors = api.exchange.getSectors.useQuery({ realmId });
  const refresh = () => {
    void sectors.refetch();
    onChanged();
  };
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<StatUp />}>Sectors</CardTitle>
      <p className="text-footnote text-label-secondary">
        Each index follows company capital, standing and completed contracts in its sector, tilted
        by the realm GDP share and moving at most 5% per update. Funds are rebalanced toward the
        sectors that outperform; no Sovereigns are created, so gains come from the other funds.
        Sell 24 hours after buying.
      </p>
      {sectors.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(sectors.data ?? []).map((s) => (
            <SectorTile
              key={s.sectorKey}
              realmId={realmId}
              sector={s}
              isOpen={isOpen}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
