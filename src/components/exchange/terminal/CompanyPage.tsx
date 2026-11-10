"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BookStack,
  Building,
  CheckSquare,
  Group,
  Journal,
  NavArrowRight,
  Page,
  StatsReport,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { EntityHeader } from "~/components/ui/entity-header";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { nationHref } from "~/lib/exchange/routes";
import { assetUrl } from "~/lib/base-path";
import type { CompanyPage as CompanyPageData } from "~/lib/exchange/terminal";
import { cn } from "~/lib/utils";
import { CreditRatingBadge, StatusBadge, readCompanyWikiData } from "../shared";
import {
  ChangeLabel,
  DATA_ROW_ITEM,
  ExchangeIconWell,
  Figure,
  SectionTitle,
  decisionTypeLabel,
  formatSovereignFigure,
  proposalTypeLabel,
} from "./brand";
import { IndexChart, RANGES, pointsIn, type Range } from "./IndexChart";
import { NewsList } from "./NewsList";
import { TradeButton } from "./TradeSheet";
import { WatchStar } from "./WatchStar";
import { useTreasuryActor } from "./useTreasuryActor";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const ratio = (n: number | null, digits = 2) => (n === null ? "–" : n.toFixed(digits));
const share = (n: number | null) => (n === null ? "–" : `${(n * 100).toFixed(2)}%`);

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <Card key={label} variant="well" padding="sm">
          <dt className="text-caption text-label-secondary">{label}</dt>
          <dd className="text-body font-semibold tabular-nums">{value}</dd>
        </Card>
      ))}
    </dl>
  );
}

