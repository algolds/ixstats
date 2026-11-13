"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { CheckSquare, Clock, Crown, Star, StatsReport, Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { EXCHANGE_PATHS, bondHref, companyHref, nationHref } from "~/lib/exchange/routes";
import type { Portfolio } from "~/lib/exchange/terminal-valuation";
import {
  DATA_ROW_ITEM,
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  TickerTile,
  formatSovereignFigure,
  proposalTypeLabel,
  symbolOf,
} from "./brand";
import { SignInPrompt } from "./SignInPrompt";
import { WatchStar } from "./WatchStar";
import { useTreasuryActor } from "./useTreasuryActor";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const WATCH_HREF = { COMPANY: companyHref, BOND: bondHref, NATION: nationHref } as const;

function Row({
  href,
  leading,
  label,
  kindBadge,
  value,
}: {
  href?: string;
  leading?: React.ReactNode;
  label: string;
  kindBadge?: string;
  value: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {leading}
        <span className="truncate font-medium">{label}</span>
        {kindBadge && (
          <Badge variant="outline" className="hidden sm:inline-flex">
            {kindBadge}
          </Badge>
        )}
      </span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} data-row className={DATA_ROW_LINK}>
          {body}
        </Link>
      ) : (
        <div data-row className={DATA_ROW_ITEM}>
          {body}
        </div>
      )}
    </li>
  );
}

function OpenOrdersList({ orders }: { orders: Portfolio["orders"] }) {
  const utils = api.useUtils();
  const done = { onSuccess: () => void utils.exchange.invalidate() };
  const cancelOrder = api.exchange.cancelBuyOrder.useMutation(done);
  const cancelShares = api.exchange.cancelShareListing.useMutation(done);
  const cancelBonds = api.exchange.cancelBondListing.useMutation(done);
  const row = (key: string, side: "BUY" | "ASK", label: string, onCancel: () => void) => (
    <li key={key} data-row className={DATA_ROW_ITEM}>
      <span className="flex min-w-0 items-center gap-2.5">
        <TickerTile code={side} tone={side === "BUY" ? "gain" : "neutral"} />
        <span className="truncate">{label}</span>
      </span>
      <Button size="xs" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </li>
  );
  const items = [
    ...orders.buyOrders.map((o) =>
      row(o.id, "BUY", `Buying ${o.shares} shares up to ${sov(o.maxPricePerShare)}`, () =>
        cancelOrder.mutate({ orderId: o.id })
      )
    ),
    ...orders.shareListings.map((l) =>
      row(l.id, "ASK", `Selling ${l.shares} shares at ${sov(l.pricePerShare)}`, () =>
        cancelShares.mutate({ listingId: l.id })
      )
    ),
    ...orders.bondListings.map((l) =>
      row(l.id, "ASK", `Selling ${l.units} bond units at ${sov(l.pricePerUnit)}`, () =>
        cancelBonds.mutate({ listingId: l.id })
      )
    ),
  ];
  if (items.length === 0) {
    return <p className="text-footnote text-label-secondary py-1">No open orders.</p>;
  }
  return <ul className="divide-separator divide-y">{items}</ul>;
}

