"use client";

import type { ReactNode } from "react";
import { Coins, GraphUp, Wallet } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Card, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

type TodayEarnings = RouterOutputs["vault"]["getTodayEarnings"];

interface TreasuryRevenue {
  dailyDividend: number;
  weeklyDividend: number;
  monthlyDividend: number;
}

interface VaultWalletCardProps {
  /** The daily reward row; the dashboard supplies it so the card stays presentational. */
  reward: ReactNode;
  credits: number | undefined;
  balanceLoading: boolean;
  todayEarnings: TodayEarnings | undefined;
  treasuryRevenue: TreasuryRevenue | null | undefined;
  /** Signed percent change of the budget bonus; undefined while it loads. */
  budgetBonusPercent: number | undefined;
}

const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

function Row({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className="text-footnote flex items-center justify-between gap-3">
      <span className={muted ? "text-label-secondary" : "text-label"}>{label}</span>
      <span
        className={cn(
          "flex items-center gap-1 font-medium tabular-nums",
          muted ? "text-label-secondary" : "text-label"
        )}
      >
        {children}
      </span>
    </div>
  );
}

function Credits({ amount, prefix = "" }: { amount: number; prefix?: string }) {
  return (
    <>
      {prefix}
      <IxCreditsSymbol decorative className="size-3 shrink-0" />
      {formatCredits(amount)}
    </>
  );
}

function EarningsRows({ earnings }: { earnings: TodayEarnings }) {
  return (
    <Card padding="sm" className="space-y-2">
      <CardTitle icon={<GraphUp />} className="text-footnote">
        Today&apos;s earnings
      </CardTitle>
      <div className="space-y-1">
        {earnings.sources.map((source) => (
          <Row key={source.type} label={source.label} muted>
            <span className="text-success">+{formatCredits(source.amount)}</span>
          </Row>
        ))}
      </div>
      <div className="border-separator border-t pt-2">
        <Row label="Total">
          <Credits amount={earnings.total} prefix="+" />
        </Row>
      </div>
    </Card>
  );
}

function BudgetBonus({ percent }: { percent: number }) {
  const tone =
    percent > 0 ? "text-success" : percent < 0 ? "text-destructive" : "text-label-secondary";
  return (
    <div className="border-separator border-t pt-2">
      <Row label="Budget bonus">
        <span className={tone}>
          {percent > 0 ? "+" : ""}
          {percent}%
        </span>
      </Row>
    </div>
  );
}

function TreasuryRows({
  revenue,
  budgetBonusPercent,
}: {
  revenue: TreasuryRevenue;
  budgetBonusPercent: number | undefined;
}) {
  return (
    <Card padding="sm" className="space-y-2">
      <CardTitle icon={<Coins />} className="text-footnote">
        Treasury revenue
      </CardTitle>
      <div className="space-y-1">
        <Row label="Daily">
          <Credits amount={revenue.dailyDividend} prefix="+" />
        </Row>
        <Row label="Weekly" muted>
          <Credits amount={revenue.weeklyDividend} prefix="~" />
        </Row>
        <Row label="Monthly" muted>
          <Credits amount={revenue.monthlyDividend} prefix="~" />
        </Row>
      </div>
      {budgetBonusPercent !== undefined && <BudgetBonus percent={budgetBonusPercent} />}
    </Card>
  );
}

/** Balance, today's earnings and treasury revenue, with the daily reward on top. */
export function VaultWalletCard({
  reward,
  credits,
  balanceLoading,
  todayEarnings,
  treasuryRevenue,
  budgetBonusPercent,
}: VaultWalletCardProps) {
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<Wallet />}>Wallet</CardTitle>
      {reward}
      <Stat
        label="IxCredits"
        value={
          balanceLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <span className="flex items-center gap-2">
              <IxCreditsSymbol decorative className="size-5 shrink-0" />
              {formatCredits(credits ?? 0)}
            </span>
          )
        }
      />
      {todayEarnings && todayEarnings.sources.length > 0 && (
        <EarningsRows earnings={todayEarnings} />
      )}
      {treasuryRevenue && treasuryRevenue.dailyDividend > 0 && (
        <TreasuryRows revenue={treasuryRevenue} budgetBonusPercent={budgetBonusPercent} />
      )}
    </Card>
  );
}
