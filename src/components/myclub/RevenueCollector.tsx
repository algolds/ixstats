"use client";

import { Loader2, Coins, Ticket, BadgeDollarSign, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
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
  teamColor,
}: RevenueCollectorProps) {
  const utils = api.useUtils();

  const collect = api.sports.collectMatchRevenue.useMutation({
    onSuccess: () => {
      utils.sports.getMyClubOverview.invalidate();
      onCollected?.();
    },
  });

  const ticketRevenue = Math.round(
    stadiumCapacity * ticketPrice * 0.6 * (popularity / 100)
  );
  const sponsorIncome = sponsor?.baseFee ?? 0;
  const total = ticketRevenue + sponsorIncome;

  return (
    <Card className="facet-hierarchy-child bg-card/40 border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Coins className="h-5 w-5" style={{ color: teamColor || "#f59e0b" }} />
          Revenue Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" />
              Ticket Revenue
            </span>
            <span className="font-medium tabular-nums text-foreground">+{ticketRevenue.toLocaleString()}c</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              {sponsor?.name ?? "No sponsor"}
            </span>
            <span className="font-medium tabular-nums text-foreground">+{sponsorIncome.toLocaleString()}c</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: teamColor || "#10b981" }} />
              Collect Match Revenue
            </span>
            <span className="tabular-nums" style={{ color: teamColor || "#10b981" }}>+{total.toLocaleString()}c</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Club Budget</span>
          <span className="font-bold tabular-nums text-foreground">{teamBudget.toLocaleString()}c</span>
        </div>

        <Button
          onClick={() => collect.mutate({ teamId })}
          disabled={collect.isPending}
          className="w-full text-xs hover:opacity-90 transition-all font-semibold text-white"
          size="sm"
          style={{ backgroundColor: teamColor || "#3b82f6" }}
        >
          {collect.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Collect Revenue
        </Button>
      </CardContent>
    </Card>
  );
}

