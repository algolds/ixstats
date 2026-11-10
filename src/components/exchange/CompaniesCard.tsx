"use client";

import { useState } from "react";
import Link from "next/link";
import { BookStack, Building, RefreshDouble } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Signal } from "~/components/ui/signal";
import { Stat } from "~/components/ui/stat";
import { Switch } from "~/components/ui/switch";
import { assetUrl } from "~/lib/base-path";
import { companyHref } from "~/lib/exchange/routes";
import { CompanyControls } from "./CompanyControls";
import { FoundCompanySheet, WikiLoreBanner } from "./FoundCompanySheet";
import { Pill } from "./terminal/brand";
import {
  CreditRatingBadge,
  StatusBadge,
  distressHoursLeft,
  formatSovereigns,
  parseAmount,
  readCompanyWikiData,
  sectorLabel,
  subIndustryLabel,
  useRequestId,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Company = Overview["companies"][number];

const LOBBY_LABELS: Record<string, string> = {
  sector: "Sector boost",
  b2g: "Tender boost",
  tax_relief: "Tax relief",
};

function CompanyRow({
  company,
  realmNations,
  acquireTargets,
  onSelect,
  onDone,
}: {
  company: Company;
  realmNations: Overview["realmNations"];
  acquireTargets: ReadonlyArray<{ id: string; name: string }>;
  onSelect?: (companyId: string) => void;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [rowState, setRowState] = useState({
    raw: "",
    confirmDissolve: false,
    showWikiSync: false,
    wikiTitle: company.wikiSlug ?? company.name,
    applyTaxonomyAndHq: false,
  });
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(rowState.raw);
  const wikiData = readCompanyWikiData(company.wikiData);
  const done = (title: string) => () => {
    notify.success(title);
    setRowState((prev) => ({ ...prev, raw: "" }));
    rotate();
    onDone();
  };
  const deposit = api.exchange.depositToCompany.useMutation({
    onSuccess: done("Deposited"),
    onError: (e) => notify.error("Deposit failed", e.message),
  });
  const withdraw = api.exchange.withdrawFromCompany.useMutation({
    onSuccess: done("Withdrawn"),
    onError: (e) => notify.error("Withdrawal failed", e.message),
  });
  const dissolve = api.exchange.dissolveCompany.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Company dissolved",
        `${formatSovereigns(r.returned)} returned to your wallet`
      );
      onDone();
    },
    onError: (e) => {
      setRowState((prev) => ({ ...prev, confirmDissolve: false }));
      notify.error("Could not dissolve", e.message);
    },
  });
  const syncWiki = api.exchange.syncCompanyWiki.useMutation({
    onSuccess: ({ preview }) => {
      notify.success("Synced from WikiOS", `Updated lore from ${preview.pageTitle}`);
      setRowState((prev) => ({ ...prev, showWikiSync: false, wikiTitle: preview.wikiSlug }));
      onDone();
    },
    onError: (e) => notify.error("WikiOS sync failed", e.message),
  });
  const busy = deposit.isPending || withdraw.isPending || dissolve.isPending || syncWiki.isPending;
  const active = company.status === "ACTIVE";
  const distressed = company.status === "DISTRESSED";
  const operating = active || distressed;
  const hqNation = company.hqCountryId
    ? realmNations.find((n) => n.id === company.hqCountryId)
    : undefined;
  const hqInterestRate = hqNation?.interestRates ?? null;
  const lobbyActive =
    Boolean(company.lobbyBuffType) &&
    company.lobbyBuffUntilIxTime !== null &&
    company.lobbyBuffUntilIxTime > Date.now();
  const hoursLeft = distressed ? distressHoursLeft(company.distressedSinceIxTime) : null;

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {wikiData?.logoUrl && (
            <img
              src={assetUrl(wikiData.logoUrl) ?? undefined}
              alt={`${company.name} logo`}
              className="border-separator bg-surface-secondary size-8 shrink-0 rounded border object-contain p-0.5"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={companyHref(company.id)}
                className="text-body text-label hover:text-tint truncate font-medium"
              >
                {company.name}
              </Link>
              {onSelect && (
                <Button size="xs" variant="ghost" onClick={() => onSelect(company.id)}>
                  Inspect
                </Button>
              )}
              {operating && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    setRowState((prev) => ({
                      ...prev,
                      showWikiSync: !prev.showWikiSync,
                      wikiTitle: prev.wikiTitle || company.wikiSlug || company.name,
                    }))
                  }
                >
                  <RefreshDouble className="mr-1 size-3" aria-hidden />
                  Sync Wiki
                </Button>
              )}
            </div>
            <p className="text-caption text-label-secondary">
              {subIndustryLabel(company.subIndustryKey)} · {sectorLabel(company.sectorKey)}
              {hqNation ? ` · HQ ${hqNation.name}` : " · Unincorporated"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Pricing: {company.pricingStrategy}</Badge>
          {lobbyActive && company.lobbyBuffType && (
            <Badge variant="info">
              Lobby: {LOBBY_LABELS[company.lobbyBuffType] ?? company.lobbyBuffType}
            </Badge>
          )}
          <CreditRatingBadge rating={company.creditRating} />
          <StatusBadge status={company.status} />
        </div>
      </div>

      {(wikiData || company.wikiSlug) && (
        <WikiLoreBanner wikiData={wikiData} wikiSlug={company.wikiSlug} />
      )}

      {operating && rowState.showWikiSync && (
        <Card variant="well" padding="sm" className="flex flex-wrap items-center gap-3">
          <div className="min-w-48 flex-1">
            <Input
              aria-label={`WikiOS page title for ${company.name}`}
              value={rowState.wikiTitle}
              onChange={(e) => setRowState({ ...rowState, wikiTitle: e.target.value })}
              placeholder="WikiOS article title (e.g. Vanguard Aerospace)"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`wiki-taxonomy-${company.id}`}
              checked={rowState.applyTaxonomyAndHq}
              onCheckedChange={(checked) =>
                setRowState({ ...rowState, applyTaxonomyAndHq: checked })
              }
            />
            <Label htmlFor={`wiki-taxonomy-${company.id}`} className="text-caption">
              Update sector &amp; HQ from infobox
            </Label>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !rowState.wikiTitle.trim()}
            onClick={() =>
              syncWiki.mutate({
                companyId: company.id,
                wikiTitle: rowState.wikiTitle.trim(),
                applyTaxonomyAndHq: rowState.applyTaxonomyAndHq,
              })
            }
          >
            <BookStack className="mr-1.5 size-3.5" aria-hidden />
            {syncWiki.isPending ? "Syncing..." : "Pull WikiOS Data"}
          </Button>
        </Card>
      )}

      {distressed && (
        <Signal tone="warning" title={`Distress alert: ${hoursLeft}h remaining`}>
          Repay your Central Bank credit line or restore capital before forced liquidation (72h
          window).
        </Signal>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat size="sm" label="Capital" value={formatSovereigns(company.capital)} />
        <Stat size="sm" label="Fair value" value={formatSovereigns(company.fairValue)} />
        <Stat size="sm" label="Standing" value={company.standing} />
        <Stat size="sm" label="Credit drawn" value={formatSovereigns(company.creditDrawn)} />
      </div>

      <Card variant="well" padding="sm" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="text-caption tabular-nums">
          <span className="text-label-secondary block">Revenue</span>
          <span className="text-label font-medium">
            {formatSovereigns(company.lastTickRevenue)}
          </span>
        </div>
        <div className="text-caption tabular-nums">
          <span className="text-label-secondary block">Operating and interest expenses</span>
          <span className="text-label font-medium">
            -{formatSovereigns(company.lastTickExpenses)}
          </span>
        </div>
        <div className="text-caption tabular-nums">
          <span className="text-label-secondary block">Corporate tax</span>
          <span className="text-label font-medium">-{formatSovereigns(company.lastTickTax)}</span>
        </div>
        <div className="text-caption tabular-nums">
          <span className="text-label-secondary block">Net income</span>
          <span
            className={
              company.lastTickNetIncome >= 0
                ? "text-success font-medium"
                : "text-destructive font-medium"
            }
          >
            {company.lastTickNetIncome >= 0 ? "+" : ""}
            {formatSovereigns(company.lastTickNetIncome)}
          </span>
        </div>
      </Card>

      {operating && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <Input
              aria-label={`Amount for ${company.name}`}
              inputMode="numeric"
              value={rowState.raw}
              onChange={(e) =>
                setRowState({ ...rowState, raw: e.target.value.replace(/[^0-9]/g, "") })
              }
              placeholder="Amount"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || Number.isNaN(amount)}
            onClick={() => deposit.mutate({ companyId: company.id, amount, requestId })}
          >
            {distressed ? "Deposit to cure" : "Deposit"}
          </Button>
          {active && (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || Number.isNaN(amount)}
                onClick={() => withdraw.mutate({ companyId: company.id, amount, requestId })}
              >
                Withdraw
              </Button>
              <Button
                size="sm"
                variant={rowState.confirmDissolve ? "destructive" : "ghost"}
                disabled={busy}
                onClick={() =>
                  rowState.confirmDissolve
                    ? dissolve.mutate({ companyId: company.id })
                    : setRowState({ ...rowState, confirmDissolve: true })
                }
              >
                {rowState.confirmDissolve ? "Confirm dissolve" : "Dissolve"}
              </Button>
            </>
          )}
        </div>
      )}
      {operating && (
        <CompanyControls
          company={company}
          hqInterestRate={hqInterestRate}
          lending={
            hqNation
              ? { spread: hqNation.lendingSpread, cap: hqNation.companyCreditCap }
              : undefined
          }
          acquireTargets={acquireTargets}
          onDone={onDone}
        />
      )}
    </Card>
  );
}

