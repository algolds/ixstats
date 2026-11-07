"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { EntityHeader } from "~/components/ui/entity-header";
import { Skeleton } from "~/components/ui/skeleton";
import { assetUrl } from "~/lib/base-path";
import { bondHref, companyHref } from "~/lib/exchange/routes";
import type { NationPage as NationPageData } from "~/lib/exchange/terminal";
import { CreditRatingBadge } from "../shared";
import { Figure, SectionTitle, formatSovereignFigure } from "./brand";
import { NewsList } from "./NewsList";
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
          ) : undefined
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
          <Card content="data" padding="lg" className="space-y-1">
            <p className="text-footnote text-label-secondary">Treasury</p>
            <Figure size="hero" value={sov(data.treasury.balance)} />
            <p className="text-footnote text-label-secondary">Cap {sov(data.treasury.cap)}</p>
          </Card>
          <Card content="data" padding="md" className="space-y-2">
            <SectionTitle>Bonds</SectionTitle>
            {data.bonds.length === 0 ? (
              <p className="text-footnote text-label-secondary">No bonds issued.</p>
            ) : (
              <ul className="text-footnote divide-separator divide-y">
                {data.bonds.map((b) => (
                  <li key={b.bondId}>
                    <Link
                      href={bondHref(b.bondId)}
                      className="hover:text-tint flex justify-between py-1.5"
                    >
                      <span>
                        {b.termWeeks}-week · {pct(b.couponRate)} · {b.status.toLowerCase()}
                      </span>
                      <span className="tabular-nums">{pct(b.yield)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card content="data" padding="md" className="space-y-2">
            <SectionTitle>Companies based here</SectionTitle>
            {data.companies.length === 0 ? (
              <p className="text-footnote text-label-secondary">No companies yet.</p>
            ) : (
              <ul className="text-footnote divide-separator divide-y">
                {data.companies.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={companyHref(c.id)}
                      className="hover:text-tint flex justify-between py-1.5"
                    >
                      <span>{c.name}</span>
                      <span className="tabular-nums">{sov(c.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card content="feed" padding="md" className="space-y-2">
          <SectionTitle>Business news</SectionTitle>
          <NewsList items={data.news} emphasis="compact" empty="No news yet." />
        </Card>
      </div>
    </div>
  );
}
