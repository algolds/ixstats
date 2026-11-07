"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { round2 } from "~/lib/exchange/amounts";
import type { SectorKey } from "~/lib/exchange/companies";
import { useRequestId } from "../shared";
import { Pill, formatSovereignFigure } from "./brand";
import { useSignInHref } from "./useSignInHref";

export type TradeInstrument =
  | {
      kind: "share";
      companyId: string;
      name: string;
      price: number;
      bestAsk: number | null;
      bestBid: number | null;
    }
  | {
      kind: "bond";
      bondId: string;
      name: string;
      price: number;
      /** What a unit costs from the treasury. */
      faceValue: number;
      unitsLeft: number;
      cheapestListing: { id: string; pricePerUnit: number } | null;
    }
  | { kind: "fund"; sectorKey: SectorKey; realmId: string; name: string; price: number };

type Side = "buy" | "sell";
type Run = (side: Side, amount: number, requestId: string, onSuccess: () => void) => void;

interface FormProps {
  unit: { buy: string; sell: string };
  estimate: (side: Side, amount: number) => string;
  run: Run;
  pending: boolean;
  error: string | null;
}

/** Side and amount in, one request id per attempt: kept on a retry, replaced after a success. */
function TradeForm({ unit, estimate, run, pending, error }: FormProps) {
  const [side, setSide] = useState<Side>("buy");
  const [raw, setRaw] = useState("");
  const [requestId, rotate] = useRequestId();
  const amount = Number(raw);
  const valid = Number.isFinite(amount) && amount > 0;
  const submit = () =>
    run(side, amount, requestId, () => {
      rotate();
      setRaw("");
    });
  return (
    <div className="space-y-4 p-4">
      <SegmentedControl
        fullWidth
        aria-label="Buy or sell"
        value={side}
        onValueChange={setSide}
        options={[
          { value: "buy", label: "Buy" },
          { value: "sell", label: "Sell" },
        ]}
      />
      <div className="space-y-1.5">
        <Label htmlFor="trade-amount">Amount</Label>
        <Input
          id="trade-amount"
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={unit[side]}
        />
        <p className="text-footnote text-label-secondary">
          {valid ? estimate(side, amount) : unit[side]}
        </p>
      </div>
      {error && <p className="text-footnote text-destructive">{error}</p>}
      <Button className="w-full rounded-full" disabled={!valid || pending} onClick={submit}>
        Confirm
      </Button>
    </div>
  );
}

function useDone() {
  const utils = api.useUtils();
  return () => void utils.exchange.invalidate();
}

function ShareTrade({ i }: { i: Extract<TradeInstrument, { kind: "share" }> }) {
  const done = useDone();
  const buy = api.exchange.placeBuyOrder.useMutation({ onSuccess: done });
  const sell = api.exchange.listShares.useMutation({ onSuccess: done });
  const buyAt = round2(i.bestAsk ?? i.price);
  const sellAt = round2(i.bestBid ?? i.price);
  const run: Run = (side, shares, requestId, onSuccess) =>
    side === "buy"
      ? buy.mutate(
          { companyId: i.companyId, shares, maxPricePerShare: buyAt, requestId },
          { onSuccess }
        )
      : sell.mutate(
          { companyId: i.companyId, shares, pricePerShare: sellAt, requestId },
          { onSuccess }
        );
  return (
    <TradeForm
      unit={{ buy: "Shares to buy", sell: "Shares to sell" }}
      estimate={(side, n) =>
        `${n} shares at ₷${formatSovereignFigure(side === "buy" ? buyAt : sellAt)}: about ₷${formatSovereignFigure(n * (side === "buy" ? buyAt : sellAt))}${side === "sell" ? ", before capital gains tax" : ""}`
      }
      run={run}
      pending={buy.isPending || sell.isPending}
      error={buy.error?.message ?? sell.error?.message ?? null}
    />
  );
}

