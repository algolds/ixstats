"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Building, CheckSquare, Clock, Coins, Star, StatsReport, Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { bondHref, companyHref, nationHref } from "~/lib/exchange/routes";
import type { Portfolio } from "~/lib/exchange/terminal";
import {
  DATA_ROW_ITEM,
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  formatSovereignFigure,
  proposalTypeLabel,
} from "./brand";
import { SignInPrompt } from "./SignInPrompt";
import { WatchStar } from "./WatchStar";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const WATCH_HREF = { COMPANY: companyHref, BOND: bondHref, NATION: nationHref } as const;

function Section({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <Card content="data" padding="md" className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle icon={icon}>{title}</SectionTitle>
        {children.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {children.length}
          </Badge>
        )}
      </div>
      {children.length === 0 ? (
        <p className="text-footnote text-label-secondary py-2">{empty}</p>
      ) : (
        <ul className="divide-separator divide-y">{children}</ul>
      )}
    </Card>
  );
}

function Row({
  href,
  icon,
  label,
  value,
}: {
  href?: string;
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {icon && <ExchangeIconWell size="sm">{icon}</ExchangeIconWell>}
        <span className="truncate font-medium">{label}</span>
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
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

function OpenOrders({ orders }: { orders: Portfolio["orders"] }) {
  const utils = api.useUtils();
  const done = { onSuccess: () => void utils.exchange.invalidate() };
  const cancelOrder = api.exchange.cancelBuyOrder.useMutation(done);
  const cancelShares = api.exchange.cancelShareListing.useMutation(done);
  const cancelBonds = api.exchange.cancelBondListing.useMutation(done);
  const row = (key: string, label: string, onCancel: () => void) => (
    <li key={key} data-row className={DATA_ROW_ITEM}>
      <span className="flex min-w-0 items-center gap-2.5">
        <ExchangeIconWell size="sm">
          <Clock />
        </ExchangeIconWell>
        <span className="truncate">{label}</span>
      </span>
      <Button size="xs" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </li>
  );
  return (
    <Section title="Open orders" icon={<Clock />} empty="No open orders.">
      {[
        ...orders.buyOrders.map((o) =>
          row(o.id, `Buying ${o.shares} shares up to ${sov(o.maxPricePerShare)}`, () =>
            cancelOrder.mutate({ orderId: o.id })
          )
        ),
        ...orders.shareListings.map((l) =>
          row(l.id, `Selling ${l.shares} shares at ${sov(l.pricePerShare)}`, () =>
            cancelShares.mutate({ listingId: l.id })
          )
        ),
        ...orders.bondListings.map((l) =>
          row(l.id, `Selling ${l.units} bond units at ${sov(l.pricePerUnit)}`, () =>
            cancelBonds.mutate({ listingId: l.id })
          )
        ),
      ]}
    </Section>
  );
}

/** What you hold, what you've ordered, what you watch and the votes you owe. */
export function PortfolioPage({ realmId }: { realmId: string }) {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = api.exchange.portfolio.useQuery(
    { realmId },
    { enabled: !!isSignedIn }
  );
  if (!isSignedIn)
    return <SignInPrompt title="Your portfolio" message="Sign in to see what you hold." />;
  if (isLoading || !data) return <Skeleton className="h-80 w-full" />;

  const invested = Math.max(0, data.totalValue - data.wallet);
  const openOrdersCount =
    data.orders.buyOrders.length +
    data.orders.shareListings.length +
    data.orders.bondListings.length;

  return (
    <div className="space-y-4">
      <Card content="data" padding="lg" className="relative space-y-4 overflow-hidden">
        <TextureOverlay
          texture="chevron"
          opacity={0.025}
          className="[--facet-texture-color:var(--tint)]"
        />
        <div className="relative space-y-1">
          <div className="flex items-center gap-2">
            <ExchangeIconWell size="sm">
              <Wallet />
            </ExchangeIconWell>
            <p className="text-footnote text-label-secondary font-medium">Total value</p>
          </div>
          <Figure size="hero" value={sov(data.totalValue)} />
          <p className="text-footnote text-label-secondary">Wallet {sov(data.wallet)}</p>
        </div>
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="bg-surface-secondary rounded-row p-3">
            <Stat size="sm" label="Spendable wallet" value={sov(data.wallet)} />
          </div>
          <div className="bg-surface-secondary rounded-row p-3">
            <Stat size="sm" label="Invested holdings" value={sov(invested)} />
          </div>
          <div className="bg-surface-secondary rounded-row p-3">
            <Stat size="sm" label="Open orders" value={String(openOrdersCount)} />
          </div>
        </div>
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Votes owed" icon={<CheckSquare />} empty="No votes waiting for you.">
          {data.votesOwed.map((v) => (
            <Row
              key={v.proposalId}
              href={companyHref(v.companyId)}
              icon={<CheckSquare />}
              label={`${v.companyName}: ${proposalTypeLabel(v.type)}`}
              value="Vote"
            />
          ))}
        </Section>
        <Section title="Shares" icon={<Building />} empty="No shares yet.">
          {data.shares.map((s) => (
            <Row
              key={s.companyId}
              href={companyHref(s.companyId)}
              icon={<Building />}
              label={`${s.name} · ${s.shares}`}
              value={sov(s.value)}
            />
          ))}
        </Section>
        <Section title="Bonds" icon={<Coins />} empty="No bonds yet.">
          {data.bonds.map((b) => (
            <Row
              key={b.bondId}
              href={bondHref(b.bondId)}
              icon={<Coins />}
              label={`${b.name} · ${b.units}`}
              value={sov(b.value)}
            />
          ))}
        </Section>
        <Section title="Funds" icon={<StatsReport />} empty="No fund units yet.">
          {data.funds.map((f) => (
            <Row
              key={f.sectorKey}
              icon={<StatsReport />}
              label={`${f.name} · ${f.units.toFixed(2)}`}
              value={sov(f.value)}
            />
          ))}
        </Section>
        <OpenOrders orders={data.orders} />
        <Section
          title="Watchlist"
          icon={<Star />}
          empty="Star a company, bond or nation to watch it."
        >
          {data.watchlist.map((w) => (
            <li key={`${w.kind}:${w.id}`} data-row className={DATA_ROW_ITEM}>
              <Link
                href={WATCH_HREF[w.kind](w.id)}
                className="hover:text-tint flex min-w-0 flex-1 items-center justify-between gap-3 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <ExchangeIconWell size="sm">
                    <Star />
                  </ExchangeIconWell>
                  <span className="truncate font-medium">{w.name}</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {w.price !== null ? sov(w.price) : ""}
                </span>
              </Link>
              <WatchStar subjectKind={w.kind} subjectId={w.id} watching />
            </li>
          ))}
        </Section>
      </div>
    </div>
  );
}
