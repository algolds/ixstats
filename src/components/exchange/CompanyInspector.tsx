"use client";

import { useState } from "react";
import Link from "next/link";
import { BookStack, Building, RefreshDouble, WarningTriangle } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Stat } from "~/components/ui/stat";
import {
  CompanySelect,
  CreditRatingBadge,
  StatusBadge,
  computeCompanyMetrics,
  computeFairValue,
  creditLimitFor,
  distressHoursLeft,
  formatSovereigns,
  readCompanyWikiData,
  sectorLabel,
  subIndustryOf,
} from "./shared";

type Company = RouterOutputs["exchange"]["getOverview"]["companies"][number];
type Nation = RouterOutputs["exchange"]["getOverview"]["realmNations"][number];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CompanyInspectorProps {
  company: Company;
  companies: ReadonlyArray<Company>;
  realmNations: ReadonlyArray<Nation>;
  sectorIndexValue?: number;
  canSyncWiki?: boolean;
  onSelectCompany: (companyId: string) => void;
  onJumpTab: (tab: "orderbook" | "governance") => void;
  onSynced?: () => void;
}

/**
 * Sticky 320px inspector showing a company's WikiOS lore, valuation breakdown, financial
 * ratios, last-tick P&L, Central Bank credit utilization, dividend/decision history, and
 * quick jumps to its order book or governance.
 */
