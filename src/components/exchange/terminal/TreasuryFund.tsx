"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { bondHref, companyHref } from "~/lib/exchange/routes";
import type { Portfolio } from "~/lib/exchange/terminal-valuation";
import { useRequestId } from "../shared";
import {
  DATA_ROW_ITEM,
  DATA_ROW_LINK,
  Figure,
  Pill,
  SectionTitle,
  formatSovereignFigure,
} from "./brand";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;

/** A wealth fund's holdings as links (Treasury and the public nation page share it). */
export function FundHoldings({ portfolio }: { portfolio: Portfolio }) {
  const rows = [
    ...portfolio.shares.map((s) => ({
      key: `s:${s.companyId}`,
      href: companyHref(s.companyId),
      label: `${s.name} · ${s.shares} shares`,
      value: s.value,
    })),
    ...portfolio.bonds.map((b) => ({
      key: `b:${b.bondId}`,
      href: bondHref(b.bondId),
      label: `${b.name} · ${b.units}`,
      value: b.value,
    })),
    ...portfolio.funds.map((f) => ({
      key: `f:${f.sectorKey}`,
      href: null,
      label: `${f.name} · ${f.units.toFixed(2)} units`,
      value: f.value,
    })),
  ];
  if (rows.length === 0)
    return <p className="text-footnote text-label-secondary">No holdings yet.</p>;
  return (
    <ul className="divide-separator divide-y">
      {rows.map((r) => (
        <li key={r.key}>
          {r.href ? (
            <Link href={r.href} data-row className={DATA_ROW_LINK}>
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums">{sov(r.value)}</span>
            </Link>
          ) : (
            <div data-row className={DATA_ROW_ITEM}>
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums">{sov(r.value)}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The wealth fund: its cash, what it may still take in, moving ₷ in and out, and what it holds. */
export function TreasuryFund({ countryId }: { countryId: string }) {
  const summary = api.exchange.fundSummary.useQuery({ countryId });
  const [raw, setRaw] = useState("");
  const [requestId, rotate] = useRequestId();
  const utils = api.useUtils();
  const done = {
    onSuccess: () => {
      rotate();
      setRaw("");
      void utils.exchange.invalidate();
    },
  };
  const deposit = api.exchange.depositToFund.useMutation();
  const withdraw = api.exchange.withdrawFromFund.useMutation();
  const amount = Number(raw);
  const valid = Number.isFinite(amount) && amount > 0;
  const s = summary.data;
  const error = deposit.error?.message ?? withdraw.error?.message;
  return (
    <Card content="input" padding="md" className="space-y-3">
      <SectionTitle icon={<Wallet />}>Wealth fund</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card variant="well" padding="sm">
          <p className="text-caption text-label-secondary">Cash</p>
          <Figure value={sov(s?.cash ?? 0)} />
        </Card>
        <Card variant="well" padding="sm">
          <p className="text-caption text-label-secondary">Invested at cost</p>
          <Figure value={sov(s?.invested ?? 0)} />
        </Card>
        <Card variant="well" padding="sm">
          <p className="text-caption text-label-secondary">Room to add</p>
          <Figure value={s ? sov(s.room) : "–"} />
        </Card>
      </div>
      <p className="text-footnote text-label-secondary">
        The fund may hold at most half of the treasury and fund together, at most 25% of any
        company, and never your own companies or your own bonds. Trade as the treasury from any
        company, bond or fund.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="fund-amount">Amount to move</Label>
          <Input
            id="fund-amount"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <Pill
          tone="plain"
          disabled={!valid || deposit.isPending}
          onClick={() => deposit.mutate({ countryId, amount, requestId }, done)}
        >
          Move into the fund
        </Pill>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          disabled={!valid || withdraw.isPending}
          onClick={() => withdraw.mutate({ countryId, amount, requestId }, done)}
        >
          Move back to the treasury
        </Button>
      </div>
      {error && <p className="text-footnote text-destructive">{error}</p>}
      {s && <FundHoldings portfolio={s.portfolio} />}
    </Card>
  );
}
