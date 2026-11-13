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
import { LensCard } from "~/components/ui/lens-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <Card key={label} variant="well" padding="sm">
          <Stat size="sm" label={label} value={value} />
        </Card>
      ))}
    </div>
  );
}

function OrderBook({ book }: { book: CompanyPageData["orderBook"] }) {
  const maxShares = Math.max(
    1,
    ...book.bids.map((b) => b.shares),
    ...book.asks.map((a) => a.shares)
  );
  const side = (
    title: string,
    rows: { price: number; shares: number }[],
    empty: string,
    tone: "bid" | "ask"
  ) => (
    <div className="space-y-1.5">
      <p className="text-footnote text-label-secondary font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="text-footnote text-label-secondary">{empty}</p>
      ) : (
        <ul className="space-y-1 text-footnote font-mono tabular-nums">
          {rows.map((r) => {
            const widthPct = Math.max(8, Math.round((r.shares / maxShares) * 100));
            return (
              <li
                key={r.price}
                className="rounded-control relative flex items-center justify-between overflow-hidden px-2 py-1"
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0",
                    tone === "bid" ? "bg-success/12" : "bg-destructive/12"
                  )}
                  style={{ width: `${widthPct}%` }}
                />
                <span
                  className={cn(
                    "relative font-semibold",
                    tone === "bid" ? "text-success" : "text-destructive"
                  )}
                >
                  {sov(r.price)}
                </span>
                <span className="text-label-secondary relative">
                  {r.shares.toLocaleString("en-US")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
  return (
    <Card variant="well" padding="sm" className="grid grid-cols-2 gap-4">
      {side("Bids", book.bids, "No bids", "bid")}
      {side("Asks", book.asks, "No asks", "ask")}
    </Card>
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
    <div className="border-separator space-y-2 border-t pt-3.5">
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
    </div>
  );
}

function Header({ data }: { data: CompanyPageData }) {
  const c = data.company;
  const treasury = useTreasuryActor(c.realmId);
  const wiki = readCompanyWikiData(c.wikiData);
  const book = data.orderBook;
  return (
    <LensCard app="exchange" padding="md">
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
            <span className="bg-tint-fill text-tint rounded-control px-1.5 py-0.5 font-mono text-caption font-semibold tabular-nums">
              {c.ticker}
            </span>
            {data.hq && (
              <Link href={nationHref(data.hq.id)} className="hover:text-tint transition-colors">
                {data.hq.name}
              </Link>
            )}
            <CreditRatingBadge rating={c.creditRating} />
            <StatusBadge status={c.status} />
          </span>
        }
        action={
          <span className="flex items-center gap-1.5">
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
    </LensCard>
  );
}

function Lore({ data }: { data: CompanyPageData }) {
  const wiki = readCompanyWikiData(data.company.wikiData);
  if (!wiki?.summary) return null;
  return (
    <div className="border-separator space-y-2 border-t pt-3.5">
      <SectionTitle icon={<BookStack />}>From the wiki</SectionTitle>
      <p className="text-body">{wiki.summary}</p>
      <Link href={`/wiki/${encodeURIComponent(wiki.wikiSlug)}`} className="text-footnote text-tint">
        Read {wiki.pageTitle}
      </Link>
    </div>
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
  const bestBid = data.orderBook.bids[0]?.price ?? null;
  const bestAsk = data.orderBook.asks[0]?.price ?? null;

  return (
    <div className="space-y-4">
      <Header data={data} />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <LensCard app="exchange" content="visualization" padding="none" className="overflow-hidden">
            <div className="space-y-4 p-5 md:p-6">
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
            <div className="border-separator bg-surface-secondary/60 space-y-3 border-t px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                {(bestBid !== null || bestAsk !== null) && (
                  <div className="text-caption text-label-secondary flex flex-wrap items-center gap-3 font-mono tabular-nums">
                    <span>Best bid {bestBid !== null ? `₷${formatSovereignFigure(bestBid)}` : "–"}</span>
                    <span>Best ask {bestAsk !== null ? `₷${formatSovereignFigure(bestAsk)}` : "–"}</span>
                  </div>
                )}
              </div>
              {advanced && <OrderBook book={data.orderBook} />}
            </div>
          </LensCard>

          <LensCard app="exchange" content="data" padding="md" className="space-y-4">
            <div className="space-y-3">
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
            </div>
            <div className="border-separator space-y-3 border-t pt-3.5">
              <SectionTitle icon={<Activity />}>Last tick</SectionTitle>
              <Facts
                rows={[
                  ["Revenue", sov(c.lastTickRevenue)],
                  ["Expenses", sov(c.lastTickExpenses)],
                  ["Tax", sov(c.lastTickTax)],
                  ["Net income", sov(c.lastTickNetIncome)],
                ]}
              />
            </div>
            <Governance data={data} />
          </LensCard>
        </div>

        <LensCard app="exchange" content="data" padding="md" className="space-y-4 lg:col-span-4">
          <div className="space-y-2">
            <SectionTitle icon={<Group />}>Shareholders</SectionTitle>
            <ul className="divide-separator divide-y">
              {data.shareholders.map((s, i) => (
                <li key={i} data-row className={DATA_ROW_ITEM}>
                  <span className="font-medium">{s.label}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {(s.stake * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-separator space-y-2 border-t pt-3.5">
            <SectionTitle icon={<Page />}>Filings</SectionTitle>
            {data.dividends.length + data.decisions.length === 0 ? (
              <p className="text-footnote text-label-secondary">No filings yet.</p>
            ) : (
              <ul className="divide-separator divide-y">
                {data.dividends.map((d) => (
                  <li key={d.id} data-row className={DATA_ROW_ITEM}>
                    <span>Dividend</span>
                    <span className="font-mono font-semibold tabular-nums">{sov(d.amount)}</span>
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
          </div>

          <div className="border-separator space-y-2 border-t pt-3.5">
            <SectionTitle icon={<Journal />}>News</SectionTitle>
            <NewsList items={data.news} emphasis="compact" empty="No news yet." />
          </div>

          <Lore data={data} />
        </LensCard>
      </div>
    </div>
  );
}
