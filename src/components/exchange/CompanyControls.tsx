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
import { Switch } from "~/components/ui/switch";
import {
  CompanySelect,
  SectorSelect,
  SubIndustrySelect,
  borrowRateOf,
  creditLimitFor,
  formatSovereigns,
  parseAmount,
  parseDecimalAmount,
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

function SharesControls({ company, onDone }: { company: Company; onDone: () => void }) {
  const notify = useNotify();
  const [rawShares, setRawShares] = useState("");
  const [rawDividend, setRawDividend] = useState("");
  const [issueId, rotateIssue] = useRequestId();
  const [dividendId, rotateDividend] = useRequestId();
  const shares = parseAmount(rawShares);
  const dividend = parseAmount(rawDividend);
  const price =
    company.sharesOutstanding > 0
      ? Math.max(0.01, Math.floor((company.fairValue * 100) / company.sharesOutstanding) / 100)
      : 0.01;

  const trading = api.exchange.setShareTrading.useMutation({
    onSuccess: (r) => {
      notify.success(r.tradingOpen ? "Share trading opened" : "Share trading closed");
      onDone();
    },
    onError: (e) => notify.error("Could not change trading", e.message),
  });
  const issue = api.exchange.issueShares.useMutation({
    onSuccess: () => {
      notify.success("Shares on sale", "The new issue is listed on the share market");
      setRawShares("");
      rotateIssue();
      onDone();
    },
    onError: (e) => notify.error("Could not issue shares", e.message),
  });
  const pay = api.exchange.declareDividend.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Dividend paid",
        `${formatSovereigns(r.paid)} to ${r.holderCount} shareholder${r.holderCount === 1 ? "" : "s"}`
      );
      setRawDividend("");
      rotateDividend();
      onDone();
    },
    onError: (e) => notify.error("Could not pay the dividend", e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`trading-${company.id}`}>Share trading open</Label>
        <Switch
          id={`trading-${company.id}`}
          checked={company.tradingOpen}
          disabled={trading.isPending || company.status !== "ACTIVE"}
          onCheckedChange={(open) => trading.mutate({ companyId: company.id, open })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Input
            aria-label={`New shares for ${company.name}`}
            inputMode="numeric"
            value={rawShares}
            onChange={(e) => setRawShares(digits(e.target.value))}
            placeholder="Shares"
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={
            issue.isPending ||
            company.status !== "ACTIVE" ||
            !company.tradingOpen ||
            Number.isNaN(shares)
          }
          onClick={() => issue.mutate({ companyId: company.id, shares, requestId: issueId })}
        >
          Issue at {formatSovereigns(price)} each
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Input
            aria-label={`Dividend from ${company.name}`}
            inputMode="numeric"
            value={rawDividend}
            onChange={(e) => setRawDividend(digits(e.target.value))}
            placeholder="Amount"
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={pay.isPending || company.status !== "ACTIVE" || Number.isNaN(dividend)}
          onClick={() =>
            pay.mutate({ companyId: company.id, amount: dividend, requestId: dividendId })
          }
        >
          Pay dividend
        </Button>
      </div>
      <p className="text-caption text-label-secondary tabular-nums">
        {company.sharesOutstanding.toLocaleString("en-US")} shares outstanding. Dividends come from
        capital, split by shares held. Once other players hold shares, capital leaves only as
        dividends.
      </p>
    </div>
  );
}

function CreditLineControls({
  company,
  hqInterestRate,
  onDone,
}: {
  company: Company;
  hqInterestRate: number | null;
  onDone: () => void;
}) {
  const notify = useNotify();
  const [rawCredit, setRawCredit] = useState("");
  const [borrowId, rotateBorrow] = useRequestId();
  const [repayId, rotateRepay] = useRequestId();
  const amount = parseDecimalAmount(rawCredit);
  const limit = creditLimitFor(company);
  const available = Math.max(0, Math.round((limit - company.creditDrawn) * 100) / 100);
  const rate = borrowRateOf(hqInterestRate, company.creditRating);

  const borrow = api.exchange.borrowCredit.useMutation({
    onSuccess: (r) => {
      notify.success("Credit drawn", `Drawn ${formatSovereigns(r.creditDrawn)} total`);
      setRawCredit("");
      rotateBorrow();
      onDone();
    },
    onError: (e) => notify.error("Could not borrow", e.message),
  });
  const repay = api.exchange.repayCredit.useMutation({
    onSuccess: (r) => {
      notify.success(
        r.cured ? "Credit repaid and distress cured" : "Credit repaid",
        `Remaining debt ${formatSovereigns(r.creditDrawn)}`
      );
      setRawCredit("");
      rotateRepay();
      onDone();
    },
    onError: (e) => notify.error("Could not repay", e.message),
  });

  if (!company.hqCountryId) {
    return (
      <div className="border-separator space-y-1 border-t pt-3">
        <p className="text-footnote text-label font-medium">Central Bank credit line</p>
        <p className="text-caption text-label-secondary">
          Only companies domiciled in a nation can draw on a Central Bank credit line.
        </p>
      </div>
    );
  }

  const busy = borrow.isPending || repay.isPending;

  return (
    <div className="border-separator space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-footnote text-label font-medium">Central Bank credit line</p>
        <span className="text-caption text-label-secondary tabular-nums">
          Drawn {formatSovereigns(company.creditDrawn)} of {formatSovereigns(limit)} limit ·{" "}
          {(rate * 100).toFixed(1)}% annual rate
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Input
            aria-label={`Credit amount for ${company.name}`}
            inputMode="decimal"
            value={rawCredit}
            onChange={(e) => setRawCredit(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Amount"
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={
            busy ||
            company.status !== "ACTIVE" ||
            Number.isNaN(amount) ||
            amount > available ||
            available <= 0
          }
          onClick={() => borrow.mutate({ companyId: company.id, amount, requestId: borrowId })}
        >
          Borrow
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || Number.isNaN(amount) || company.creditDrawn <= 0}
          onClick={() =>
            repay.mutate({
              companyId: company.id,
              amount: Math.min(amount, company.creditDrawn),
              requestId: repayId,
            })
          }
        >
          Repay
        </Button>
      </div>
      <p className="text-caption text-label-secondary tabular-nums">
        Available to draw: {formatSovereigns(available)}. Credit is funded by your domicile nation
        treasury against 50% of productive plant plus 12.5% of completed contracts.
      </p>
    </div>
  );
}

function DecisionControls({
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
    sector: defaultNextSector,
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
        <Button size="sm" variant="secondary" disabled={submit.isPending || !ready} onClick={handleQueue}>
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

/** Founder controls for an operating company: shares, dividends, credit line and strategy. */
export function CompanyControls({
  company,
  hqInterestRate = null,
  acquireTargets = [],
  onDone,
}: {
  company: Company;
  hqInterestRate?: number | null;
  acquireTargets?: ReadonlyArray<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Shares, credit and strategy
      </Button>
    );
  }
  return (
    <div className="border-separator rounded-control space-y-4 border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote text-label font-medium">Shares, credit and strategy</p>
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <SharesControls company={company} onDone={onDone} />
      <CreditLineControls company={company} hqInterestRate={hqInterestRate} onDone={onDone} />
      <DecisionControls company={company} acquireTargets={acquireTargets} onDone={onDone} />
    </div>
  );
}
