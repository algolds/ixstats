"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
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
import {
  CompanySelect,
  SectorSelect,
  SubIndustrySelect,
  formatSovereigns,
  parseAmount,
  sectorLabel,
  subIndustriesOf,
  useRequestId,
  type Sector,
  type SubIndustryKey,
} from "./shared";

type Company = RouterOutputs["exchange"]["getOverview"]["companies"][number];
type DecisionType = "EXPAND" | "ENTER_SECTOR" | "RND" | "LOBBY" | "PRICE" | "ACQUIRE";
type RndFocus = "efficiency" | "breakthrough";
type LobbyTarget = "sector" | "b2g" | "tax_relief";
type PricingStrategy = "undercut" | "balanced" | "premium";

const ENTER_SECTOR_COST = 500;
const LOBBY_COST = 500;
const PRICE_COST = 200;

const DECISION_LABELS: Record<DecisionType, string> = {
  EXPAND: "an expansion",
  ENTER_SECTOR: "a move to a new sector",
  RND: "a research program",
  LOBBY: "a lobbying campaign",
  PRICE: "a pricing change",
  ACQUIRE: "an acquisition offer",
};

function digits(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}

/** Strategic decision controls for an operating company (24-hour execution queue). */
export function CompanyDecisionControls({
  company,
  acquireTargets,
  onDone,
}: {
  company: Company;
  acquireTargets: ReadonlyArray<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const notify = useNotify();
  const defaultNextSector: Sector = company.sectorKey === "services" ? "industry" : "services";
  const [kind, setKind] = useState<DecisionType>("EXPAND");
  const [form, setForm] = useState({
    rawAmount: "",
    sector: defaultNextSector as Sector,
    subIndustry: (subIndustriesOf(defaultNextSector)[0]?.key ?? "energy_mining") as SubIndustryKey,
    focus: "efficiency" as RndFocus,
    target: "sector" as LobbyTarget,
    strategy: "balanced" as PricingStrategy,
    targetCompanyId: acquireTargets[0]?.id ?? "",
  });
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(form.rawAmount);
  const record = api.exchange.getCompanyRecord.useQuery({ companyId: company.id });
  const pending = record.data?.decisions.find((d) => d.appliedIxTime === null);

  const submit = api.exchange.submitDecision.useMutation({
    onSuccess: () => {
      notify.success("Decision queued", "It takes effect after 24 hours");
      setForm((prev) => ({ ...prev, rawAmount: "" }));
      rotate();
      void record.refetch();
      onDone();
    },
    onError: (e) => notify.error("Could not queue the decision", e.message),
  });

  if (pending) {
    const label = DECISION_LABELS[pending.type as DecisionType] ?? pending.type.toLowerCase();
    return (
      <div className="border-separator space-y-1 border-t pt-3">
        <p className="text-footnote text-label font-medium">Strategic decision</p>
        <p className="text-footnote text-label-secondary">
          Pending: {label}, applied by the next market update 24 hours after it was queued.
        </p>
      </div>
    );
  }

  const targetCompanyId = form.targetCompanyId || acquireTargets[0]?.id || "";
  const ready =
    company.status === "ACTIVE" &&
    ((kind === "EXPAND" && amount >= 100) ||
      (kind === "ENTER_SECTOR" && form.sector !== company.sectorKey) ||
      (kind === "RND" && amount >= 250) ||
      kind === "LOBBY" ||
      kind === "PRICE" ||
      (kind === "ACQUIRE" && amount >= 100 && Boolean(targetCompanyId)));

  const handleQueue = () => {
    if (!ready) return;
    if (kind === "EXPAND") {
      submit.mutate({ companyId: company.id, type: "EXPAND", amount, requestId });
    } else if (kind === "ENTER_SECTOR") {
      submit.mutate({
        companyId: company.id,
        type: "ENTER_SECTOR",
        sectorKey: form.sector,
        subIndustryKey: form.subIndustry,
        requestId,
      });
    } else if (kind === "RND") {
      submit.mutate({
        companyId: company.id,
        type: "RND",
        amount,
        focus: form.focus,
        requestId,
      });
    } else if (kind === "LOBBY") {
      submit.mutate({
        companyId: company.id,
        type: "LOBBY",
        target: form.target,
        requestId,
      });
    } else if (kind === "PRICE") {
      submit.mutate({
        companyId: company.id,
        type: "PRICE",
        strategy: form.strategy,
        requestId,
      });
    } else {
      submit.mutate({
        companyId: company.id,
        type: "ACQUIRE",
        targetCompanyId,
        offerAmount: amount,
        requestId,
      });
    }
  };

  return (
    <div className="border-separator space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`decision-type-${company.id}`}>Strategic decision</Label>
        <div className="w-48">
          <Select value={kind} onValueChange={(v) => setKind(v as DecisionType)}>
            <SelectTrigger id={`decision-type-${company.id}`} size="sm" aria-label="Decision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPAND">Expand plant</SelectItem>
              <SelectItem value="ENTER_SECTOR">Enter a sector</SelectItem>
              <SelectItem value="RND">Research and development</SelectItem>
              <SelectItem value="LOBBY">Policy lobbying</SelectItem>
              <SelectItem value="PRICE">Pricing strategy</SelectItem>
              <SelectItem value="ACQUIRE">Acquire a company</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {(kind === "EXPAND" || kind === "RND" || kind === "ACQUIRE") && (
          <div className="w-32">
            <Input
              aria-label={`Amount for ${company.name} decision`}
              inputMode="numeric"
              value={form.rawAmount}
              onChange={(e) => setForm({ ...form, rawAmount: digits(e.target.value) })}
              placeholder={kind === "RND" ? "Min 250" : "Min 100"}
            />
          </div>
        )}
        {kind === "ENTER_SECTOR" && (
          <>
            <div className="w-36">
              <SectorSelect
                id={`decision-sector-${company.id}`}
                value={form.sector}
                onChange={(sector) =>
                  setForm({
                    ...form,
                    sector,
                    subIndustry: (subIndustriesOf(sector)[0]?.key ??
                      form.subIndustry) as SubIndustryKey,
                  })
                }
              />
            </div>
            <div className="w-52">
              <SubIndustrySelect
                id={`decision-sub-${company.id}`}
                sectorKey={form.sector}
                value={form.subIndustry}
                onChange={(subIndustry) => setForm({ ...form, subIndustry })}
              />
            </div>
          </>
        )}
        {kind === "RND" && (
          <SegmentedControl
            aria-label="R&D focus"
            size="sm"
            value={form.focus}
            onValueChange={(v) => setForm({ ...form, focus: v as RndFocus })}
            options={[
              { value: "efficiency", label: "Efficiency (1.15x)" },
              { value: "breakthrough", label: "Breakthrough roll" },
            ]}
          />
        )}
        {kind === "LOBBY" && (
          <SegmentedControl
            aria-label="Lobby target"
            size="sm"
            value={form.target}
            onValueChange={(v) => setForm({ ...form, target: v as LobbyTarget })}
            options={[
              { value: "sector", label: "Sector boost" },
              { value: "b2g", label: "Tender boost" },
              { value: "tax_relief", label: "Tax relief" },
            ]}
          />
        )}
        {kind === "PRICE" && (
          <SegmentedControl
            aria-label="Pricing strategy"
            size="sm"
            value={form.strategy}
            onValueChange={(v) => setForm({ ...form, strategy: v as PricingStrategy })}
            options={[
              { value: "undercut", label: "Undercut" },
              { value: "balanced", label: "Balanced" },
              { value: "premium", label: "Premium" },
            ]}
          />
        )}
        {kind === "ACQUIRE" && (
          <div className="w-48">
            <CompanySelect
              id={`decision-acquire-${company.id}`}
              companies={acquireTargets}
              value={targetCompanyId}
              onChange={(id) => setForm({ ...form, targetCompanyId: id })}
            />
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={submit.isPending || !ready}
          onClick={handleQueue}
        >
          {kind === "EXPAND"
            ? "Invest"
            : kind === "ENTER_SECTOR"
              ? `Move for ${formatSovereigns(ENTER_SECTOR_COST)}`
              : kind === "RND"
                ? "Fund R&D"
                : kind === "LOBBY"
                  ? `Lobby for ${formatSovereigns(LOBBY_COST)}`
                  : kind === "PRICE"
                    ? `Reprice for ${formatSovereigns(PRICE_COST)}`
                    : "Queue buyout offer"}
        </Button>
      </div>

      <p className="text-caption text-label-secondary">
        {kind === "EXPAND" &&
          "Turns capital into plant: it leaves capital now and adds the same to fair value after a day."}
        {kind === "ENTER_SECTOR" &&
          `Moves ${company.name} out of ${sectorLabel(company.sectorKey)} into the chosen sector and sub-industry.`}
        {kind === "RND" &&
          "Efficiency adds 1.15x plant and +1 standing; breakthrough rolls 0.6x to 2.1x plant weighted by HQ government efficiency."}
        {kind === "LOBBY" &&
          "Grants a 14-day revenue or tax buff. Half of the fee goes to your HQ nation treasury."}
        {kind === "PRICE" &&
          "Undercut trades margin for standing; premium lifts margin at higher upkeep; balanced keeps baseline."}
        {kind === "ACQUIRE" &&
          "Escrows your offer and opens a shareholder buyout vote on the target company after 24 hours."}
      </p>
    </div>
  );
}

