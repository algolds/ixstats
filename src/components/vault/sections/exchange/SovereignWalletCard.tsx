"use client";

import { useState } from "react";
import { DataTransferBoth, Wallet } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Stat } from "~/components/ui/stat";
import { activitySourceLabel } from "~/lib/vault/activity-labels";
import { quoteConversion, type ConvertDirection } from "~/lib/exchange/quote";
import { Field, formatSovereigns, parseAmount, useRequestId } from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-footnote flex items-center justify-between gap-3">
      <span className="text-label-secondary">{label}</span>
      <span className="text-label font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ConvertForm({ overview, onDone }: { overview: Overview; onDone: () => void }) {
  const notify = useNotify();
  const [direction, setDirection] = useState<ConvertDirection>("CONVERT_IN");
  const [raw, setRaw] = useState("");
  const [requestId, rotate] = useRequestId();
  const amount = parseAmount(raw);
  const { conversion } = overview;
  const quote = Number.isNaN(amount)
    ? null
    : quoteConversion(direction, amount, {
        convertRate: conversion.rate,
        convertFee: conversion.fee,
      });

  const convert = api.exchange.convert.useMutation({
    onSuccess: (r) => {
      notify.success(
        "Converted",
        r.direction === "CONVERT_IN"
          ? `${r.ixCredits.toLocaleString("en-US")} IxC became ${formatSovereigns(r.sovereigns)}`
          : `${formatSovereigns(r.sovereigns)} became ${r.ixCredits.toLocaleString("en-US")} IxC`
      );
      setRaw("");
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Conversion failed", e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(amount)) return;
    convert.mutate({ direction, amount, requestId });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <SegmentedControl
        aria-label="Direction"
        size="sm"
        value={direction}
        onValueChange={(v) => setDirection(v as ConvertDirection)}
        options={[
          { value: "CONVERT_IN", label: "IxC to ₷" },
          { value: "CONVERT_OUT", label: "₷ to IxC" },
        ]}
      />
      <Field
        id="exchange-convert-amount"
        label={direction === "CONVERT_IN" ? "IxCredits to convert" : "Sovereigns to convert"}
      >
        <Input
          id="exchange-convert-amount"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="100"
        />
      </Field>
      {quote && (
        <p className="text-footnote text-label-secondary">
          {direction === "CONVERT_IN"
            ? `You get ${formatSovereigns(quote.sovereigns)} (fee ${formatSovereigns(quote.fee)})`
            : `You get ${quote.ixCredits.toLocaleString("en-US")} IxC (fee ${formatSovereigns(quote.fee)})`}
        </p>
      )}
      <Button type="submit" size="sm" disabled={!quote || convert.isPending}>
        {convert.isPending ? "Converting..." : "Convert"}
      </Button>
    </form>
  );
}

/** ₷ balance, the conversion bridge and recent ledger rows. */
export function SovereignWalletCard({
  overview,
  onChanged,
}: {
  overview: Overview;
  onChanged: () => void;
}) {
  const { conversion, wallet, transactions } = overview;
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<Wallet />}>Sovereign wallet</CardTitle>
      <Stat label="Sovereigns" value={formatSovereigns(wallet.sovereigns)} />

      <Card padding="sm" className="space-y-3">
        <CardTitle icon={<DataTransferBoth />} className="text-footnote">
          Convert
        </CardTitle>
        <div className="space-y-1">
          <Row label="Rate" value={`1 IxC = ${formatSovereigns(conversion.rate)}`} />
          <Row label="Fee" value={`${Math.round(conversion.fee * 1000) / 10}%`} />
          <Row label="Left today" value={formatSovereigns(conversion.remainingToday)} />
          <Row
            label="Convertible to IxC"
            value={formatSovereigns(conversion.convertOutAllowance)}
          />
        </div>
        {overview.isOpen && <ConvertForm overview={overview} onDone={onChanged} />}
        <p className="text-caption text-label-secondary">
          Sovereigns you converted in can go back to IxCredits
          {conversion.revenueShare > 0
            ? `, plus ${Math.round(conversion.revenueShare * 100)}% of what your companies earn on completed contracts once it is ${conversion.revenueHoldDays} days old.`
            : "."}
        </p>
      </Card>

      {transactions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-footnote text-label font-medium">Recent activity</h3>
          <ul className="space-y-1">
            {transactions.map((t) => (
              <li key={t.id} className="text-footnote flex items-center justify-between gap-3">
                <span className="text-label-secondary truncate">
                  {activitySourceLabel(t.source.split(":")[0] ?? t.source)}
                </span>
                <span
                  className={
                    t.sovereigns >= 0
                      ? "text-success font-medium tabular-nums"
                      : "text-label font-medium tabular-nums"
                  }
                >
                  {t.sovereigns >= 0 ? "+" : ""}
                  {formatSovereigns(t.sovereigns)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
