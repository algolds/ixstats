"use client";

import { useState } from "react";
import { Building, WarningTriangle } from "iconoir-react";
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
  sectorLabel,
  subIndustriesOf,
  subIndustryLabel,
  useRequestId,
  type Sector,
  type SubIndustryKey,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Company = Overview["companies"][number];

const LOBBY_LABELS: Record<string, string> = {
  sector: "Sector boost",
  b2g: "Tender boost",
  tax_relief: "Tax relief",
};

function FoundCompanyForm({ overview, onDone }: { overview: Overview; onDone: () => void }) {
  const notify = useNotify();
  const [form, setForm] = useState({
    name: "",
    sector: "services" as Sector,
    subIndustryKey: "finance_insurance" as SubIndustryKey,
    hqCountryId: overview.nations.find((n) => n.realmId === overview.realmId)?.id ?? "none",
  });
  const [requestId, rotate] = useRequestId();
  const found = api.exchange.foundCompany.useMutation({
    onSuccess: ({ company }) => {
      notify.success("Company chartered", `${company.name} is open for business`);
      setForm((prev) => ({ ...prev, name: "" }));
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not charter the company", e.message),
  });
  const active = overview.companies.filter(
    (c) => c.status === "ACTIVE" || c.status === "DISTRESSED"
  ).length;
  const atCap = active >= overview.companyRules.activeCompanyCap;

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
          realmId: overview.realmId,
          requestId,
        });
      }}
    >
      <p className="text-footnote text-label font-medium">Charter a company</p>
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
  const [rowState, setRowState] = useState({ raw: "", confirmDissolve: false });
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(rowState.raw);
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
  const busy = deposit.isPending || withdraw.isPending || dissolve.isPending;
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body text-label truncate font-medium">{company.name}</p>
            {onSelect && (
              <Button size="xs" variant="ghost" onClick={() => onSelect(company.id)}>
                Inspect
              </Button>
            )}
          </div>
          <p className="text-caption text-label-secondary">
            {subIndustryLabel(company.subIndustryKey)} · {sectorLabel(company.sectorKey)}
            {hqNation ? ` · HQ ${hqNation.name}` : " · Unincorporated"}
          </p>
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

      {active && (
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
            Deposit
          </Button>
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
