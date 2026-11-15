"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Building } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { formatSovereigns } from "~/lib/exchange/amounts";
import { economyTabHref } from "~/lib/mycountry/routes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { FiscalPolicyInsights } from "../fiscal/FiscalPolicyInsights";
import { TradeCommerceInsights } from "../trade-commerce/TradeCommerceInsights";
import { RailCard, RailCount, RailRow, STATUS_TEXT } from "./shared";

function signedShiftPct(shift: number): string {
  const pct = shift * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function CorporateTreasuryInsights({ countryId }: { countryId: string }) {
  const { data: treasury } = api.exchange.getTreasury.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: summary } = api.exchange.getRealmCorporateSummary.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const companyCount = summary?.totals.companyCount ?? 0;
  const distressedCount = summary?.totals.distressedCount ?? 0;
  const balance = treasury?.balance ?? 0;
  const shift = summary?.corporateGdpShift ?? 0;
  const corpTax = (summary?.taxCompetitiveness.effectiveCorpTaxRate ?? 0.2) * 100;
  const realmTax = (summary?.taxCompetitiveness.realmAvgCorpTaxRate ?? 0.2) * 100;

  return (
    <RailCard
      title="Corporate & ₷ treasury"
      icon={Building}
      accessory={<RailCount>{companyCount} corporations</RailCount>}
      contentClassName="space-y-2.5"
    >
      <dl className="divide-separator/60 grid grid-cols-2 divide-x">
        <div className="min-w-0 pr-3">
          <dt className="text-label-secondary text-footnote block">₷ treasury</dt>
          <dd className="text-label text-title-3 mt-0.5 tabular-nums">
            {formatSovereigns(balance)}
          </dd>
        </div>
        <div className="min-w-0 pl-3">
          <dt className="text-label-secondary text-footnote block">GDP feedback</dt>
          <dd
            className={cn(
              "text-title-3 mt-0.5 tabular-nums",
              shift > 0 ? STATUS_TEXT.success : shift < 0 ? STATUS_TEXT.critical : "text-label"
            )}
          >
            {signedShiftPct(shift)}
          </dd>
        </div>
      </dl>

      <RailRow className="flex items-center justify-between gap-2">
        <span className="text-label-secondary text-footnote">Corp tax vs realm avg</span>
        <span className="text-label text-footnote font-medium tabular-nums">
          {corpTax.toFixed(1)}% vs {realmTax.toFixed(1)}%
        </span>
      </RailRow>

      {distressedCount > 0 && (
        <p className={cn("text-footnote font-medium tabular-nums", STATUS_TEXT.critical)}>
          {distressedCount} domiciled {distressedCount === 1 ? "corporation" : "corporations"} in
          distress
        </p>
      )}

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link href={economyTabHref("corporations")}>
          Open corporations console
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    </RailCard>
  );
}

/** Economy rail — fiscal policy insights, trade commerce insights & corporate treasury telemetry. */
export function EconomyRail({ countryId }: { countryId: string }) {
  return (
    <div className="space-y-6">
      {/* Corporate & ₷ Treasury Insights */}
      <CorporateTreasuryInsights countryId={countryId} />

      {/* Fiscal Policy Insights — Tax Burden, Revenue Composition, Fiscal Health */}
      <FiscalPolicyInsights countryId={countryId} />

      {/* Trade & Commerce Insights — Openness Gauge & Commercial Telemetry */}
      <TradeCommerceInsights countryId={countryId} />
    </div>
  );
}
