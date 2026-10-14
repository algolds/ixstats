"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Switch } from "~/components/ui/switch";
import {
  SectorSelect,
  formatSovereigns,
  parseAmount,
  sectorLabel,
  useRequestId,
  type Sector,
} from "./shared";

type Company = RouterOutputs["exchange"]["getOverview"]["companies"][number];
type DecisionKind = "EXPAND" | "ENTER_SECTOR";

/** The cost of entering a new sector (decisions.ts ENTER_SECTOR_COST). */
const ENTER_SECTOR_COST = 500;

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
          disabled={trading.isPending}
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
          disabled={issue.isPending || !company.tradingOpen || Number.isNaN(shares)}
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
          disabled={pay.isPending || Number.isNaN(dividend)}
          onClick={() =>
            pay.mutate({ companyId: company.id, amount: dividend, requestId: dividendId })
          }
        >
          Pay dividend
        </Button>
      </div>
      <p className="text-caption text-label-secondary">
        {company.sharesOutstanding.toLocaleString("en-US")} shares outstanding. Dividends come from
        capital, split by shares held. Once other players hold shares, capital leaves only as
        dividends.
      </p>
    </div>
  );
}

function DecisionControls({ company, onDone }: { company: Company; onDone: () => void }) {
  const notify = useNotify();
  const [kind, setKind] = useState<DecisionKind>("EXPAND");
  const [rawAmount, setRawAmount] = useState("");
  const [sector, setSector] = useState<Sector>(
    company.sectorKey === "services" ? "industry" : "services"
  );
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(rawAmount);
  const record = api.exchange.getCompanyRecord.useQuery({ companyId: company.id });
  const pending = record.data?.decisions.find((d) => d.appliedIxTime === null);

  const submit = api.exchange.submitDecision.useMutation({
    onSuccess: () => {
      notify.success("Decision queued", "It takes effect after a day");
      setRawAmount("");
      rotate();
      void record.refetch();
      onDone();
    },
    onError: (e) => notify.error("Could not queue the decision", e.message),
  });

  if (pending) {
    return (
      <p className="text-footnote text-label-secondary">
        Pending: {pending.type === "EXPAND" ? "an expansion" : "a move to a new sector"}, applied by
        the next market update a day after it was queued.
      </p>
    );
  }

  const ready = kind === "EXPAND" ? amount >= 100 : sector !== company.sectorKey;
  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Decision"
        size="sm"
        value={kind}
        onValueChange={(v) => setKind(v as DecisionKind)}
        options={[
          { value: "EXPAND", label: "Expand" },
          { value: "ENTER_SECTOR", label: "Enter a sector" },
        ]}
      />
      <div className="flex flex-wrap items-end gap-2">
        {kind === "EXPAND" ? (
          <div className="w-32">
            <Input
              aria-label={`Invest in ${company.name}`}
              inputMode="numeric"
              value={rawAmount}
              onChange={(e) => setRawAmount(digits(e.target.value))}
              placeholder="Amount"
            />
          </div>
        ) : (
          <div className="w-40">
            <SectorSelect
              id={`decision-sector-${company.id}`}
              value={sector}
              onChange={setSector}
            />
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={submit.isPending || !ready}
          onClick={() =>
            submit.mutate(
              kind === "EXPAND"
                ? { companyId: company.id, type: kind, amount, requestId }
                : { companyId: company.id, type: kind, sectorKey: sector, requestId }
            )
          }
        >
          {kind === "EXPAND" ? "Invest" : `Move for ${formatSovereigns(ENTER_SECTOR_COST)}`}
        </Button>
      </div>
      <p className="text-caption text-label-secondary">
        {kind === "EXPAND"
          ? "Turns capital into plant: it leaves capital now and adds the same to fair value after a day."
          : `Moves ${company.name} out of ${sectorLabel(company.sectorKey)}; its fair value then follows the new sector's index.`}
      </p>
    </div>
  );
}

/** Founder controls for an ACTIVE company: shares, dividends and strategy. */
export function CompanyControls({ company, onDone }: { company: Company; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Shares and strategy
      </Button>
    );
  }
  return (
    <div className="border-separator rounded-control space-y-4 border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote text-label font-medium">Shares and strategy</p>
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <SharesControls company={company} onDone={onDone} />
      <DecisionControls company={company} onDone={onDone} />
    </div>
  );
}
