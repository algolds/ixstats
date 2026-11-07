"use client";

import { useState } from "react";
import Link from "next/link";
import { BookStack, Building, RefreshDouble, WarningTriangle } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Stat } from "~/components/ui/stat";
import { CompanyControls } from "./CompanyControls";
import {
  CreditRatingBadge,
  Field,
  SectorSelect,
  StatusBadge,
  SubIndustrySelect,
  distressHoursLeft,
  formatSovereigns,
  parseAmount,
  readCompanyWikiData,
  sectorLabel,
  subIndustriesOf,
  subIndustryLabel,
  useRequestId,
  type CompanyWikiData,
  type Sector,
  type SubIndustryKey,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Company = Overview["companies"][number];
type WikiPreview = RouterOutputs["exchange"]["previewWikiCompany"];

const LOBBY_LABELS: Record<string, string> = {
  sector: "Sector boost",
  b2g: "Tender boost",
  tax_relief: "Tax relief",
};

function WikiLoreBanner({ wikiData, wikiSlug }: { wikiData: CompanyWikiData | null; wikiSlug?: string | null }) {
  const slug = wikiData?.wikiSlug ?? wikiSlug ?? null;
  if (!slug && !wikiData) return null;
  return (
    <div className="border-separator bg-fill-4 rounded-control space-y-1.5 border p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {wikiData?.logoUrl && (
            <img
              src={wikiData.logoUrl}
              alt={`${wikiData.pageTitle} logo`}
              className="border-separator bg-surface-1 size-7 rounded object-contain p-0.5 border"
            />
          )}
          <div>
            {slug && (
              <Link
                href={`/wiki/${encodeURIComponent(slug)}`}
                className="text-caption text-accent inline-flex items-center gap-1 font-medium hover:underline"
              >
                <BookStack className="size-3.5" aria-hidden />
                WikiOS: {slug.replace(/_/g, " ")}
              </Link>
            )}
            {wikiData?.motto && (
              <p className="text-caption text-label-secondary italic">“{wikiData.motto}”</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {wikiData?.foundedText && <Badge variant="outline">Founded: {wikiData.foundedText}</Badge>}
          {wikiData?.keyPeople && <Badge variant="outline">Leadership: {wikiData.keyPeople}</Badge>}
          {wikiData?.products && <Badge variant="outline">Products: {wikiData.products}</Badge>}
        </div>
      </div>
      {wikiData?.summary && (
        <p className="text-caption text-label-secondary line-clamp-2">{wikiData.summary}</p>
      )}
    </div>
  );
}

function FoundCompanyForm({ overview, onDone }: { overview: Overview; onDone: () => void }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: "",
    sector: "services" as Sector,
    subIndustryKey: "finance_insurance" as SubIndustryKey,
    hqCountryId: overview.nations.find((n) => n.realmId === overview.realmId)?.id ?? "none",
    wikiInput: "",
  });
  const [wikiPreview, setWikiPreview] = useState<WikiPreview | null>(null);
  const [fetchingWiki, setFetchingWiki] = useState(false);
  const [requestId, rotate] = useRequestId();
  const found = api.exchange.foundCompany.useMutation({
    onSuccess: ({ company }) => {
      notify.success("Company chartered", `${company.name} is open for business`);
      setForm((prev) => ({ ...prev, name: "", wikiInput: "" }));
      setWikiPreview(null);
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not charter the company", e.message),
  });
  const active = overview.companies.filter(
    (c) => c.status === "ACTIVE" || c.status === "DISTRESSED"
  ).length;
  const atCap = active >= overview.companyRules.activeCompanyCap;

  const handleImportWiki = async () => {
    const title = form.wikiInput.trim() || form.name.trim();
    if (!title) return;
    setFetchingWiki(true);
    try {
      const preview = await utils.exchange.previewWikiCompany.fetch({
        wikiTitle: title,
        realmId: overview.realmId,
      });
      setWikiPreview(preview);
      setForm((prev) => ({
        ...prev,
        name: preview.companyName.slice(0, 60),
        sector: preview.sectorKey as Sector,
        subIndustryKey: preview.subIndustryKey,
        hqCountryId: preview.hqCountryId ?? prev.hqCountryId,
        wikiInput: preview.wikiSlug,
      }));
      notify.success(
        "Imported from WikiOS",
        `Loaded ${preview.pageTitle} (${subIndustryLabel(preview.subIndustryKey)})`
      );
    } catch (err) {
      notify.error(
        "Could not import from WikiOS",
        err instanceof Error ? err.message : "WikiOS article not found"
      );
    } finally {
      setFetchingWiki(false);
    }
  };

  return (
    <form
      className="border-separator space-y-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        found.mutate({
          name: form.name,
          sectorKey: form.sector,
          subIndustryKey: form.subIndustryKey,
          hqCountryId: form.hqCountryId === "none" ? null : form.hqCountryId,
          wikiSlug: wikiPreview?.wikiSlug ?? (form.wikiInput.trim() || null),
          realmId: overview.realmId,
          requestId,
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-footnote text-label font-medium">Charter a company</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52 sm:w-64">
            <Input
              aria-label="WikiOS article title or URL"
              value={form.wikiInput}
              onChange={(e) => setForm({ ...form, wikiInput: e.target.value })}
              placeholder="WikiOS page (e.g. Vanguard Aerospace)"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={fetchingWiki || (!form.wikiInput.trim() && !form.name.trim())}
            onClick={() => void handleImportWiki()}
          >
            <BookStack className="mr-1.5 size-3.5" aria-hidden />
            {fetchingWiki ? "Importing..." : "Sync from WikiOS"}
          </Button>
          {wikiPreview && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setWikiPreview(null);
                setForm((prev) => ({ ...prev, wikiInput: "" }));
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {wikiPreview && (
        <WikiLoreBanner wikiData={wikiPreview.wikiData} wikiSlug={wikiPreview.wikiSlug} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="exchange-company-name" label="Company name">
          <Input
            id="exchange-company-name"
            value={form.name}
            maxLength={60}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Northgate Holdings"
          />
        </Field>
        <Field id="exchange-company-sector" label="Sector">
          <SectorSelect
            id="exchange-company-sector"
            value={form.sector}
            onChange={(sector) =>
              setForm({
                ...form,
                sector,
                subIndustryKey: (subIndustriesOf(sector)[0]?.key ??
                  form.subIndustryKey) as SubIndustryKey,
              })
            }
          />
        </Field>
        <Field id="exchange-company-subindustry" label="Sub-industry">
          <SubIndustrySelect
            id="exchange-company-subindustry"
            sectorKey={form.sector}
            value={form.subIndustryKey}
            onChange={(subIndustryKey) => setForm({ ...form, subIndustryKey })}
          />
        </Field>
        <Field id="exchange-company-hq" label="Domicile nation (optional)">
          <Select
            value={form.hqCountryId}
            onValueChange={(hqCountryId) => setForm({ ...form, hqCountryId })}
          >
            <SelectTrigger id="exchange-company-hq" size="sm" aria-label="Domicile nation">
              <SelectValue placeholder="Unincorporated" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unincorporated (no domicile)</SelectItem>
              {overview.realmNations.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name} ({n.economicTier})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={found.isPending || atCap || form.name.trim().length < 3}
        >
          {found.isPending
            ? "Chartering..."
            : `Charter for ${formatSovereigns(overview.companyRules.charterFee)}`}
        </Button>
        <span className="text-caption text-label-secondary tabular-nums">
          {active} of {overview.companyRules.activeCompanyCap} active companies
        </span>
      </div>
    </form>
  );
}

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
              src={wikiData.logoUrl}
              alt={`${company.name} logo`}
              className="border-separator bg-surface-1 size-8 shrink-0 rounded object-contain p-0.5 border"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body text-label truncate font-medium">{company.name}</p>
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
        <div className="border-separator bg-fill-4 rounded-control flex flex-wrap items-center gap-2 border p-2.5">
          <div className="min-w-48 flex-1">
            <Input
              aria-label={`WikiOS page title for ${company.name}`}
              value={rowState.wikiTitle}
              onChange={(e) => setRowState({ ...rowState, wikiTitle: e.target.value })}
              placeholder="WikiOS article title (e.g. Vanguard Aerospace)"
            />
          </div>
          <label className="text-caption text-label-secondary flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={rowState.applyTaxonomyAndHq}
              onChange={(e) => setRowState({ ...rowState, applyTaxonomyAndHq: e.target.checked })}
            />
            Also update sector &amp; HQ from infobox
          </label>
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
        </div>
      )}

      {distressed && (
        <div className="border-separator bg-fill-3 rounded-control flex items-start gap-2 border p-3">
          <WarningTriangle className="text-warning-ink mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-caption text-warning-ink tabular-nums">
            Distress alert: {hoursLeft}h remaining before forced liquidation (72h window). Repay
            your Central Bank credit line or restore capital to cure.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat size="sm" label="Capital" value={formatSovereigns(company.capital)} />
        <Stat size="sm" label="Fair value" value={formatSovereigns(company.fairValue)} />
        <Stat size="sm" label="Standing" value={company.standing} />
        <Stat size="sm" label="Credit drawn" value={formatSovereigns(company.creditDrawn)} />
      </div>

      <div className="border-separator rounded-control bg-fill-4 grid grid-cols-2 gap-2 border p-2.5 sm:grid-cols-4">
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
      </div>

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
          acquireTargets={acquireTargets}
          onDone={onDone}
        />
      )}
    </Card>
  );
}

/** The player's companies and the charter form. */
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
  const myIds = new Set(overview.companies.map((c) => c.id));
  const acquireTargets = directoryCompanies.filter((c) => !myIds.has(c.id));

  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<Building />}>Companies</CardTitle>
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
      {overview.isOpen && <FoundCompanyForm overview={overview} onDone={onChanged} />}
    </Card>
  );
}