/** The player's companies and the charter sheet trigger. */
export function CompaniesCard({
  overview,
  directoryCompanies = [],
  onSelectCompany,
  onChanged,
}: {
  overview: Overview;
  directoryCompanies?: ReadonlyArray<{ id: string; name: string; founderId: string }>;
  onSelectCompany?: (companyId: string) => void;
  onChanged: () => void;
}) {
  const [chartering, setChartering] = useState(false);
  const myIds = new Set(overview.companies.map((c) => c.id));
  const acquireTargets = directoryCompanies.filter((c) => !myIds.has(c.id));

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<Building />}>Companies</CardTitle>
        {overview.isOpen && (
          <Pill onClick={() => setChartering(true)}>Charter a company</Pill>
        )}
      </div>
      {overview.companies.length === 0 ? (
        <EmptyState
          compact
          icon={<Building />}
          title="No companies yet"
          message="Charter one to post contracts, draw credit and bid on work in this realm."
        />
      ) : (
        <div className="space-y-3">
          {overview.companies.map((c) => (
            <CompanyRow
              key={c.id}
              company={c}
              realmNations={overview.realmNations}
              acquireTargets={acquireTargets}
              onSelect={onSelectCompany}
              onDone={onChanged}
            />
          ))}
        </div>
      )}
      {overview.isOpen && (
        <FoundCompanySheet
          open={chartering}
          onOpenChange={setChartering}
          overview={overview}
          onDone={onChanged}
        />
      )}
    </Card>
  );
}
