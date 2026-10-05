"use client";

import {
  SystemRestart as Loader2,
  Coins,
  Label as Ticket,
  Dollar as BadgeDollarSign,
  StatUp as TrendingUp,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface RevenueCollectorProps {
  teamId: string;
  teamBudget: number;
  stadiumCapacity: number;
  ticketPrice: number;
  popularity: number;
  sponsor: { name?: string; baseFee?: number; winBonus?: number } | null;
  onCollected?: () => void;
  teamColor?: string;
}

export function RevenueCollector({
  teamId,
  teamBudget,
  stadiumCapacity,
  ticketPrice,
  popularity,
  sponsor,
  onCollected,
  teamColor: _teamColor,
}: RevenueCollectorProps) {
  const utils = api.useUtils();

  // What's waiting: completed matches this club hasn't been paid for yet (each pays once).
  const { data: pending } = api.sports.previewMatchRevenue.useQuery({ teamId });
  const collect = api.sports.collectMatchRevenue.useMutation({
    onSuccess: () => {
      void utils.sports.previewMatchRevenue.invalidate({ teamId });
      onCollected?.();
    },
  });

  const perHomeMatch = Math.round(stadiumCapacity * ticketPrice * 0.6 * (popularity / 100));
  const ticketRevenue = pending?.ticketRevenue ?? 0;
  const sponsorIncome = (pending?.sponsorFees ?? 0) + (pending?.winBonuses ?? 0);
  const total = pending?.total ?? 0;
  const matchesWaiting = pending ? pending.homeMatches : 0;

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="text-label-secondary size-5" aria-hidden />
          Revenue collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-body flex items-center justify-between">
            <span className="text-label-secondary flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5" />
              Ticket Revenue ({matchesWaiting} home {matchesWaiting === 1 ? "match" : "matches"} ×{" "}
              {perHomeMatch.toLocaleString()}c)
            </span>
            <span className="text-label font-medium tabular-nums">
              +{ticketRevenue.toLocaleString()}c
            </span>
          </div>
          <div className="text-body flex items-center justify-between">
            <span className="text-label-secondary flex items-center gap-2">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              {sponsor?.name ?? "No sponsor"}
              {pending && pending.wins > 0
                ? ` (incl. ${pending.wins} ${pending.wins === 1 ? "win bonus" : "win bonuses"})`
                : ""}
            </span>
            <span className="text-label font-medium tabular-nums">
              +{sponsorIncome.toLocaleString()}c
            </span>
          </div>
          <div className="border-separator text-headline flex items-center justify-between border-t pt-2">
            <span className="text-label flex items-center gap-2">
              <TrendingUp className="text-success size-3.5" aria-hidden />
              Collect match revenue
            </span>
            <span className="text-success tabular-nums">+{total.toLocaleString()}c</span>
          </div>
        </div>

        <div className="text-label-secondary text-footnote flex items-center justify-between">
          <span>Club budget</span>
          <span className="text-label font-semibold tabular-nums">
            {teamBudget.toLocaleString()}c
          </span>
        </div>

        <Button
          onClick={() => collect.mutate({ teamId })}
          disabled={collect.isPending || total <= 0}
          className="w-full"
          size="sm"
        >
          {collect.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          {total > 0 ? "Collect Revenue" : "No new match revenue"}
        </Button>
      </CardContent>
    </Card>
  );
}
