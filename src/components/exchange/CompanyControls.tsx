"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { CompanyDecisionControls } from "./CompanyDecisionControls";
import { CompanyPressControls } from "./CompanyPressControls";
import {
  borrowRateOf,
  creditLimitFor,
  formatSovereigns,
  parseAmount,
  parseDecimalAmount,
  useRequestId,
} from "./shared";

type Company = RouterOutputs["exchange"]["getOverview"]["companies"][number];

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
  lending,
  onDone,
}: {
  company: Company;
  hqInterestRate: number | null;
  /** The home treasury's lending terms (extra spread and per-company cap). */
  lending?: { spread: number; cap: number };
  onDone: () => void;
}) {
  const notify = useNotify();
  const [rawCredit, setRawCredit] = useState("");
  const [borrowId, rotateBorrow] = useRequestId();
  const [repayId, rotateRepay] = useRequestId();
  const amount = parseDecimalAmount(rawCredit);
  const limit = creditLimitFor(company, lending?.cap);
  const available = Math.max(0, Math.round((limit - company.creditDrawn) * 100) / 100);
  const rate = borrowRateOf(hqInterestRate, company.creditRating, lending?.spread);

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

/** Founder controls for an operating company: shares, dividends, credit line, press account and strategy. */
export function CompanyControls({
  company,
  hqInterestRate = null,
  lending,
  acquireTargets = [],
  onDone,
}: {
  company: Company;
  hqInterestRate?: number | null;
  lending?: { spread: number; cap: number };
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
    <Card variant="well" padding="md" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote text-label font-medium">Shares, credit and strategy</p>
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <SharesControls company={company} onDone={onDone} />
      <CreditLineControls
        company={company}
        hqInterestRate={hqInterestRate}
        lending={lending}
        onDone={onDone}
      />
      <CompanyPressControls company={company} onDone={onDone} />
      <CompanyDecisionControls company={company} acquireTargets={acquireTargets} onDone={onDone} />
    </Card>
  );
}
