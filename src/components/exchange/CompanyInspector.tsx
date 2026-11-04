"use client";

import { Building, WarningTriangle } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import {
  CompanySelect,
  CreditRatingBadge,
  StatusBadge,
  computeFairValue,
  creditLimitFor,
  distressHoursLeft,
  formatSovereigns,
  sectorLabel,
  subIndustryOf,
} from "./shared";

type Company = RouterOutputs["exchange"]["getOverview"]["companies"][number];
type Nation = RouterOutputs["exchange"]["getOverview"]["realmNations"][number];

export interface CompanyInspectorProps {
  company: Company;
  companies: ReadonlyArray<Company>;
  realmNations: ReadonlyArray<Nation>;
  sectorIndexValue?: number;
  onSelectCompany: (companyId: string) => void;
  onJumpTab: (tab: "orderbook" | "governance") => void;
}

/**
 * Sticky 320px inspector showing a company's valuation breakdown, last-tick P&L,
 * Central Bank credit utilization and quick jumps to its order book or governance.
 */
export function CompanyInspector({
  company,
  companies,
  realmNations,
  sectorIndexValue = 1000,
  onSelectCompany,
  onJumpTab,
}: CompanyInspectorProps) {
  const sub = subIndustryOf(company.subIndustryKey);
  const hqNation = company.hqCountryId
    ? realmNations.find((n) => n.id === company.hqCountryId)
    : undefined;
  const breakdown = computeFairValue(company, sectorIndexValue);
  const creditLimit = creditLimitFor(company);
  const hoursLeft =
    company.status === "DISTRESSED" ? distressHoursLeft(company.distressedSinceIxTime) : null;

  return (
    <Card padding="lg" className="w-full space-y-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-20">
      <div className="space-y-2">
        <CardTitle icon={<Building />}>Company inspector</CardTitle>
        {companies.length > 1 && (
          <CompanySelect
            id="exchange-inspector-company"
            companies={companies}
            value={company.id}
            onChange={onSelectCompany}
          />
        )}
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body text-label truncate font-medium">{company.name}</p>
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
        <p className="text-footnote text-label font-medium">Valuation breakdown</p>
        <dl className="text-caption space-y-1 tabular-nums">
          <div className="flex justify-between gap-2">
            <dt className="text-label-secondary">Liquid capital</dt>
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
