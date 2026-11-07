"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { bondHref, companyHref, nationHref } from "~/lib/exchange/routes";
import type { Portfolio } from "~/lib/exchange/terminal";
import { Figure, SectionTitle, formatSovereignFigure } from "./brand";
import { SignInPrompt } from "./SignInPrompt";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const WATCH_HREF = { COMPANY: companyHref, BOND: bondHref, NATION: nationHref } as const;

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <Card content="data" padding="md" className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {children.length === 0 ? (
        <p className="text-footnote text-label-secondary">{empty}</p>
      ) : (
        <ul className="text-footnote divide-separator divide-y">{children}</ul>
      )}
    </Card>
  );
}

function Row({ href, label, value }: { href?: string; label: string; value: string }) {
  const body = (
    <>
      <span className="truncate">{label}</span>
      <span className="tabular-nums">{value}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="hover:text-tint flex justify-between gap-3 py-1.5">
          {body}
        </Link>
      ) : (
        <div className="flex justify-between gap-3 py-1.5">{body}</div>
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
    <li key={key} className="flex items-center justify-between gap-3 py-1.5">
      <span>{label}</span>
      <Button size="xs" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </li>
  );
  return (
    <Section title="Open orders" empty="No open orders.">
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
  return (
    <div className="space-y-4">
      <Card content="data" padding="lg" className="space-y-1">
        <p className="text-footnote text-label-secondary">Total value</p>
        <Figure size="hero" value={sov(data.totalValue)} />
        <p className="text-footnote text-label-secondary">Wallet {sov(data.wallet)}</p>
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Votes owed" empty="No votes waiting for you.">
          {data.votesOwed.map((v) => (
            <Row
              key={v.proposalId}
              href={companyHref(v.companyId)}
              label={`${v.companyName}: ${v.type.replace(/_/g, " ").toLowerCase()}`}
              value="Vote"
            />
          ))}
        </Section>
        <Section title="Shares" empty="No shares yet.">
          {data.shares.map((s) => (
            <Row
              key={s.companyId}
              href={companyHref(s.companyId)}
              label={`${s.name} · ${s.shares}`}
              value={sov(s.value)}
            />
          ))}
        </Section>
        <Section title="Bonds" empty="No bonds yet.">
          {data.bonds.map((b) => (
            <Row
              key={b.bondId}
              href={bondHref(b.bondId)}
              label={`${b.name} · ${b.units}`}
              value={sov(b.value)}
            />
          ))}
        </Section>
        <Section title="Funds" empty="No fund units yet.">
          {data.funds.map((f) => (
            <Row
              key={f.sectorKey}
              label={`${f.name} · ${f.units.toFixed(2)}`}
              value={sov(f.value)}
            />
          ))}
        </Section>
        <OpenOrders orders={data.orders} />
        <Section title="Watchlist" empty="Star a company, bond or nation to watch it.">
          {data.watchlist.map((w) => (
            <Row
              key={`${w.kind}:${w.id}`}
              href={WATCH_HREF[w.kind](w.id)}
              label={w.name}
              value={w.price !== null ? sov(w.price) : ""}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}
