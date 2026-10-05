"use client";

import type { ReactNode } from "react";
import { GraphUp, Wallet } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Card, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { Credits, formatCredits } from "./credits";

type TodayEarnings = RouterOutputs["vault"]["getTodayEarnings"];

interface VaultWalletCardProps {
  /** The daily reward row; the dashboard supplies it so the card stays presentational. */
  reward: ReactNode;
  credits: number | undefined;
  balanceLoading: boolean;
  todayEarnings: TodayEarnings | undefined;
}

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

/** Balance and today's earnings, with the daily reward on top. */
export function VaultWalletCard({
  reward,
  credits,
  balanceLoading,
  todayEarnings,
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
    </Card>
  );
}
