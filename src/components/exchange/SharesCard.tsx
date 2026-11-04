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
import {
  CompanySelect,
  formatSovereigns,
  parseAmount,
  parseDecimalAmount,
  sectorLabel,
  useRequestId,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Listing = RouterOutputs["exchange"]["getShareMarket"][number];
type Holding = Overview["holdings"][number];
type BuyOrder = Overview["buyOrders"][number];
type Scope = "market" | "book" | "mine";

function ListingRow({
  listing,
  hasHqNation,
  isOpen,
  onDone,
}: {
  listing: Listing;
  hasHqNation: boolean;
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
          <p className="text-caption text-label-secondary tabular-nums">
            {sectorLabel(listing.sectorKey)} · {listing.shares.toLocaleString("en-US")} of{" "}
            {listing.sharesListed.toLocaleString("en-US")} left
            {listing.fairPricePerShare !== null &&
              ` · fair ${formatSovereigns(listing.fairPricePerShare)} a share`}
          </p>
          {!listing.primary && hasHqNation && (
            <p className="text-caption text-label-tertiary">
              Secondary sale: capital gains above seller cost basis are taxed by the HQ nation
              treasury.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {listing.primary ? (
            <Badge variant="info">New issue</Badge>
          ) : (
            <Badge variant="outline">Secondary ask</Badge>
          )}
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
  hasHqNation,
  isOpen,
  onDone,
}: {
  holding: Holding;
  hasHqNation: boolean;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [form, setForm] = useState({ rawShares: "", rawPrice: "" });
  const [requestId, rotate] = useRequestId();
  const shares = parseAmount(form.rawShares);
  const price = parseDecimalAmount(form.rawPrice);
  const priceOk = !Number.isNaN(price);
  const list = api.exchange.listShares.useMutation({
    onSuccess: () => {
      notify.success("Shares listed");
      setForm({ rawShares: "", rawPrice: "" });
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
          <p className="text-caption text-label-secondary tabular-nums">
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
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <Input
                aria-label={`Shares of ${holding.name} to sell`}
                inputMode="numeric"
                value={form.rawShares}
                onChange={(e) =>
                  setForm({ ...form, rawShares: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="Shares"
              />
            </div>
            <div className="w-28">
              <Input
                aria-label="Price per share"
                inputMode="decimal"
                value={form.rawPrice}
                onChange={(e) =>
                  setForm({ ...form, rawPrice: e.target.value.replace(/[^0-9.]/g, "") })
                }
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
          {hasHqNation && (
            <p className="text-caption text-label-tertiary">
              Realized gains above {formatSovereigns(holding.avgCost)} a share are subject to HQ
              nation capital-gains tax.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function BuyOrdersList({
  orders,
  isOpen,
  onDone,
}: {
  orders: ReadonlyArray<BuyOrder>;
  isOpen: boolean;
  onDone: () => void;
}) {
  const notify = useNotify();
  const cancel = api.exchange.cancelBuyOrder.useMutation({
    onSuccess: (r) => {
      notify.success("Buy order cancelled", `Refunded ${formatSovereigns(r.refunded)}`);
      onDone();
    },
    onError: (e) => notify.error("Could not cancel buy order", e.message),
  });

  if (orders.length === 0) return null;

  return (
    <div className="border-separator space-y-2 border-t pt-4">
      <p className="text-footnote text-label font-medium">
        Your open limit buy orders ({orders.length})
      </p>
      <ul className="divide-separator divide-y">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-footnote text-label truncate font-medium">{o.companyName}</p>
              <p className="text-caption text-label-secondary tabular-nums">
                {o.shares.toLocaleString("en-US")} of {o.sharesOrdered.toLocaleString("en-US")}{" "}
                shares resting · limit {formatSovereigns(o.maxPricePerShare)} · escrow{" "}
                {formatSovereigns(o.escrow)}
              </p>
            </div>
            {isOpen && (
              <Button
                size="xs"
                variant="ghost"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate({ orderId: o.id })}
              >
                Cancel
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderBookSection({
  companyId,
  companies,
  isOpen,
  onSelectCompany,
  onDone,
}: {
  companyId: string;
  companies: ReadonlyArray<{ id: string; name: string; tradingOpen?: boolean }>;
  isOpen: boolean;
  onSelectCompany: (id: string) => void;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [bidForm, setBidForm] = useState({ rawShares: "", rawPrice: "" });
  const [requestId, rotate] = useRequestId();
  const book = api.exchange.getOrderBook.useQuery({ companyId }, { enabled: Boolean(companyId) });
  const shares = parseAmount(bidForm.rawShares);
  const maxPrice = parseDecimalAmount(bidForm.rawPrice);
  const selectedCompany = companies.find((c) => c.id === companyId);

  const placeBid = api.exchange.placeBuyOrder.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Limit buy order placed",
        `Filled ${r.sharesBought} shares · ${r.sharesResting} resting on book`
      );
      setBidForm({ rawShares: "", rawPrice: "" });
      rotate();
      void book.refetch();
      onDone();
    },
    onError: (e) => notify.error("Could not place buy order", e.message),
  });

  if (companies.length === 0) {
    return (
      <EmptyState
        compact
        icon={<PercentageCircle />}
        title="No companies in this realm"
        message="Charter a company to open an order book."
      />
    );
  }

  const bids = book.data?.bids ?? [];
  const asks = book.data?.asks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-64">
          <CompanySelect
            id="exchange-orderbook-company"
            companies={companies}
            value={companyId}
            onChange={onSelectCompany}
          />
        </div>
        <span className="text-footnote text-label-secondary tabular-nums">
          Last trade:{" "}
          <span className="text-label font-medium">
            {book.data?.lastTradePrice !== null && book.data?.lastTradePrice !== undefined
              ? formatSovereigns(book.data.lastTradePrice)
              : "No trades yet"}
          </span>
        </span>
      </div>

      {book.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border-separator rounded-control space-y-2 border p-3">
            <p className="text-footnote text-label font-medium">Bids (buy orders)</p>
            {bids.length === 0 ? (
              <p className="text-caption text-label-secondary">No resting bids.</p>
            ) : (
              <ul className="space-y-1">
                {bids.map((b) => (
                  <li
                    key={b.price}
                    className="text-caption flex items-center justify-between gap-2 tabular-nums"
                  >
                    <span className="text-success font-medium">{formatSovereigns(b.price)}</span>
                    <span className="text-label">
                      {b.shares.toLocaleString("en-US")} shares ({b.orders}{" "}
                      {b.orders === 1 ? "order" : "orders"})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-separator rounded-control space-y-2 border p-3">
            <p className="text-footnote text-label font-medium">Asks (sell listings)</p>
            {asks.length === 0 ? (
              <p className="text-caption text-label-secondary">No resting asks.</p>
            ) : (
              <ul className="space-y-1">
                {asks.map((a) => (
                  <li
                    key={a.price}
                    className="text-caption flex items-center justify-between gap-2 tabular-nums"
                  >
                    <span className="text-label font-medium">{formatSovereigns(a.price)}</span>
                    <span className="text-label-secondary">
                      {a.shares.toLocaleString("en-US")} shares ({a.listings}{" "}
                      {a.listings === 1 ? "listing" : "listings"})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isOpen && companyId && (
        <div className="border-separator space-y-2 border-t pt-3">
          <p className="text-footnote text-label font-medium">Place a limit buy order</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <Input
                aria-label="Shares to bid"
                inputMode="numeric"
                value={bidForm.rawShares}
                onChange={(e) =>
                  setBidForm({ ...bidForm, rawShares: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="Shares"
              />
            </div>
            <div className="w-32">
              <Input
                aria-label="Max price per share"
                inputMode="decimal"
                value={bidForm.rawPrice}
                onChange={(e) =>
                  setBidForm({ ...bidForm, rawPrice: e.target.value.replace(/[^0-9.]/g, "") })
                }
                placeholder="Max price"
              />
            </div>
            <Button
              size="sm"
              disabled={
                placeBid.isPending ||
                selectedCompany?.tradingOpen === false ||
                Number.isNaN(shares) ||
                Number.isNaN(maxPrice)
              }
              onClick={() =>
                placeBid.mutate({
                  companyId,
                  shares,
                  maxPricePerShare: maxPrice,
                  requestId,
                })
              }
            >
              {Number.isNaN(shares) || Number.isNaN(maxPrice)
                ? "Place bid"
                : `Bid (escrow ${formatSovereigns(Math.round(shares * maxPrice * 100) / 100)})`}
            </Button>
          </div>
          <p className="text-caption text-label-secondary">
            Escrows the limit cost up front, immediately crosses asks at or below your limit price
            (refunding price improvement), and rests any unfilled shares on the order book.
          </p>
        </div>
      )}
    </div>
  );
}

/** The share market, two-sided order book and the viewer's shareholdings. */
export function SharesCard({
  overview,
  directoryCompanies = [],
  selectedCompanyId,
  onSelectCompany,
  onChanged,
}: {
  overview: Overview;
  directoryCompanies?: ReadonlyArray<{
    id: string;
    name: string;
    hqCountryId: string | null;
    tradingOpen: boolean;
  }>;
  selectedCompanyId?: string;
  onSelectCompany?: (companyId: string) => void;
  onChanged: () => void;
}) {
  const [viewState, setViewState] = useState({
    scope: "market" as Scope,
    companyId: "",
  });
  const market = api.exchange.getShareMarket.useQuery({ realmId: overview.realmId });
  const listings = market.data ?? [];

  const allCompanies = [
    ...overview.companies.map((c) => ({
      id: c.id,
      name: c.name,
      hqCountryId: c.hqCountryId,
      tradingOpen: c.tradingOpen,
    })),
    ...directoryCompanies.filter((d) => !overview.companies.some((c) => c.id === d.id)),
  ];
  const hqCompanyIds = new Set(allCompanies.filter((c) => c.hqCountryId).map((c) => c.id));
  const activeBookCompanyId =
    selectedCompanyId || viewState.companyId || allCompanies[0]?.id || "";

  const handleSelectCompany = (id: string) => {
    setViewState((prev) => ({ ...prev, companyId: id }));
    onSelectCompany?.(id);
  };

  const refresh = () => {
    void market.refetch();
    onChanged();
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<PercentageCircle />}>Shares and order book</CardTitle>
        <SegmentedControl
          aria-label="Shares"
          size="sm"
          value={viewState.scope}
          onValueChange={(v) => setViewState({ ...viewState, scope: v as Scope })}
          options={[
            { value: "market", label: "Market" },
            { value: "book", label: "Order book" },
            { value: "mine", label: "My shares" },
          ]}
        />
      </div>

      {viewState.scope === "book" ? (
        <OrderBookSection
          companyId={activeBookCompanyId}
          companies={allCompanies}
          isOpen={overview.isOpen}
          onSelectCompany={handleSelectCompany}
          onDone={refresh}
        />
      ) : viewState.scope === "market" ? (
        market.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : listings.length === 0 ? (
          <EmptyState
            compact
            icon={<PercentageCircle />}
            title="No shares on sale"
            message="Founders open trading and issue new shares; holders list theirs or place limit bids in the order book."
          />
        ) : (
          <ul className="divide-separator divide-y">
            {listings.map((l) => (
              <ListingRow
                key={l.id}
                listing={l}
                hasHqNation={hqCompanyIds.has(l.companyId)}
                isOpen={overview.isOpen}
                onDone={refresh}
              />
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
            <HoldingRow
              key={h.companyId}
              holding={h}
              hasHqNation={hqCompanyIds.has(h.companyId)}
              isOpen={overview.isOpen}
              onDone={refresh}
            />
          ))}
        </ul>
      )}

      <BuyOrdersList orders={overview.buyOrders} isOpen={overview.isOpen} onDone={refresh} />
    </Card>
  );
}
