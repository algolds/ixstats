"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { bondHref, nationHref } from "~/lib/exchange/routes";
import { useRequestId } from "../shared";
import { Figure, Pill, SectionTitle, formatSovereignFigure } from "./brand";
import { SignInPrompt } from "./SignInPrompt";
import { TreasuryFund } from "./TreasuryFund";
import { TreasuryLending } from "./TreasuryLending";
import { EXCHANGE_PATHS } from "~/lib/exchange/routes";

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

/** Units, coupon and term in; a preview of what it raises and costs each week. */
function IssueBondForm({ countryId }: { countryId: string }) {
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
    <Card content="input" padding="md" className="space-y-3">
      <SectionTitle>Issue bonds</SectionTitle>
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
        <Field id="bond-term" label="Term (weeks)" value={term} onChange={setTerm} hint="1 to 12" />
      </div>
      {valid && (
        <p className="text-footnote text-label-secondary">
          Raises up to {sov(u * FACE)}. Coupons cost about {sov((u * FACE * c * 7) / 365)} a week,
          and the principal is due in week {t}.
        </p>
      )}
      {issue.error && <p className="text-footnote text-destructive">{issue.error.message}</p>}
      <Pill disabled={!valid || issue.isPending} onClick={submit}>
        Issue bonds
      </Pill>
    </Card>
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
  return (
    <div className="space-y-4">
      <Card content="data" padding="lg" className="space-y-1">
        <p className="text-footnote text-label-secondary">
          <Link href={nationHref(nation.id)} className="hover:text-tint">
            {nation.name}
          </Link>{" "}
          treasury
        </p>
        <Figure size="hero" value={sov(page.data?.treasury.balance ?? 0)} />
        <p className="text-footnote text-label-secondary">
          Cap {sov(page.data?.treasury.cap ?? 0)} · rating {page.data?.rating ?? "·"}
        </p>
        {page.data && (
          <p className="text-footnote text-label-secondary">
            Earned so far: stipend {sov(page.data.treasury.lifetimeStipend)}, tax{" "}
            {sov(page.data.treasury.lifetimeTaxEarned)}, tariffs{" "}
            {sov(page.data.treasury.lifetimeTariffEarned)}, interest{" "}
            {sov(page.data.treasury.lifetimeInterestEarned)}.{" "}
            <Link href={EXCHANGE_PATHS.tenders} className="text-tint">
              Post a tender
            </Link>
          </p>
        )}
      </Card>
      <TreasuryFund countryId={nation.id} />
      <IssueBondForm countryId={nation.id} />
      <Card content="data" padding="md" className="space-y-2">
        <SectionTitle>Your bonds</SectionTitle>
        {(page.data?.bonds ?? []).length === 0 ? (
          <p className="text-footnote text-label-secondary">No bonds issued yet.</p>
        ) : (
          <ul className="text-footnote divide-separator divide-y">
            {page.data!.bonds.map((b) => (
              <li key={b.bondId}>
                <Link
                  href={bondHref(b.bondId)}
                  className="hover:text-tint flex justify-between py-1.5"
                >
                  <span>
                    {b.termWeeks}-week · {(b.couponRate * 100).toFixed(2)}% ·{" "}
                    {b.status.toLowerCase()}
                  </span>
                  <span className="tabular-nums">
                    {b.unitsSold} of {b.unitsIssued} sold
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {terms && (
        <TreasuryLending
          countryId={nation.id}
          spread={terms.lendingSpread}
          cap={terms.companyCreditCap}
        />
      )}
    </div>
  );
}