function BondTrade({ i }: { i: Extract<TradeInstrument, { kind: "bond" }> }) {
  const done = useDone();
  const primary = api.exchange.buyBondPrimary.useMutation({ onSuccess: done });
  const take = api.exchange.buyBondListing.useMutation({ onSuccess: done });
  const list = api.exchange.listBondUnits.useMutation({ onSuccess: done });
  const buyAt = i.unitsLeft > 0 ? i.faceValue : (i.cheapestListing?.pricePerUnit ?? i.price);
  const run: Run = (side, units, requestId, onSuccess) => {
    if (side === "sell") {
      list.mutate(
        { bondId: i.bondId, units, pricePerUnit: round2(i.price), requestId },
        { onSuccess }
      );
    } else if (i.unitsLeft > 0) {
      primary.mutate({ bondId: i.bondId, units, requestId }, { onSuccess });
    } else if (i.cheapestListing) {
      take.mutate({ listingId: i.cheapestListing.id, units, requestId }, { onSuccess });
    }
  };
  return (
    <TradeForm
      unit={{ buy: "Units to buy", sell: "Units to list for sale" }}
      estimate={(side, n) =>
        side === "buy"
          ? `${n} units at ₷${formatSovereignFigure(buyAt)}: ₷${formatSovereignFigure(n * buyAt)}`
          : `${n} units listed at ₷${formatSovereignFigure(i.price)}`
      }
      run={run}
      pending={primary.isPending || take.isPending || list.isPending}
      error={primary.error?.message ?? take.error?.message ?? list.error?.message ?? null}
    />
  );
}

function FundTrade({ i }: { i: Extract<TradeInstrument, { kind: "fund" }> }) {
  const done = useDone();
  const buy = api.exchange.buySectorUnits.useMutation({ onSuccess: done });
  const sell = api.exchange.sellSectorUnits.useMutation({ onSuccess: done });
  const run: Run = (side, n, requestId, onSuccess) =>
    side === "buy"
      ? buy.mutate(
          { realmId: i.realmId, sectorKey: i.sectorKey, amount: Math.round(n), requestId },
          { onSuccess }
        )
      : sell.mutate(
          { realmId: i.realmId, sectorKey: i.sectorKey, fraction: Math.min(1, n / 100), requestId },
          { onSuccess }
        );
  return (
    <TradeForm
      unit={{ buy: "₷ to invest", sell: "Percent of your units to sell" }}
      estimate={(side, n) =>
        side === "buy"
          ? `About ${(n / i.price).toFixed(2)} units at ₷${formatSovereignFigure(i.price)}`
          : `${Math.min(100, n)}% of your units`
      }
      run={run}
      pending={buy.isPending || sell.isPending}
      error={buy.error?.message ?? sell.error?.message ?? null}
    />
  );
}

/** The Robinhood part: a sheet to buy or sell one instrument. Signed out, a way to sign in. */
export function TradeSheet({
  instrument,
  open,
  onOpenChange,
}: {
  instrument: TradeInstrument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Trade {instrument.name}</SheetTitle>
          <SheetDescription>₷{formatSovereignFigure(instrument.price)} now</SheetDescription>
        </SheetHeader>
        {!isSignedIn ? (
          <div className="space-y-3 p-4">
            <p className="text-body">Sign in to trade</p>
            <Pill asChild>
              <Link href={signInHref}>Sign in</Link>
            </Pill>
          </div>
        ) : instrument.kind === "share" ? (
          <ShareTrade i={instrument} />
        ) : instrument.kind === "bond" ? (
          <BondTrade i={instrument} />
        ) : (
          <FundTrade i={instrument} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A Trade pill that opens the sheet. */
export function TradeButton({
  instrument,
  label = "Trade",
}: {
  instrument: TradeInstrument;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pill onClick={() => setOpen(true)}>{label}</Pill>
      <TradeSheet instrument={instrument} open={open} onOpenChange={setOpen} />
    </>
  );
}
