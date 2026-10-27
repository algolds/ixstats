"use client";

import { useState } from "react";
import { PercentageCircle } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { formatSovereigns, parseAmount, sectorLabel, useRequestId } from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Listing = RouterOutputs["exchange"]["getShareMarket"][number];
type Holding = Overview["holdings"][number];
type Scope = "market" | "mine";

function ListingRow({
  listing,
  isOpen,
  onDone,
}: {
  listing: Listing;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [raw, setRaw] = useState("");
  const [requestId, rotate] = useRequestId();
  const shares = parseAmount(raw);
  const buy = api.exchange.buyShares.useMutation({
    onSuccess: (r) => {
      notify.success("Shares bought", `${r.shares} for ${formatSovereigns(r.cost)}`);
      setRaw("");
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not buy", e.message),
  });
  const cancel = api.exchange.cancelShareListing.useMutation({
    onSuccess: () => {
      notify.success("Listing withdrawn");
      onDone();
    },
    onError: (e) => notify.error("Could not withdraw", e.message),
  });

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body text-label truncate font-medium">{listing.companyName}</p>
          <p className="text-caption text-label-secondary">
            {sectorLabel(listing.sectorKey)} · {listing.shares.toLocaleString("en-US")} of{" "}
            {listing.sharesListed.toLocaleString("en-US")} left
            {listing.fairPricePerShare !== null &&
              ` · fair ${formatSovereigns(listing.fairPricePerShare)} a share`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listing.primary && <Badge variant="info">New issue</Badge>}
          {!listing.tradingOpen && <Badge>Trading closed</Badge>}
          <span className="text-body text-label font-medium tabular-nums">
            {formatSovereigns(listing.pricePerShare)}
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="flex flex-wrap items-end gap-2">
          {listing.mine ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ listingId: listing.id })}
            >
              Withdraw listing
            </Button>
          ) : (
            <>
              <div className="w-28">
                <Input
                  aria-label={`Shares of ${listing.companyName} to buy`}
                  inputMode="numeric"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Shares"
                />
              </div>
              <Button
                size="sm"
                disabled={buy.isPending || !listing.tradingOpen || Number.isNaN(shares)}
                onClick={() => buy.mutate({ listingId: listing.id, shares, requestId })}
              >
                {Number.isNaN(shares)
                  ? "Buy"
                  : `Buy for ${formatSovereigns(Math.round(listing.pricePerShare * 100 * shares) / 100)}`}
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function HoldingRow({
  holding,
  isOpen,
  onDone,
}: {
  holding: Holding;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [rawShares, setRawShares] = useState("");
  const [rawPrice, setRawPrice] = useState("");
  const [requestId, rotate] = useRequestId();
  const shares = parseAmount(rawShares);
  const price = Number(rawPrice);
  const priceOk =
    Number.isFinite(price) && price >= 0.01 && Math.round(price * 100) === price * 100;
  const list = api.exchange.listShares.useMutation({
    onSuccess: () => {
      notify.success("Shares listed");
      setRawShares("");
      setRawPrice("");
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not list", e.message),
  });

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body text-label truncate font-medium">{holding.name}</p>
          <p className="text-caption text-label-secondary">
            {holding.shares.toLocaleString("en-US")} shares
            {holding.listed > 0 && `, ${holding.listed.toLocaleString("en-US")} on sale`} ·{" "}
            {Math.round(holding.stake * 1000) / 10}% · bought at {formatSovereigns(holding.avgCost)}
          </p>
        </div>
        <span className="text-body text-label font-medium tabular-nums">
          {formatSovereigns(holding.fairValue)}
        </span>
      </div>
      {isOpen && holding.status === "ACTIVE" && holding.tradingOpen && holding.shares > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-28">
            <Input
              aria-label={`Shares of ${holding.name} to sell`}
              inputMode="numeric"
              value={rawShares}
              onChange={(e) => setRawShares(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Shares"
            />
          </div>
          <div className="w-28">
            <Input
              aria-label="Price per share"
              inputMode="decimal"
              value={rawPrice}
              onChange={(e) => setRawPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Price"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={list.isPending || Number.isNaN(shares) || !priceOk}
            onClick={() =>
              list.mutate({
                companyId: holding.companyId,
                shares,
                pricePerShare: price,
                requestId,
              })
            }
          >
            List for sale
          </Button>
        </div>
      )}
    </li>
  );
}

/** The share market and the viewer's shareholdings. */
export function SharesCard({ overview, onChanged }: { overview: Overview; onChanged: () => void }) {
  const [scope, setScope] = useState<Scope>("market");
  const market = api.exchange.getShareMarket.useQuery();
  const listings = market.data ?? [];
  const refresh = () => {
    void market.refetch();
    onChanged();
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<PercentageCircle />}>Shares</CardTitle>
        <SegmentedControl
          aria-label="Shares"
          size="sm"
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          options={[
            { value: "market", label: "Market" },
            { value: "mine", label: "My shares" },
          ]}
        />
      </div>
      {scope === "market" ? (
        market.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : listings.length === 0 ? (
          <EmptyState
            compact
            icon={<PercentageCircle />}
            title="No shares on sale"
            message="Founders open trading and issue new shares; holders list theirs at a price they choose."
          />
        ) : (
          <ul className="divide-separator divide-y">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} isOpen={overview.isOpen} onDone={refresh} />
            ))}
          </ul>
        )
      ) : overview.holdings.length === 0 ? (
        <EmptyState
          compact
          icon={<PercentageCircle />}
          title="No shares yet"
          message="Charter a company or buy shares on the market."
        />
      ) : (
        <ul className="divide-separator divide-y">
          {overview.holdings.map((h) => (
            <HoldingRow key={h.companyId} holding={h} isOpen={overview.isOpen} onDone={refresh} />
          ))}
        </ul>
      )}
    </Card>
  );
}
