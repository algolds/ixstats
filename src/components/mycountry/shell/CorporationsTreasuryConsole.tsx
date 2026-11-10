"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building,
  Coins,
  Page,
  Plus,
  StatUp,
  Wallet,
  WarningTriangle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { formatSovereigns } from "~/lib/exchange/amounts";
import { SUB_INDUSTRIES } from "~/lib/exchange/taxonomy";
import { cn } from "~/lib/utils";
import { SheetSection } from "./SheetSection";
import { STATUS_TEXT } from "./rails/shared";
import { EXCHANGE_PATHS, companyHref } from "~/lib/exchange/routes";

const SECTORS = [
  { value: "agriculture", label: "Agriculture" },
  { value: "industry", label: "Industry" },
  { value: "services", label: "Services" },
  { value: "government", label: "Government" },
] as const;

type SectorKey = (typeof SECTORS)[number]["value"];
type TenderFunding = "TREASURY" | "WALLET";

interface TenderFormState {
  title: string;
  description: string;
  sectorKey: SectorKey;
  rawValue: string;
  rawDays: string;
  fundedBy: TenderFunding;
  requestId: string;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function createInitialForm(): TenderFormState {
  return {
    title: "",
    description: "",
    sectorKey: "services",
    rawValue: "",
    rawDays: "7",
    fundedBy: "TREASURY",
    requestId: newRequestId(),
  };
}

function sectorLabelOf(key: string): string {
  return SECTORS.find((s) => s.value === key)?.label ?? key;
}

function subIndustryLabelOf(subIndustryKey: string, sectorKey: string): string {
  return (
    SUB_INDUSTRIES.find((sub) => sub.key === subIndustryKey)?.label ?? sectorLabelOf(sectorKey)
  );
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  STIPEND: "Daily sovereign stipend",
  TAX: "Corporate profit tax",
  TARIFF: "Cross-border trade tariff",
  INTEREST: "Central Bank credit interest",
  LOBBY: "Corporate lobby contribution",
  B2G_ESCROW: "Treasury tender escrow",
  B2G_REFUND: "Cancelled tender refund",
  SPEND: "Treasury expenditure",
  BOND_SALE: "Sovereign bond issue",
  BOND_COUPON: "Bond coupon payment",
  BOND_PRINCIPAL: "Bond principal repayment",
  FUND_RETURN: "Wealth fund transfer",
};

function entryTypeLabel(type: string): string {
  return ENTRY_TYPE_LABELS[type] ?? type;
}

function signedPct(fraction: number, digits = 2): string {
  const pct = fraction * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

function parsePositiveInt(raw: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : Number.NaN;
}

export interface CorporationsTreasuryConsoleProps {
  countryId: string;
  countryName?: string | null;
}

export function CorporationsTreasuryConsole({
  countryId,
  countryName,
}: CorporationsTreasuryConsoleProps): React.JSX.Element {
  const notify = useNotify();
  const utils = api.useUtils();
  const [form, setForm] = useState<TenderFormState>(createInitialForm);

  const treasuryQuery = api.exchange.getTreasury.useQuery({ countryId }, { enabled: !!countryId });
  const summaryQuery = api.exchange.getRealmCorporateSummary.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const createTender = api.exchange.createTreasuryTender.useMutation({
    onSuccess: () => {
      notify.success("Treasury tender posted", "Bids are now open on the Exchange.");
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        rawValue: "",
        requestId: newRequestId(),
      }));
      void utils.exchange.getTreasury.invalidate({ countryId });
      void utils.exchange.getRealmCorporateSummary.invalidate({ countryId });
    },
    onError: (err: { message?: string }) => {
      notify.error("Could not post treasury tender", err.message ?? "Unknown error");
    },
  });

  if (treasuryQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <Skeleton key={idx} className="rounded-card h-24" />
          ))}
        </div>
        <Skeleton className="rounded-card h-64" />
      </div>
    );
  }

  const treasury = treasuryQuery.data;
  const summary = summaryQuery.data;
  const totals = summary?.totals;
  const tax = summary?.taxCompetitiveness;
  const companies = summary?.companies ?? [];
  const openTenders = summary?.openTenders ?? [];
  const recentEntries = treasury?.recent ?? [];

  const balance = treasury?.balance ?? 0;
  const cap = treasury?.cap ?? 50_000;
  const dailyStipend = treasury?.dailyStipend ?? 0;
  const lifetimeFiscalInflow =
    (treasury?.lifetimeTaxEarned ?? 0) +
    (treasury?.lifetimeTariffEarned ?? 0) +
    (treasury?.lifetimeInterestEarned ?? 0);
  const gdpShift = summary?.corporateGdpShift ?? 0;

  const valueNum = parsePositiveInt(form.rawValue);
  const daysNum = parsePositiveInt(form.rawDays);
  const formValid =
    !!countryId &&
    form.title.trim().length >= 3 &&
    valueNum >= 10 &&
    valueNum <= 10_000_000 &&
    daysNum >= 1 &&
    daysNum <= 30;

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-card p-4">
          <span className="text-label-secondary text-footnote block">Nation ₷ treasury</span>
          <p className="text-label text-title-3 mt-1 tabular-nums">{formatSovereigns(balance)}</p>
          <p className="text-label-secondary text-footnote mt-0.5 tabular-nums">
            Cap {formatSovereigns(cap)} · +{formatSovereigns(dailyStipend)}/day stipend
          </p>
        </Card>

        <Card className="rounded-card p-4">
          <span className="text-label-secondary text-footnote block">Domiciled corporations</span>
          <p className="text-label text-title-3 mt-1 tabular-nums">
            {totals?.companyCount ?? 0} ({formatSovereigns(totals?.totalFairValue ?? 0)})
          </p>
          <p
            className={cn(
              "text-footnote mt-0.5 tabular-nums",
              (totals?.distressedCount ?? 0) > 0 ? STATUS_TEXT.critical : "text-label-secondary"
            )}
          >
            {(totals?.distressedCount ?? 0) > 0
              ? `${totals?.distressedCount} in distress`
              : "All in good standing"}
          </p>
        </Card>

        <Card className="rounded-card p-4">
          <span className="text-label-secondary text-footnote block">Corporate fiscal revenue</span>
          <p className="text-label text-title-3 mt-1 tabular-nums">
            {formatSovereigns(lifetimeFiscalInflow)}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5 tabular-nums">
            Last tick tax {formatSovereigns(totals?.lastTickTax ?? 0)}
          </p>
        </Card>

        <Card className="rounded-card p-4">
          <span className="text-label-secondary text-footnote block">Macro GDP feedback</span>
          <p
            className={cn(
              "text-title-3 mt-1 tabular-nums",
              gdpShift > 0
                ? STATUS_TEXT.success
                : gdpShift < 0
                  ? STATUS_TEXT.critical
                  : "text-label"
            )}
          >
            {signedPct(gdpShift)}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5 tabular-nums">
            Corp tax {((tax?.effectiveCorpTaxRate ?? 0.2) * 100).toFixed(1)}% vs{" "}
            {((tax?.realmAvgCorpTaxRate ?? 0.2) * 100).toFixed(1)}% realm avg
          </p>
        </Card>
      </div>

      {/* Issue B2G Treasury Tender */}
      <SheetSection
        title="Issue B2G treasury tender"
        icon={Page}
        accessory={
          <Badge variant="default" className="tabular-nums">
            {openTenders.length} active
          </Badge>
        }
      >
        <div className="space-y-4">
          <p className="text-label-secondary text-footnote">
            Post a government procurement tender for corporations in your realm to bid on. Winning
            deliveries build national corporate activity and feed back into GDP within a ±5% band.
          </p>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!formValid || createTender.isPending) return;
              createTender.mutate({
                countryId,
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                sectorKey: form.sectorKey,
                value: valueNum,
                biddingDays: daysNum,
                fundedBy: form.fundedBy,
                requestId: form.requestId,
              });
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-footnote text-label-secondary">Escrow funding source</Label>
              <SegmentedControl
                aria-label="Tender funding source"
                size="sm"
                value={form.fundedBy}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, fundedBy: val as TenderFunding }))
                }
                options={[
                  { value: "TREASURY", label: `Nation treasury (${formatSovereigns(balance)})` },
                  { value: "WALLET", label: "Personal wallet" },
                ]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b2g-tender-title">Tender title</Label>
                <Input
                  id="b2g-tender-title"
                  value={form.title}
                  maxLength={120}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={`Expand ${countryName ?? "national"} port logistics capacity`}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="b2g-tender-sector">Sector</Label>
                <Select
                  value={form.sectorKey}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, sectorKey: v as SectorKey }))}
                >
                  <SelectTrigger id="b2g-tender-sector" aria-label="Tender sector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b2g-tender-value">Ceiling value (₷)</Label>
                <Input
                  id="b2g-tender-value"
                  inputMode="numeric"
                  value={form.rawValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rawValue: e.target.value.replace(/[^0-9]/g, ""),
                    }))
                  }
                  placeholder="1000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="b2g-tender-days">Bidding window (days)</Label>
                <Input
                  id="b2g-tender-days"
                  inputMode="numeric"
                  value={form.rawDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rawDays: e.target.value.replace(/[^0-9]/g, ""),
                    }))
                  }
                  placeholder="7"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b2g-tender-description">Delivery terms (optional)</Label>
              <Textarea
                id="b2g-tender-description"
                rows={2}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Scope of work and delivery milestones"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="submit" size="sm" disabled={!formValid || createTender.isPending}>
                <Plus aria-hidden="true" />
                {createTender.isPending ? "Posting tender..." : "Post B2G tender"}
              </Button>
              <span className="text-label-secondary text-footnote tabular-nums">
                {form.fundedBy === "TREASURY"
                  ? `Escrow debits nation ₷ treasury (${formatSovereigns(balance)} available)`
                  : "Escrow debits your personal ₷ wallet"}
              </span>
            </div>
          </form>

          {openTenders.length > 0 && (
            <div className="border-separator space-y-2 border-t pt-3">
              <h4 className="text-label text-footnote font-medium">Open & awarded B2G tenders</h4>
              <div className="space-y-2">
                {openTenders.map((t) => (
                  <Card
                    key={t.id}
                    className="rounded-row flex flex-wrap items-center justify-between gap-2 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-label text-footnote truncate font-medium">{t.title}</p>
                      <p className="text-label-secondary text-footnote tabular-nums">
                        {sectorLabelOf(t.sectorKey)} · Ceiling {formatSovereigns(t.value)} · Funded
                        by {t.fundedBy === "TREASURY" ? "Treasury" : "Wallet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={t.bidCount > 0 ? "info" : "default"}
                        className="tabular-nums"
                      >
                        {t.bidCount} {t.bidCount === 1 ? "bid" : "bids"}
                        {t.lowestBid != null ? ` (low ${formatSovereigns(t.lowestBid)})` : ""}
                      </Badge>
                      <Badge variant={t.status === "AWARDED" ? "secondary" : "default"}>
                        {t.status === "AWARDED" ? "Awarded" : "Open"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetSection>

      {/* Domiciled Corporations */}
      <SheetSection
        title="Domiciled corporations"
        icon={Building}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={EXCHANGE_PATHS.treasury}>
              Open the Treasury
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {companies.length === 0 ? (
          <p className="text-label-secondary text-footnote py-4 text-center">
            No corporations are currently headquartered in this nation. Players can charter or
            domicile corporations on the Exchange.
          </p>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => (
              <Card key={c.id} className="rounded-row space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={companyHref(c.id)}
                      className="text-label text-footnote hover:text-tint block truncate font-semibold"
                    >
                      {c.name}
                    </Link>
                    <p className="text-label-secondary text-footnote">
                      {subIndustryLabelOf(c.subIndustryKey, c.sectorKey)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="default" className="tabular-nums">
                      Rating {c.creditRating}
                    </Badge>
                    {c.status === "DISTRESSED" ? (
                      <Badge variant="destructive">
                        <WarningTriangle aria-hidden="true" className="mr-1 size-3" />
                        Distressed
                      </Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>
                </div>

                <div className="text-footnote grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <div>
                    <span className="text-label-secondary block">Fair value</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatSovereigns(c.fairValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-label-secondary block">Capital</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatSovereigns(c.capital)}
                    </span>
                  </div>
                  <div>
                    <span className="text-label-secondary block">Credit drawn</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatSovereigns(c.creditDrawn)} / {formatSovereigns(c.creditLimit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-label-secondary block">Last revenue</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatSovereigns(c.lastTickRevenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-label-secondary block">Last tax paid</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatSovereigns(c.lastTickTax)}
                    </span>
                  </div>
                  <div>
                    <span className="text-label-secondary block">Net income</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        c.lastTickNetIncome >= 0 ? STATUS_TEXT.success : STATUS_TEXT.critical
                      )}
                    >
                      {c.lastTickNetIncome >= 0 ? "+" : "-"}
                      {formatSovereigns(Math.abs(c.lastTickNetIncome))}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SheetSection>

      {/* Recent Nation Treasury Ledger */}
      <SheetSection
        title="Recent nation treasury ledger"
        icon={Wallet}
        accessory={
          <Badge variant="default" className="tabular-nums">
            <Coins aria-hidden="true" className="mr-1 size-3" />
            Spent {formatSovereigns(treasury?.lifetimeSpent ?? 0)}
          </Badge>
        }
      >
        {recentEntries.length === 0 ? (
          <p className="text-label-secondary text-footnote py-4 text-center">
            No treasury ledger entries recorded yet. Daily stipends and corporate taxes appear here
            as the Exchange ticks.
          </p>
        ) : (
          <ul className="divide-separator divide-y">
            {recentEntries.map((entry) => (
              <li
                key={entry.id}
                className="text-footnote flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-label truncate font-medium">{entryTypeLabel(entry.type)}</p>
                  <p className="text-label-secondary truncate">{entry.source}</p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p
                    className={cn(
                      "font-medium",
                      entry.amount >= 0 ? STATUS_TEXT.success : "text-label"
                    )}
                  >
                    {entry.amount >= 0 ? "+" : "-"}
                    {formatSovereigns(Math.abs(entry.amount))}
                  </p>
                  <p className="text-label-secondary">
                    Balance {formatSovereigns(entry.balanceAfter)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      {/* Tax Competitiveness Footnote */}
      <SheetSection title="Tax & monetary competitiveness" icon={StatUp}>
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-row p-2.5">
            <span className="text-label-secondary text-footnote block">Effective corp tax</span>
            <p className="text-label text-title-3 mt-0.5 tabular-nums">
              {((tax?.effectiveCorpTaxRate ?? 0.2) * 100).toFixed(1)}%
            </p>
          </Card>
          <Card className="rounded-row p-2.5">
            <span className="text-label-secondary text-footnote block">Capital gains rate</span>
            <p className="text-label text-title-3 mt-0.5 tabular-nums">
              {((tax?.capGainsTaxRate ?? 0.15) * 100).toFixed(1)}%
            </p>
          </Card>
          <Card className="rounded-row p-2.5">
            <span className="text-label-secondary text-footnote block">Central Bank rate</span>
            <p className="text-label text-title-3 mt-0.5 tabular-nums">
              {((tax?.interestRate ?? 0.05) * 100).toFixed(1)}%
            </p>
          </Card>
        </div>
      </SheetSection>
    </div>
  );
}
