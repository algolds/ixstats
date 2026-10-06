"use client";

import { useState } from "react";
import { Building } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Stat } from "~/components/ui/stat";
import { CompanyControls } from "./CompanyControls";
import {
  Field,
  SectorSelect,
  StatusBadge,
  formatSovereigns,
  parseAmount,
  sectorLabel,
  useRequestId,
  type Sector,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Company = Overview["companies"][number];

function FoundCompanyForm({ overview, onDone }: { overview: Overview; onDone: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState("");
  const [sector, setSector] = useState<Sector>("services");
  const [requestId, rotate] = useRequestId();
  const found = api.exchange.foundCompany.useMutation({
    onSuccess: ({ company }) => {
      notify.success("Company chartered", `${company.name} is open for business`);
      setName("");
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not charter the company", e.message),
  });
  const active = overview.companies.filter((c) => c.status === "ACTIVE").length;
  const atCap = active >= overview.companyRules.activeCompanyCap;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        found.mutate({ name, sectorKey: sector, requestId });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="exchange-company-name" label="Company name">
          <Input
            id="exchange-company-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Northgate Holdings"
          />
        </Field>
        <Field id="exchange-company-sector" label="Sector">
          <SectorSelect id="exchange-company-sector" value={sector} onChange={setSector} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={found.isPending || atCap || name.trim().length < 3}
        >
          {found.isPending
            ? "Chartering..."
            : `Charter for ${formatSovereigns(overview.companyRules.charterFee)}`}
        </Button>
        <span className="text-caption text-label-secondary">
          {active} of {overview.companyRules.activeCompanyCap} active companies
        </span>
      </div>
    </form>
  );
}

function CompanyRow({ company, onDone }: { company: Company; onDone: () => void }) {
  const notify = useNotify();
  const [raw, setRaw] = useState("");
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(raw);
  const done = (title: string) => () => {
    notify.success(title);
    setRaw("");
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
      setConfirmDissolve(false);
      notify.error("Could not dissolve", e.message);
    },
  });
  const busy = deposit.isPending || withdraw.isPending || dissolve.isPending;
  const active = company.status === "ACTIVE";

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body text-label truncate font-medium">{company.name}</p>
          <p className="text-caption text-label-secondary">{sectorLabel(company.sectorKey)}</p>
        </div>
        <StatusBadge status={company.status} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat size="sm" label="Capital" value={formatSovereigns(company.capital)} />
        <Stat size="sm" label="Fair value" value={formatSovereigns(company.fairValue)} />
        <Stat size="sm" label="Standing" value={company.standing} />
      </div>
      {active && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <Input
              aria-label={`Amount for ${company.name}`}
              inputMode="numeric"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
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
            variant={confirmDissolve ? "destructive" : "ghost"}
            disabled={busy}
            onClick={() =>
              confirmDissolve
                ? dissolve.mutate({ companyId: company.id })
                : setConfirmDissolve(true)
            }
          >
            {confirmDissolve ? "Confirm dissolve" : "Dissolve"}
          </Button>
        </div>
      )}
      {active && <CompanyControls company={company} onDone={onDone} />}
    </Card>
  );
}

/** The player's companies and the charter form. */
export function CompaniesCard({
  overview,
  onChanged,
}: {
  overview: Overview;
  onChanged: () => void;
}) {
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<Building />}>Companies</CardTitle>
      {overview.companies.length === 0 ? (
        <EmptyState
          compact
          icon={<Building />}
          title="No companies yet"
          message="Charter one to post contracts and bid on other players' work."
        />
      ) : (
        <div className="space-y-3">
          {overview.companies.map((c) => (
            <CompanyRow key={c.id} company={c} onDone={onChanged} />
          ))}
        </div>
      )}
      {overview.isOpen && <FoundCompanyForm overview={overview} onDone={onChanged} />}
    </Card>
  );
}
