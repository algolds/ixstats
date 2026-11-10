"use client";

import Link from "next/link";
import { Building, Coins, Crown, Journal, Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { EntityHeader } from "~/components/ui/entity-header";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { assetUrl } from "~/lib/base-path";
import { bondHref, companyHref } from "~/lib/exchange/routes";
import type { NationPage as NationPageData } from "~/lib/exchange/terminal";
import { CreditRatingBadge } from "../shared";
import {
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  bondStatusLabel,
  formatSovereignFigure,
} from "./brand";
import { NewsList } from "./NewsList";
import { FundHoldings } from "./TreasuryFund";
import { WatchStar } from "./WatchStar";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** The nation's own money, shown beside ₷: its name, and a rate only when MyCountry sets one. */
function currencyLine(n: NationPageData): string | null {
  if (!n.currency) return null;
  return n.currencyRate !== null
    ? `₷ 1 ≈ ${n.currencyRate} ${n.currency}`
    : `Currency: ${n.currency}`;
}

/** One nation on the Exchange: its treasury, its bonds, its companies and its business news. */
export function NationPage({ countryId }: { countryId: string }) {
  const { data, isLoading, error } = api.exchange.nationPage.useQuery({ countryId });
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (!data)
    return (
      <EmptyState title="Nation not found" message={error?.message ?? "Try another nation."} />
    );
  const flag = assetUrl(data.flagUrl);
  const currency = currencyLine(data);
  return (
    <div className="space-y-4">
      <EntityHeader
        art={
          flag ? (
            <img src={flag} alt="" className="rounded-control h-10 w-14 object-cover" />
          ) : (
            <ExchangeIconWell size="lg">
              <Crown />
            </ExchangeIconWell>
          )
        }
        name={data.name}
        description={currency ?? undefined}
        facts={<CreditRatingBadge rating={data.rating} />}
        action={
          <WatchStar subjectKind="NATION" subjectId={data.id} watching={data.viewer.watching} />
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card content="data" padding="lg" className="relative space-y-2 overflow-hidden">
            <TextureOverlay
              texture="chevron"
              opacity={0.025}
              className="[--facet-texture-color:var(--tint)]"
            />
            <div className="relative flex items-center gap-2">
              <ExchangeIconWell size="sm">
                <Crown />
              </ExchangeIconWell>
              <p className="text-footnote text-label-secondary font-medium">Treasury</p>
            </div>
            <Figure size="hero" value={sov(data.treasury.balance)} className="relative block" />
            <p className="text-footnote text-label-secondary relative">
              Cap {sov(data.treasury.cap)}
            </p>
          </Card>
          <Card content="data" padding="md" className="space-y-2.5">
            <SectionTitle icon={<Coins />}>Bonds</SectionTitle>
            {data.bonds.length === 0 ? (
              <p className="text-footnote text-label-secondary py-2">No bonds issued.</p>
            ) : (
              <ul className="divide-separator divide-y">
                {data.bonds.map((b) => (
                  <li key={b.bondId}>
                    <Link href={bondHref(b.bondId)} data-row className={DATA_ROW_LINK}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <ExchangeIconWell size="sm">
                          <Coins />
                        </ExchangeIconWell>
                        <span className="truncate font-medium">
                          {b.termWeeks}-week · {pct(b.couponRate)} · {bondStatusLabel(b.status)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{pct(b.yield)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data.fund && (
            <Card content="data" padding="md" className="space-y-2.5">
              <SectionTitle icon={<Wallet />}>Wealth fund</SectionTitle>
              <p className="text-footnote text-label-secondary">
                Cash {sov(data.fund.wallet)} · worth {sov(data.fund.totalValue)}
              </p>
              <FundHoldings portfolio={data.fund} />
            </Card>
          )}
          <Card content="data" padding="md" className="space-y-2.5">
            <SectionTitle icon={<Building />}>Companies based here</SectionTitle>
            {data.companies.length === 0 ? (
              <p className="text-footnote text-label-secondary py-2">No companies yet.</p>
            ) : (
              <ul className="divide-separator divide-y">
                {data.companies.map((c) => (
                  <li key={c.id}>
                    <Link href={companyHref(c.id)} data-row className={DATA_ROW_LINK}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <ExchangeIconWell size="sm">
                          <Building />
                        </ExchangeIconWell>
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{sov(c.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card padding="md" className="space-y-2">
          <SectionTitle icon={<Journal />}>Business news</SectionTitle>
          <NewsList items={data.news} emphasis="compact" empty="No news yet." />
        </Card>
      </div>
    </div>
  );
}