export function CompanyInspector({
  company,
  companies,
  realmNations,
  sectorIndexValue = 1000,
  canSyncWiki = false,
  onSelectCompany,
  onJumpTab,
  onSynced,
}: CompanyInspectorProps) {
  const notify = useNotify();
  const [showSyncForm, setShowSyncForm] = useState(false);
  const [wikiTitle, setWikiTitle] = useState(company.wikiSlug ?? company.name);
  const [applyTaxonomyAndHq, setApplyTaxonomyAndHq] = useState(false);

  const sub = subIndustryOf(company.subIndustryKey);
  const hqNation = company.hqCountryId
    ? realmNations.find((n) => n.id === company.hqCountryId)
    : undefined;
  const wikiData = readCompanyWikiData(company.wikiData);
  const wikiSlug = wikiData?.wikiSlug ?? company.wikiSlug ?? null;

  const recordQuery = api.exchange.getCompanyRecord.useQuery({ companyId: company.id });
  const dividends = recordQuery.data?.dividends ?? [];
  const decisions = recordQuery.data?.decisions ?? [];

  const cutoffMs = Date.now() - THIRTY_DAYS_MS;
  const trailing30dDividends = dividends
    .filter((d) => d.paidIxTime >= cutoffMs)
    .reduce((sum, d) => sum + d.totalAmount, 0);

  const metrics = computeCompanyMetrics({
    capital: company.capital,
    decisionValue: company.decisionValue,
    creditDrawn: company.creditDrawn,
    standing: company.standing,
    sharesOutstanding: company.sharesOutstanding,
    lastTradePrice: company.lastTradePrice,
    fairValue: company.fairValue,
    lastTickNetIncome: company.lastTickNetIncome,
    trailing30dDividends,
  });

  const breakdown = computeFairValue(company, sectorIndexValue);
  const creditLimit = creditLimitFor(company);
  const hoursLeft =
    company.status === "DISTRESSED" ? distressHoursLeft(company.distressedSinceIxTime) : null;

  const syncWiki = api.exchange.syncCompanyWiki.useMutation({
    onSuccess: ({ preview }) => {
      notify.success("Synced from WikiOS", `Updated lore from ${preview.pageTitle}`);
      setShowSyncForm(false);
      setWikiTitle(preview.wikiSlug);
      onSynced?.();
    },
    onError: (e) => notify.error("WikiOS sync failed", e.message),
  });

  return (
    <Card padding="lg" className="w-full space-y-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-20">
      <div className="space-y-2">
        <CardTitle icon={<Building />}>Company inspector</CardTitle>
        {companies.length > 1 && (
          <CompanySelect
            id="exchange-inspector-company"
            companies={companies}
            value={company.id}
            onChange={(id) => {
              setShowSyncForm(false);
              onSelectCompany(id);
            }}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {wikiData?.logoUrl && (
              <img
                src={wikiData.logoUrl}
                alt={`${company.name} logo`}
                className="border-separator bg-surface-1 size-7 shrink-0 rounded object-contain p-0.5 border"
              />
            )}
            <p className="text-body text-label truncate font-medium">{company.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <CreditRatingBadge rating={company.creditRating} />
            <StatusBadge status={company.status} />
          </div>
        </div>
        <p className="text-caption text-label-secondary">
          {sub?.label ?? company.subIndustryKey} · {sectorLabel(company.sectorKey)}
          {hqNation ? ` · HQ ${hqNation.name}` : " · Unincorporated domicile"}
        </p>
      </div>

      {(wikiData || wikiSlug || canSyncWiki) && (
        <div className="border-separator bg-fill-4 rounded-control space-y-2 border p-2.5">
          <div className="flex items-center justify-between gap-2">
            {wikiSlug ? (
              <Link
                href={`/wiki/${encodeURIComponent(wikiSlug)}`}
                className="text-caption text-accent inline-flex items-center gap-1 font-medium hover:underline"
              >
                <BookStack className="size-3.5 shrink-0" aria-hidden />
                {wikiSlug.replace(/_/g, " ")}
              </Link>
            ) : (
              <span className="text-caption text-label-secondary">No WikiOS article linked</span>
            )}
            {canSyncWiki && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setWikiTitle(wikiSlug ?? company.name);
                  setShowSyncForm((prev) => !prev);
                }}
              >
                <RefreshDouble className="mr-1 size-3" aria-hidden />
                {wikiSlug ? "Re-sync" : "Link Wiki"}
              </Button>
            )}
          </div>

          {wikiData?.motto && (
            <p className="text-caption text-label-secondary italic">“{wikiData.motto}”</p>
          )}
          {wikiData?.summary && (
            <p className="text-caption text-label-secondary line-clamp-3">{wikiData.summary}</p>
          )}
          {wikiData?.historyExcerpt && (
            <p className="text-caption text-label-tertiary line-clamp-2">
              {wikiData.historyExcerpt}
            </p>
          )}
          {(wikiData?.foundedText || wikiData?.keyPeople || wikiData?.products) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {wikiData.foundedText && (
                <Badge variant="outline">Est. {wikiData.foundedText}</Badge>
              )}
              {wikiData.keyPeople && <Badge variant="outline">{wikiData.keyPeople}</Badge>}
              {wikiData.products && <Badge variant="outline">{wikiData.products}</Badge>}
            </div>
          )}

          {canSyncWiki && showSyncForm && (
            <div className="border-separator space-y-2 border-t pt-2">
              <Input
                aria-label="WikiOS article title"
                value={wikiTitle}
                onChange={(e) => setWikiTitle(e.target.value)}
                placeholder="WikiOS page title"
              />
              <label className="text-caption text-label-secondary flex items-center gap-1.5 select-none">
                <input
                  type="checkbox"
                  checked={applyTaxonomyAndHq}
                  onChange={(e) => setApplyTaxonomyAndHq(e.target.checked)}
                />
                Update sector &amp; HQ from infobox
              </label>
              <Button
                size="xs"
                variant="secondary"
                disabled={syncWiki.isPending || !wikiTitle.trim()}
                onClick={() =>
                  syncWiki.mutate({
                    companyId: company.id,
                    wikiTitle: wikiTitle.trim(),
                    applyTaxonomyAndHq,
                  })
                }
              >
                {syncWiki.isPending ? "Syncing..." : "Pull from WikiOS"}
              </Button>
            </div>
          )}
        </div>
      )}

      {company.status === "DISTRESSED" && (
        <div className="border-separator bg-fill-3 rounded-control flex items-start gap-2 border p-3">
          <WarningTriangle className="text-warning-ink mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-caption text-warning-ink tabular-nums">
            In distress: {hoursLeft}h remaining in the 72h grace window before liquidation. Deposit
            capital or repay credit to cure.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat size="sm" label="Fair value" value={formatSovereigns(company.fairValue)} />
        <Stat
          size="sm"
          label="Last trade"
          value={
            company.lastTradePrice !== null
              ? formatSovereigns(company.lastTradePrice)
              : "No trades"
          }
        />
      </div>

      <div className="border-separator space-y-1.5 border-t pt-3">
        <p className="text-footnote text-label font-medium">Financial ratios</p>
        <dl className="text-caption space-y-1 tabular-nums">
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Market cap</dt>
            <dd className="text-label font-medium">{formatSovereigns(metrics.marketCap)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Book value (net equity)</dt>
            <dd className="text-label">{formatSovereigns(metrics.bookValue)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Implied share price</dt>
            <dd className="text-label">{formatSovereigns(metrics.sharePrice)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Annualized EPS</dt>
            <dd className="text-label">{formatSovereigns(metrics.eps)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">P/E ratio</dt>
            <dd className="text-label">
              {metrics.peRatio !== null ? `${metrics.peRatio.toFixed(1)}x` : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">30d dividend yield</dt>
            <dd className="text-label">
              {metrics.dividendYield !== null
                ? `${(metrics.dividendYield * 100).toFixed(2)}%`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Debt / equity</dt>
            <dd className="text-label">{(metrics.debtToEquity * 100).toFixed(1)}%</dd>
          </div>
        </dl>
      </div>

      <div className="border-separator space-y-1.5 border-t pt-3">
        <p className="text-footnote text-label font-medium">Valuation breakdown</p>
        <dl className="text-caption space-y-1 tabular-nums">
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Net liquid capital</dt>
            <dd className="text-label">{formatSovereigns(breakdown.capital)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Contract record (25%)</dt>
            <dd className="text-label">{formatSovereigns(breakdown.contracts)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Standing value</dt>
            <dd className="text-label">{formatSovereigns(breakdown.standing)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Sector index factor</dt>
            <dd className="text-label">{breakdown.sectorFactor.toFixed(2)}x</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Productive plant</dt>
            <dd className="text-label">{formatSovereigns(breakdown.decisions)}</dd>
          </div>
        </dl>
      </div>

      <div className="border-separator space-y-1.5 border-t pt-3">
        <p className="text-footnote text-label font-medium">Last tick P&L</p>
        <dl className="text-caption space-y-1 tabular-nums">
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Revenue</dt>
            <dd className="text-label">{formatSovereigns(company.lastTickRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Operating and interest expenses</dt>
            <dd className="text-label">-{formatSovereigns(company.lastTickExpenses)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Corporate tax</dt>
            <dd className="text-label">-{formatSovereigns(company.lastTickTax)}</dd>
          </div>
          <div className="flex justify-between gap-2 font-medium">
            <dt className="text-label">Net income</dt>
            <dd className={company.lastTickNetIncome >= 0 ? "text-success" : "text-destructive"}>
              {company.lastTickNetIncome >= 0 ? "+" : ""}
              {formatSovereigns(company.lastTickNetIncome)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-separator space-y-1.5 border-t pt-3">
        <div className="text-caption flex items-center justify-between gap-2 tabular-nums">
          <span className="text-label-secondary">Credit line drawn</span>
          <span className="text-label font-medium">
            {formatSovereigns(company.creditDrawn)} / {formatSovereigns(creditLimit)}
          </span>
        </div>
      </div>

      {(dividends.length > 0 || decisions.length > 0) && (
        <div className="border-separator space-y-2 border-t pt-3">
          <p className="text-footnote text-label font-medium">Recent corporate record</p>
          {dividends.slice(0, 3).map((d) => (
            <div key={d.id} className="text-caption flex justify-between gap-2 tabular-nums">
              <span className="text-label-secondary">Dividend paid</span>
              <span className="text-label">
                {formatSovereigns(d.totalAmount)} ({formatSovereigns(d.amountPerShare)}/sh)
              </span>
            </div>
          ))}
          {decisions.slice(0, 3).map((dec) => (
            <div key={dec.id} className="text-caption flex justify-between gap-2 tabular-nums">
              <span className="text-label-secondary">Decision: {dec.type}</span>
              <span className="text-label">
                {dec.cost > 0 ? formatSovereigns(dec.cost) : dec.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="secondary" onClick={() => onJumpTab("orderbook")}>
          Order book
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onJumpTab("governance")}>
          Governance
        </Button>
      </div>
    </Card>
  );
}
