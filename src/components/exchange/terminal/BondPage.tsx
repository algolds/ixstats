"use client";

import Link from "next/link";
import { Coins, Journal } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { EntityHeader } from "~/components/ui/entity-header";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { nationHref } from "~/lib/exchange/routes";
import { CreditRatingBadge } from "../shared";
import {
  DATA_ROW_ITEM,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  formatSovereignFigure,
} from "./brand";
import { NewsList } from "./NewsList";
import { TradeButton } from "./TradeSheet";
import { WatchStar } from "./WatchStar";
import { useTreasuryActor } from "./useTreasuryActor";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const sov = (n: number) => `₷${formatSovereignFigure(n)}`;

function CancelBondListingButton({ listingId }: { listingId: string }) {
  const utils = api.useUtils();
  const cancel = api.exchange.cancelBondListing.useMutation({
    onSuccess: () => void utils.exchange.invalidate(),
  });
  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={cancel.isPending}
      onClick={() => cancel.mutate({ listingId })}
    >
      Cancel
    </Button>
  );
}

/** One nation bond: its price and yield, what is left on sale, and who sells. */
export function BondPage({ bondId }: { bondId: string }) {
  const { data, isLoading, error } = api.exchange.bondPage.useQuery({ bondId });
  const treasury = useTreasuryActor(data?.bond.realmId);
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (!data)
    return <EmptyState title="Bond not found" message={error?.message ?? "It may have matured."} />;
  const b = data.bond;
  const cheapest = data.listings[0];
  const open = b.status === "OPEN";
  return (
    <div className="space-y-4">
      <EntityHeader
        art={
          <ExchangeIconWell size="lg">
            <Coins />
          </ExchangeIconWell>
        }
        name={`${b.nation} ${b.termWeeks}-week bond`}
        description={`${pct(b.couponRate)} coupon, paid weekly from the treasury`}
        facts={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={nationHref(b.countryId)} className="hover:text-tint">
              {b.nation}
            </Link>
            <CreditRatingBadge rating={b.rating} />
          </span>
        }
        action={
          <span className="flex items-center gap-1">
            <WatchStar subjectKind="BOND" subjectId={b.bondId} watching={data.viewer.watching} />
            {open && (
              <TradeButton
                treasury={treasury}
                instrument={{
                  kind: "bond",
                  bondId: b.bondId,
                  name: `${b.nation} ${b.termWeeks}-week bond`,
                  price: b.price,
                  faceValue: b.faceValue,
                  unitsLeft: b.unitsIssued - b.unitsSold,
                  cheapestListing: cheapest
                    ? { id: cheapest.id, pricePerUnit: cheapest.pricePerUnit }
                    : null,
                }}
              />
            )}
          </span>
        }
      />
      {b.status === "DEFAULTED" && (
        <Signal tone="destructive" title="This bond is in default">
          Holders were paid what the treasury held.
        </Signal>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card content="data" padding="md" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Price", sov(b.price)],
              ["Yield", pct(b.yield)],
              ["Weeks left", String(b.weeksLeft)],
              [
                "Sold",
                `${b.unitsSold.toLocaleString("en-US")} of ${b.unitsIssued.toLocaleString("en-US")}`,
              ],
            ].map(([label, value]) => (
              <Card key={label} variant="well" padding="sm">
                <p className="text-caption text-label-secondary">{label}</p>
                <Figure value={value!} />
              </Card>
            ))}
          </Card>
          <Card content="data" padding="md" className="space-y-2">
            <SectionTitle icon={<Coins />}>Units for sale</SectionTitle>
            {data.listings.length === 0 ? (
              <p className="text-footnote text-label-secondary">No holder is selling.</p>
            ) : (
              <ul className="divide-separator divide-y tabular-nums">
                {data.listings.map((l) => (
                  <li key={l.id} data-row className={DATA_ROW_ITEM}>
                    <span className="flex items-center gap-2">
                      <span>{l.units.toLocaleString("en-US")} units</span>
                      {l.mine && <Badge variant="secondary">Yours</Badge>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{sov(l.pricePerUnit)}</span>
                      {l.mine && <CancelBondListingButton listingId={l.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-label-secondary">{data.holderCount} holders</p>
          </Card>
        </div>
        <Card padding="md" className="space-y-2">
          <SectionTitle icon={<Journal />}>News</SectionTitle>
          <NewsList items={data.news} emphasis="compact" empty="No news yet." />
        </Card>
      </div>
    </div>
  );
}
