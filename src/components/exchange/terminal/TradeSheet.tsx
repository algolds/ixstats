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
import type { FundOrder } from "~/lib/exchange/fund";

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

/** One attempt's request id, owned by the sheet so switching "Trade as" can start a new attempt. */
interface Request {
  id: string;
  rotate: () => void;
}

/** A failed mutation's message, only while it belongs to the attempt now on screen. */
function errorOf(
  mutation: { error: { message: string } | null; variables?: { requestId?: string } },
  requestId: string
): string | null {
  return mutation.error && mutation.variables?.requestId === requestId
    ? mutation.error.message
    : null;
}

interface FormProps {
  unit: { buy: string; sell: string };
  estimate: (side: Side, amount: number) => string;
  canSubmit?: (side: Side) => boolean;
  unavailableReason?: (side: Side) => string | null;
  run: Run;
  pending: boolean;
  error: string | null;
  request: Request;
}

/** Side and amount in, one request id per attempt: kept on a retry, replaced after a success. */
function TradeForm({
  unit,
  estimate,
  canSubmit,
  unavailableReason,
  run,
  pending,
  error,
  request,
}: FormProps) {
  const [side, setSide] = useState<Side>("buy");
  const [raw, setRaw] = useState("");
  const amount = Number(raw);
  const allowed = canSubmit ? canSubmit(side) : true;
  const blockedMessage = unavailableReason?.(side) ?? null;
  const valid = allowed && Number.isFinite(amount) && amount > 0;
  const submit = () =>
    run(side, amount, request.id, () => {
      request.rotate();
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
          disabled={!allowed}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={unit[side]}
        />
        <p className="text-footnote text-label-secondary tabular-nums">
          {blockedMessage ? blockedMessage : valid ? estimate(side, amount) : unit[side]}
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

/**
 * Trading as the treasury: the same form, sent as one wealth-fund order (fundTrade) when a nation is chosen, else the
 * player's own run.
 */
function useFundRun(
  fundCountryId: string | undefined,
  orderOf: (side: Side, amount: number) => FundOrder,
  own: { run: Run; pending: boolean; error: string | null },
  requestId: string
) {
  const done = useDone();
  const fund = api.exchange.fundTrade.useMutation({ onSuccess: done });
  if (!fundCountryId) return own;
  const run: Run = (side, amount, requestId, onSuccess) =>
    fund.mutate(
      { countryId: fundCountryId, order: orderOf(side, amount), requestId },
      { onSuccess }
    );
  return { run, pending: fund.isPending, error: errorOf(fund, requestId) };
}

function ShareTrade({
  i,
  fundCountryId,
  request,
}: {
  i: Extract<TradeInstrument, { kind: "share" }>;
  fundCountryId?: string;
  request: Request;
}) {
  const done = useDone();
  const buy = api.exchange.placeBuyOrder.useMutation({ onSuccess: done });
  const sell = api.exchange.listShares.useMutation({ onSuccess: done });
  const buyAt = round2(i.bestAsk ?? i.price);
  const sellAt = round2(i.bestBid ?? i.price);
  const ownRun: Run = (side, shares, requestId, onSuccess) =>
    side === "buy"
      ? buy.mutate(
          { companyId: i.companyId, shares, maxPricePerShare: buyAt, requestId },
          { onSuccess }
        )
      : sell.mutate(
          { companyId: i.companyId, shares, pricePerShare: sellAt, requestId },
          { onSuccess }
        );
  const { run, pending, error } = useFundRun(
    fundCountryId,
    (side, shares) =>
      side === "buy"
        ? { kind: "shares-buy", companyId: i.companyId, shares, maxPricePerShare: buyAt }
        : { kind: "shares-sell", companyId: i.companyId, shares, pricePerShare: sellAt },
    {
      run: ownRun,
      pending: buy.isPending || sell.isPending,
      error: errorOf(buy, request.id) ?? errorOf(sell, request.id),
    },
    request.id
  );
  return (
    <TradeForm
      unit={{ buy: "Shares to buy", sell: "Shares to sell" }}
      estimate={(side, n) =>
        `${n} shares at ₷${formatSovereignFigure(side === "buy" ? buyAt : sellAt)}: about ₷${formatSovereignFigure(n * (side === "buy" ? buyAt : sellAt))}${side === "sell" ? ", before capital gains tax" : ""}`
      }
      run={run}
      pending={pending}
      error={error}
      request={request}
    />
  );
}

function BondTrade({
  i,
  fundCountryId,
  request,
}: {
  i: Extract<TradeInstrument, { kind: "bond" }>;
  fundCountryId?: string;
  request: Request;
}) {
  const done = useDone();
  const primary = api.exchange.buyBondPrimary.useMutation({ onSuccess: done });
  const take = api.exchange.buyBondListing.useMutation({ onSuccess: done });
  const list = api.exchange.listBondUnits.useMutation({ onSuccess: done });
  const canBuy = i.unitsLeft > 0 || i.cheapestListing !== null;
  const buyAt = i.unitsLeft > 0 ? i.faceValue : (i.cheapestListing?.pricePerUnit ?? i.price);
  const ownRun: Run = (side, units, requestId, onSuccess) => {
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
  const { run, pending, error } = useFundRun(
    fundCountryId,
    (side, units) =>
      side === "buy"
        ? { kind: "bond-buy", bondId: i.bondId, units }
        : { kind: "bond-sell", bondId: i.bondId, units, pricePerUnit: round2(i.price) },
    {
      run: ownRun,
      pending: primary.isPending || take.isPending || list.isPending,
      error: errorOf(primary, request.id) ?? errorOf(take, request.id) ?? errorOf(list, request.id),
    },
    request.id
  );
  return (
    <TradeForm
      unit={{ buy: "Units to buy", sell: "Units to list for sale" }}
      canSubmit={(side) => side === "sell" || canBuy}
      unavailableReason={(side) =>
        side === "buy" && !canBuy ? "No units available to buy right now" : null
      }
      estimate={(side, n) =>
        side === "buy"
          ? `${n} units at ₷${formatSovereignFigure(buyAt)}: ₷${formatSovereignFigure(n * buyAt)}`
          : `${n} units listed at ₷${formatSovereignFigure(i.price)}`
      }
      run={run}
      pending={pending}
      error={error}
      request={request}
    />
  );
}

function FundTrade({
  i,
  fundCountryId,
  request,
}: {
  i: Extract<TradeInstrument, { kind: "fund" }>;
  fundCountryId?: string;
  request: Request;
}) {
  const done = useDone();
  const buy = api.exchange.buySectorUnits.useMutation({ onSuccess: done });
  const sell = api.exchange.sellSectorUnits.useMutation({ onSuccess: done });
  const ownRun: Run = (side, n, requestId, onSuccess) =>
    side === "buy"
      ? buy.mutate(
          { realmId: i.realmId, sectorKey: i.sectorKey, amount: Math.round(n), requestId },
          { onSuccess }
        )
      : sell.mutate(
          { realmId: i.realmId, sectorKey: i.sectorKey, fraction: Math.min(1, n / 100), requestId },
          { onSuccess }
        );
  const { run, pending, error } = useFundRun(
    fundCountryId,
    (side, n) =>
      side === "buy"
        ? { kind: "fund-buy", sectorKey: i.sectorKey, amount: Math.round(n) }
        : { kind: "fund-sell", sectorKey: i.sectorKey, fraction: Math.min(1, n / 100) },
    {
      run: ownRun,
      pending: buy.isPending || sell.isPending,
      error: errorOf(buy, request.id) ?? errorOf(sell, request.id),
    },
    request.id
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
      pending={pending}
      error={error}
      request={request}
    />
  );
}

/** The Robinhood part: a sheet to buy or sell one instrument. Signed out, a way to sign in. */
export function TradeSheet({
  instrument,
  open,
  onOpenChange,
  treasury,
}: {
  instrument: TradeInstrument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A nation the viewer can trade for (its wealth fund): adds the "Trade as" switch. */
  treasury?: { countryId: string; name: string };
}) {
  const { isSignedIn } = useAuth();
  const signInHref = useSignInHref();
  const [actor, setActor] = useState<"you" | "treasury">("you");
  const [requestId, rotate] = useRequestId();
  const request = { id: requestId, rotate };
  const fundCountryId = treasury && actor === "treasury" ? treasury.countryId : undefined;
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
        ) : (
          <>
            {treasury && (
              <div className="px-4 pt-4">
                <SegmentedControl
                  fullWidth
                  size="sm"
                  aria-label="Trade as"
                  value={actor}
                  onValueChange={(next) => {
                    setActor(next);
                    // Another actor is a new attempt: it must not reuse the last one's request id or error.
                    rotate();
                  }}
                  options={[
                    { value: "you", label: "You" },
                    { value: "treasury", label: `${treasury.name} Treasury` },
                  ]}
                />
              </div>
            )}
            {instrument.kind === "share" ? (
              <ShareTrade i={instrument} fundCountryId={fundCountryId} request={request} />
            ) : instrument.kind === "bond" ? (
              <BondTrade i={instrument} fundCountryId={fundCountryId} request={request} />
            ) : (
              <FundTrade i={instrument} fundCountryId={fundCountryId} request={request} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A Trade pill that opens the sheet. */
export function TradeButton({
  instrument,
  label = "Trade",
  tone = "tint",
  treasury,
}: {
  instrument: TradeInstrument;
  label?: string;
  tone?: "tint" | "plain";
  treasury?: { countryId: string; name: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pill tone={tone} onClick={() => setOpen(true)}>
        {label}
      </Pill>
      <TradeSheet instrument={instrument} open={open} onOpenChange={setOpen} treasury={treasury} />
    </>
  );
}
