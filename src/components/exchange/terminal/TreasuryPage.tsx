"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Coins, Crown, Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { EXCHANGE_PATHS, bondHref, nationHref } from "~/lib/exchange/routes";
import { CreditRatingBadge, useRequestId } from "../shared";
import {
  DATA_ROW_LINK,
  ExchangeIconWell,
  Figure,
  Pill,
  SectionTitle,
  TickerTile,
  bondStatusLabel,
  formatSovereignFigure,
} from "./brand";
import { SignInPrompt } from "./SignInPrompt";
import { TreasuryFund } from "./TreasuryFund";
import { TreasuryLending } from "./TreasuryLending";

const sov = (n: number) => `₷${formatSovereignFigure(n)}`;
const FACE = 100;

function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-caption text-label-secondary">{hint}</p>
    </div>
  );
}

/** Unified Sovereign Bonds card: active bond issues and primary issuance form in one card. */
function SovereignBondsCard({
  countryId,
  bonds,
}: {
  countryId: string;
  bonds: ReadonlyArray<{
    bondId: string;
    termWeeks: number;
    couponRate: number;
    status: string;
    unitsSold: number;
    unitsIssued: number;
  }>;
}) {
  const [units, setUnits] = useState("");
  const [coupon, setCoupon] = useState("");
  const [term, setTerm] = useState("");
  const [requestId, rotate] = useRequestId();
  const utils = api.useUtils();
  const issue = api.exchange.issueBond.useMutation();
  const u = Number(units);
  const c = Number(coupon) / 100;
  const t = Number(term);
  const valid =
    Number.isInteger(u) &&
    u >= 10 &&
    u <= 10_000 &&
    c >= 0.005 &&
    c <= 0.25 &&
    Number.isInteger(t) &&
    t >= 1 &&
    t <= 12;
  const submit = () =>
    issue.mutate(
      { countryId, units: u, couponRate: c, termWeeks: t, requestId },
      {
        onSuccess: () => {
          rotate();
          setUnits("");
          setCoupon("");
          setTerm("");
          void utils.exchange.invalidate();
        },
      }
    );
  return (
    <LensCard app="exchange" content="input" padding="md" className="space-y-4">
      <div className="space-y-2.5">
        <SectionTitle icon={<Coins />}>Issue bonds</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            id="bond-units"
            label="Units"
            value={units}
            onChange={setUnits}
            hint="10 to 10,000, ₷100 each"
          />
          <Field
            id="bond-coupon"
            label="Coupon (%)"
            value={coupon}
            onChange={setCoupon}
            hint="0.5 to 25, a year"
          />
          <Field
            id="bond-term"
            label="Term (weeks)"
            value={term}
            onChange={setTerm}
            hint="1 to 12"
          />
        </div>
        {valid && (
          <p className="facet-well rounded-control text-footnote text-label-secondary px-3 py-2">
            Raises up to {sov(u * FACE)}. Coupons cost about {sov((u * FACE * c * 7) / 365)} a week,
            and the principal is due in week {t}.
          </p>
        )}
        {issue.error && <p className="text-footnote text-destructive">{issue.error.message}</p>}
        <Pill disabled={!valid || issue.isPending} onClick={submit}>
          Issue bonds
        </Pill>
      </div>

      <div className="border-separator space-y-2 border-t pt-3.5">
        <p className="text-footnote text-label font-semibold">Your bonds</p>
        {bonds.length === 0 ? (
          <p className="text-footnote text-label-secondary py-1">No bonds issued yet.</p>
        ) : (
          <ul className="divide-separator divide-y">
            {bonds.map((b) => (
              <li key={b.bondId}>
                <Link href={bondHref(b.bondId)} data-row className={DATA_ROW_LINK}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TickerTile code={`${b.termWeeks}W`} tone="neutral" />
                    <span className="truncate font-medium">
                      {b.termWeeks}-week · {(b.couponRate * 100).toFixed(2)}% ·{" "}
                      {bondStatusLabel(b.status)}
                    </span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {b.unitsSold} of {b.unitsIssued} sold
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </LensCard>
  );
}

/** The nation owner's desk: the treasury, its wealth fund, its bonds and its lending terms. */
export function TreasuryPage({ realmId }: { realmId: string }) {
  const { isSignedIn } = useAuth();
  const overview = api.exchange.getOverview.useQuery({ realmId }, { enabled: !!isSignedIn });
  const nation = overview.data?.nations.find((n) => n.realmId === realmId) ?? null;
  const terms = overview.data?.realmNations.find((n) => n.id === nation?.id);
  const page = api.exchange.nationPage.useQuery(
    { countryId: nation?.id ?? "" },
    { enabled: !!nation }
  );
  if (!isSignedIn)
    return <SignInPrompt title="Treasury" message="Sign in to run your nation's treasury." />;
  if (overview.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!nation)
    return <EmptyState title="Treasury" message="The Treasury is for a nation's owner." />;

  const balance = page.data?.treasury.balance ?? 0;
  const cap = page.data?.treasury.cap ?? 0;
  const fillPct = cap > 0 ? Math.min(100, Math.round((balance / cap) * 100)) : 0;

  return (
    <div className="space-y-4">
      <LensCard app="exchange" content="data" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ExchangeIconWell size="sm">
                <Crown />
              </ExchangeIconWell>
              <p className="text-footnote text-label-secondary font-medium">
                <Link href={nationHref(nation.id)} className="hover:text-tint transition-colors">
                  {nation.name}
                </Link>{" "}
                treasury
              </p>
              {page.data?.rating && <CreditRatingBadge rating={page.data.rating} />}
            </div>
            <Figure size="hero" value={sov(balance)} />
            <p className="text-footnote text-label-secondary">
              Cap {sov(cap)} · rating {page.data?.rating ?? "–"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={EXCHANGE_PATHS.portfolio}>
                <Wallet className="text-tint" />
                <span>Personal portfolio</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={EXCHANGE_PATHS.tenders}>Post a tender</Link>
            </Button>
          </div>
        </div>
        {cap > 0 && (
          <div className="space-y-1">
            <div className="text-caption text-label-secondary flex items-center justify-between font-mono tabular-nums">
              <span>Reserve capacity</span>
              <span>{fillPct}% utilized</span>
            </div>
            <div className="facet-recess h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-tint h-full rounded-full transition-[width] duration-fast ease-out-facet"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}
        {page.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card variant="well" padding="sm">
              <Stat size="sm" label="Stipend earned" value={sov(page.data.treasury.lifetimeStipend)} />
            </Card>
            <Card variant="well" padding="sm">
              <Stat size="sm" label="Tax collected" value={sov(page.data.treasury.lifetimeTaxEarned)} />
            </Card>
            <Card variant="well" padding="sm">
              <Stat size="sm" label="Tariffs earned" value={sov(page.data.treasury.lifetimeTariffEarned)} />
            </Card>
            <Card variant="well" padding="sm">
              <Stat size="sm" label="Interest earned" value={sov(page.data.treasury.lifetimeInterestEarned)} />
            </Card>
          </div>
        )}
      </LensCard>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TreasuryFund countryId={nation.id} />
        <div className="space-y-4">
          <SovereignBondsCard countryId={nation.id} bonds={page.data?.bonds ?? []} />
          {terms && (
            <TreasuryLending
              countryId={nation.id}
              spread={terms.lendingSpread}
              cap={terms.companyCreditCap}
            />
          )}
        </div>
      </div>
    </div>
  );
}