function OrderBook({ book }: { book: CompanyPageData["orderBook"] }) {
  const side = (title: string, rows: { price: number; shares: number }[], empty: string) => (
    <div>
      <p className="text-footnote text-label-secondary mb-1 font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary">{empty}</p>
      ) : (
        <ul className="text-footnote tabular-nums">
          {rows.map((r) => (
            <li key={r.price} className="flex justify-between py-0.5">
              <span>{sov(r.price)}</span>
              <span className="text-label-secondary">{r.shares.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-6">
      {side("Bids", book.bids, "No bids")}
      {side("Asks", book.asks, "No asks")}
    </div>
  );
}

function Governance({ data }: { data: CompanyPageData }) {
  const utils = api.useUtils();
  const vote = api.exchange.castVote.useMutation({
    onSuccess: () => void utils.exchange.invalidate(),
  });
  const open = data.proposals.filter((p) => p.status === "OPEN");
  if (data.proposals.length === 0) return null;
  return (
    <Card content="data" padding="md" className="space-y-2">
      <SectionTitle icon={<CheckSquare />}>Shareholder votes</SectionTitle>
      <ul className="divide-separator divide-y">
        {data.proposals.map((p) => (
          <li key={p.id} data-row className="text-callout flex flex-wrap items-center gap-2 py-2">
            <span className="flex-1">{proposalTypeLabel(p.type)}</span>
            <StatusBadge status={p.status} />
            <span className="text-footnote text-label-secondary tabular-nums">
              {p.sharesFor} for · {p.sharesAgainst} against
            </span>
            {open.includes(p) && data.viewer.shares > 0 && (
              <span className="flex gap-1">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => vote.mutate({ proposalId: p.id, support: true })}
                >
                  For
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => vote.mutate({ proposalId: p.id, support: false })}
                >
                  Against
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Header({ data }: { data: CompanyPageData }) {
  const c = data.company;
  const treasury = useTreasuryActor(c.realmId);
  const wiki = readCompanyWikiData(c.wikiData);
  const book = data.orderBook;
  return (
    <EntityHeader
      art={
        wiki?.logoUrl ? (
          <img
            src={assetUrl(wiki.logoUrl) ?? undefined}
            alt=""
            className="rounded-control size-14 object-contain"
          />
        ) : (
          <ExchangeIconWell size="lg">
            <Building />
          </ExchangeIconWell>
        )
      }
      name={c.name}
      description={`${c.subIndustryLabel} · ${c.sectorLabel}`}
      facts={
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-tint font-semibold tabular-nums">{c.ticker}</span>
          {data.hq && (
            <Link href={nationHref(data.hq.id)} className="hover:text-tint">
              {data.hq.name}
            </Link>
          )}
          <CreditRatingBadge rating={c.creditRating} />
          <StatusBadge status={c.status} />
        </span>
      }
      action={
        <span className="flex items-center gap-1">
          <WatchStar subjectKind="COMPANY" subjectId={c.id} watching={data.viewer.watching} />
          {c.tradingOpen && (
            <TradeButton
              treasury={treasury}
              instrument={{
                kind: "share",
                companyId: c.id,
                name: c.name,
                price: data.price,
                bestAsk: book.asks[0]?.price ?? null,
                bestBid: book.bids[0]?.price ?? null,
              }}
            />
          )}
        </span>
      }
    />
  );
}

function Lore({ data }: { data: CompanyPageData }) {
  const wiki = readCompanyWikiData(data.company.wikiData);
  if (!wiki?.summary) return null;
  return (
    <Card content="prose" padding="md" className="space-y-2">
      <SectionTitle icon={<BookStack />}>From the wiki</SectionTitle>
      <p className="text-body">{wiki.summary}</p>
      <Link href={`/wiki/${encodeURIComponent(wiki.wikiSlug)}`} className="text-footnote text-tint">
        Read {wiki.pageTitle}
      </Link>
    </Card>
  );
}

/** One company: who it is, its price, its numbers, its owners, its filings, its votes and its news. */
export function CompanyPage({ companyId }: { companyId: string }) {
  const { data, isLoading, error } = api.exchange.companyPage.useQuery({ companyId });
  const [advanced, setAdvanced] = useState(false);
  const [range, setRange] = useState<Range>("1M");
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data)
    return (
      <EmptyState
        title="Company not found"
        message={error?.message ?? "It may have been delisted."}
      />
    );
  const c = data.company;
  const m = data.metrics;
  return (
    <div className="space-y-4">
      <Header data={data} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card content="visualization" className="relative overflow-hidden">
            <TextureOverlay
              texture="chevron"
              opacity={0.025}
              className="[--facet-texture-color:var(--tint)]"
            />
            <div className="relative space-y-4 p-5 md:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <Figure size="hero" value={sov(data.price)} />
                  {data.changePct !== null && (
                    <p className="text-footnote">
                      <ChangeLabel pct={data.changePct} />{" "}
                      <span className="text-label-secondary">over a day</span>
                    </p>
                  )}
                </div>
                <SegmentedControl
                  size="sm"
                  aria-label="Price history range"
                  value={range}
                  onValueChange={setRange}
                  options={RANGES.map((r) => ({ value: r, label: r }))}
                  className="w-full sm:w-auto"
                />
              </div>
              <IndexChart series={pointsIn(data.valueHistory, range)} valuePrefix="₷" />
            </div>
          </Card>
          <Card content="data" padding="md" className="space-y-3">
            <SectionTitle icon={<StatsReport />}>Key figures</SectionTitle>
            <Facts
              rows={[
                ["Market cap", sov(m.marketCap)],
                ["P/E", ratio(m.peRatio)],
                ["EPS", sov(m.eps)],
                ["Book value", sov(m.bookValue)],
                ["Dividend yield", share(m.dividendYield)],
                ["Debt to equity", ratio(m.debtToEquity)],
              ]}
            />
          </Card>
          <Card content="data" padding="md" className="space-y-3">
            <SectionTitle icon={<Activity />}>Last tick</SectionTitle>
            <Facts
              rows={[
                ["Revenue", sov(c.lastTickRevenue)],
                ["Expenses", sov(c.lastTickExpenses)],
                ["Tax", sov(c.lastTickTax)],
                ["Net income", sov(c.lastTickNetIncome)],
              ]}
            />
          </Card>
          <Governance data={data} />
          <Card content="data" padding="md" className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdvanced(!advanced)}
              aria-expanded={advanced}
            >
              <NavArrowRight
                className={cn(
                  "transition-transform duration-fast ease-out-facet",
                  advanced && "rotate-90"
                )}
                aria-hidden
              />
              Advanced: order book
            </Button>
            {advanced && <OrderBook book={data.orderBook} />}
          </Card>
        </div>
        <div className="space-y-4">
          <Card content="data" padding="md" className="space-y-2">
            <SectionTitle icon={<Group />}>Shareholders</SectionTitle>
            <ul className="divide-separator divide-y">
              {data.shareholders.map((s, i) => (
                <li key={i} data-row className={DATA_ROW_ITEM}>
                  <span>{s.label}</span>
                  <span className="tabular-nums">{(s.stake * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card content="data" padding="md" className="space-y-2">
            <SectionTitle icon={<Page />}>Filings</SectionTitle>
            {data.dividends.length + data.decisions.length === 0 ? (
              <p className="text-footnote text-label-secondary">No filings yet.</p>
            ) : (
              <ul className="divide-separator divide-y">
                {data.dividends.map((d) => (
                  <li key={d.id} data-row className={DATA_ROW_ITEM}>
                    <span>Dividend</span>
                    <span className="tabular-nums">{sov(d.amount)}</span>
                  </li>
                ))}
                {data.decisions.map((d) => (
                  <li key={d.id} data-row className={DATA_ROW_ITEM}>
                    <span>{decisionTypeLabel(d.type)}</span>
                    <Badge variant={d.appliedIxTime ? "success" : "secondary"}>
                      {d.appliedIxTime ? "Applied" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card padding="md" className="space-y-2">
            <SectionTitle icon={<Journal />}>News</SectionTitle>
            <NewsList items={data.news} emphasis="compact" empty="No news yet." />
          </Card>
          <Lore data={data} />
        </div>
      </div>
    </div>
  );
}