/** What you hold, what you've ordered, what you watch and the votes you owe. */
export function PortfolioPage({ realmId }: { realmId: string }) {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = api.exchange.portfolio.useQuery(
    { realmId },
    { enabled: !!isSignedIn }
  );
  const treasury = useTreasuryActor(realmId);
  if (!isSignedIn)
    return <SignInPrompt title="Your portfolio" message="Sign in to see what you hold." />;
  if (isLoading || !data) return <Skeleton className="h-80 w-full" />;

  const invested = Math.max(0, data.totalValue - data.wallet);
  const openOrdersCount =
    data.orders.buyOrders.length +
    data.orders.shareListings.length +
    data.orders.bondListings.length;
  const holdingsRows = [
    ...data.shares.map((s) => (
      <Row
        key={`share:${s.companyId}`}
        href={companyHref(s.companyId)}
        leading={<TickerTile code={symbolOf(s.name)} />}
        label={`${s.name} · ${s.shares}`}
        kindBadge="Shares"
        value={sov(s.value)}
      />
    )),
    ...data.bonds.map((b) => (
      <Row
        key={`bond:${b.bondId}`}
        href={bondHref(b.bondId)}
        leading={<TickerTile code="BOND" tone="neutral" />}
        label={`${b.name} · ${b.units}`}
        kindBadge="Bond"
        value={sov(b.value)}
      />
    )),
    ...data.funds.map((f) => (
      <Row
        key={`fund:${f.sectorKey}`}
        leading={<TickerTile code={symbolOf(f.name)} tone="tint" />}
        label={`${f.name} · ${f.units.toFixed(2)}`}
        kindBadge="Fund"
        value={sov(f.value)}
      />
    )),
  ];

  return (
    <div className="space-y-4">
      <LensCard app="exchange" content="data" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ExchangeIconWell size="sm">
                <Wallet />
              </ExchangeIconWell>
              <p className="text-footnote text-label-secondary font-medium">Total value</p>
            </div>
            <Figure size="hero" value={sov(data.totalValue)} />
            <p className="text-footnote text-label-secondary">Wallet {sov(data.wallet)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.votesOwed.length > 0 && (
              <Badge variant="warning" className="tabular-nums">
                {data.votesOwed.length} {data.votesOwed.length === 1 ? "vote" : "votes"} pending
              </Badge>
            )}
            {treasury && (
              <Button asChild variant="secondary" size="sm">
                <Link href={EXCHANGE_PATHS.treasury}>
                  <Crown className="text-tint" />
                  <span>{treasury.name} Treasury</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card variant="well" padding="sm">
            <Stat size="sm" label="Spendable wallet" value={sov(data.wallet)} />
          </Card>
          <Card variant="well" padding="sm">
            <Stat size="sm" label="Invested holdings" value={sov(invested)} />
          </Card>
          <Card variant="well" padding="sm">
            <Stat size="sm" label="Positions held" value={String(holdingsRows.length)} />
          </Card>
          <Card variant="well" padding="sm">
            <Stat size="sm" label="Open orders" value={String(openOrdersCount)} />
          </Card>
        </div>
      </LensCard>

      {data.votesOwed.length > 0 && (
        <LensCard app="exchange" content="data" padding="md" className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle icon={<CheckSquare />}>Votes owed</SectionTitle>
            <Badge variant="warning" className="font-mono tabular-nums">
              {data.votesOwed.length}
            </Badge>
          </div>
          <ul className="divide-separator divide-y">
            {data.votesOwed.map((v) => (
              <Row
                key={v.proposalId}
                href={companyHref(v.companyId)}
                leading={<TickerTile code={symbolOf(v.companyName)} />}
                label={`${v.companyName}: ${proposalTypeLabel(v.type)}`}
                value="Vote"
              />
            ))}
          </ul>
        </LensCard>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <LensCard app="exchange" content="data" padding="md" className="space-y-2.5 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle icon={<StatsReport />}>Holdings</SectionTitle>
            {holdingsRows.length > 0 && (
              <Badge variant="secondary" className="font-mono tabular-nums">
                {holdingsRows.length}
              </Badge>
            )}
          </div>
          {holdingsRows.length === 0 ? (
            <p className="text-footnote text-label-secondary py-2">
              No shares, bonds or fund units held yet.
            </p>
          ) : (
            <ul className="divide-separator divide-y">{holdingsRows}</ul>
          )}
        </LensCard>

        <LensCard app="exchange" content="data" padding="md" className="space-y-4 lg:col-span-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle icon={<Clock />}>Open orders</SectionTitle>
              {openOrdersCount > 0 && (
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {openOrdersCount}
                </Badge>
              )}
            </div>
            <OpenOrdersList orders={data.orders} />
          </div>

          <div className="border-separator space-y-2 border-t pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle icon={<Star />}>Watchlist</SectionTitle>
              {data.watchlist.length > 0 && (
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {data.watchlist.length}
                </Badge>
              )}
            </div>
            {data.watchlist.length === 0 ? (
              <p className="text-footnote text-label-secondary py-1">
                Star a company, bond or nation to watch it.
              </p>
            ) : (
              <ul className="divide-separator divide-y">
                {data.watchlist.map((w) => (
                  <li key={`${w.kind}:${w.id}`} data-row className={DATA_ROW_ITEM}>
                    <Link
                      href={WATCH_HREF[w.kind](w.id)}
                      className="hover:text-tint flex min-w-0 flex-1 items-center justify-between gap-3 transition-colors"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <TickerTile code={symbolOf(w.name)} tone="neutral" />
                        <span className="truncate font-medium">{w.name}</span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {w.price !== null ? sov(w.price) : ""}
                      </span>
                    </Link>
                    <WatchStar subjectKind={w.kind} subjectId={w.id} watching />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </LensCard>
      </div>
    </div>
  );
}
