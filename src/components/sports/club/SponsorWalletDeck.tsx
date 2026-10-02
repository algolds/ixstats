"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Stat } from "~/components/ui/stat";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Bank as Landmark,
  ArrowUpRight,
  Trophy,
  Sparks as Sparkles,
  HelpCircle,
  Xmark,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { useNotify } from "~/hooks/useNotify";
import { springSmooth, tweenFast } from "~/lib/design/motion";

export interface ClubSponsor {
  type?: string | null;
  name?: string | null;
  baseFee?: number | null;
  winBonus?: number | null;
  payoutBase?: number | null;
  payoutBonus?: number | null;
}

export interface ClubTeamWallet {
  id: string;
  name: string;
  color?: string | null;
  budget?: number | null;
  stadiumCapacity?: number | null;
  ticketPrice?: number | null;
  sponsor?: ClubSponsor | null;
  patronSaint?: string | null;
}

interface SponsorWalletDeckProps {
  team: ClubTeamWallet;
  refetchTeam: () => void;
}

export function SponsorWalletDeck({ team, refetchTeam }: SponsorWalletDeckProps) {
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<number>(team.ticketPrice ?? 15);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const notify = useNotify();

  const upgradeStadium = api.sports.upgradeStadium.useMutation({
    onSuccess: () => {
      refetchTeam();
      notify.success("Stadium upgraded successfully! Capacity increased by 1,000 seats.");
    },
    onError: (err) => {
      notify.error(err.message || "Failed to upgrade stadium");
    },
  });

  const setTicketPrice = api.sports.setTicketPrice.useMutation({
    onSuccess: () => {
      refetchTeam();
      setUpdatingPrice(false);
      notify.success("Ticket price updated successfully!");
    },
    onError: (err) => {
      notify.error(err.message || "Failed to set ticket price");
    },
  });

  const selectSponsor = api.sports.selectSponsor.useMutation({
    onSuccess: () => {
      refetchTeam();
      notify.success("Sponsorship contract activated successfully!");
    },
    onError: (err) => {
      notify.error(err.message || "Failed to activate sponsorship");
    },
  });

  const currentSponsor = team.sponsor;

  const cards = [
    {
      id: 0,
      title: "Sovereign Wallet & Budget",
      description: "Manage club balances and pricing structures",
      icon: Landmark,
      content: (
        <div className="space-y-4 pt-2">
          <div className="bg-surface rounded-row flex items-center justify-between p-4">
            <Stat label="Current Ticket Price" value={`₷${team.ticketPrice}`} />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={100}
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                aria-label="New ticket price"
                className="h-8 w-20 text-center tabular-nums"
              />
              <Button
                size="sm"
                onClick={() => {
                  setUpdatingPrice(true);
                  setTicketPrice.mutate({ teamId: team.id, price: newPrice });
                }}
                disabled={updatingPrice || setTicketPrice.isPending}
              >
                {setTicketPrice.isPending ? "..." : "Save"}
              </Button>
            </div>
          </div>
          <p className="text-label-secondary text-footnote">
            Ticket pricing scales attendance dynamically. Setting prices too high (above ₷30) will
            reduce seat sales, while lower pricing guarantees sold-out crowds but reduces matchday
            ticketing margins.
          </p>
        </div>
      ),
    },
    {
      id: 1,
      title: "Stadium & Expansion Vouchers",
      description: "Expand seating capacity to maximize ticketing limits",
      icon: ArrowUpRight,
      content: (
        <div className="space-y-4 pt-2">
          <div className="bg-surface rounded-row flex items-center justify-between p-4">
            <Stat
              label="Current Capacity"
              value={`${team.stadiumCapacity?.toLocaleString() ?? "5,000"} seats`}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => upgradeStadium.mutate({ teamId: team.id })}
              disabled={upgradeStadium.isPending}
            >
              {upgradeStadium.isPending ? "Upgrading..." : "Expand (+1k seats)"}
            </Button>
          </div>
          <p className="text-label-secondary text-footnote">
            Stadium expansions cost a flat ₷1,000 Sovereigns and instantly add 1,000 additional
            seats, allowing you to generate more matchday revenue during high-popularity matches.
          </p>
        </div>
      ),
    },
    {
      id: 2,
      title: "Sponsorship Contracts",
      description: "Configure sponsorship packages for baseline and win bonuses",
      icon: Trophy,
      content: (
        <div className="space-y-4 pt-2">
          {currentSponsor ? (
            <div className="bg-surface rounded-row mb-2 p-4">
              <Badge variant="tinted" className="mb-1">
                Active Partner
              </Badge>
              <h5 className="text-headline text-label">{currentSponsor.name}</h5>
              <div className="border-separator mt-2 grid grid-cols-2 gap-2 border-t pt-2">
                <Stat
                  size="sm"
                  label="Base Fee"
                  value={`₷${currentSponsor.baseFee} / home match`}
                />
                <Stat size="sm" label="Win Bonus" value={`₷${currentSponsor.winBonus} / win`} />
              </div>
            </div>
          ) : (
            <div className="text-label-secondary text-footnote mb-2">
              Select a sponsor below to secure passive funding:
            </div>
          )}

          <div className="grid gap-2 pt-2">
            {[
              {
                type: "Conservative",
                name: "SafeState Insurance",
                desc: "High base payout, no risk bonus",
                payout: "₷100 base / ₷0 win bonus",
              },
              {
                type: "Aggressive",
                name: "Apex Energy Drink",
                desc: "Low base, massive win bonuses",
                payout: "₷10 base / ₷25 win bonus",
              },
              {
                type: "Corporate",
                name: "Globex Logistics",
                desc: "Balanced corporate structure",
                payout: "₷50 base / ₷10 win bonus",
              },
            ].map((s) => (
              <button
                type="button"
                key={s.type}
                aria-pressed={currentSponsor?.name === s.name}
                onClick={() =>
                  selectSponsor.mutate({
                    teamId: team.id,
                    sponsorType: s.type as "Conservative" | "Aggressive" | "Corporate",
                  })
                }
                disabled={selectSponsor.isPending}
                className={cn(
                  "focus-visible:outline-tint rounded-row duration-fast ease-out-facet flex cursor-pointer items-center justify-between gap-3 border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait",
                  currentSponsor?.name === s.name
                    ? "border-tint bg-tint-fill"
                    : "border-separator bg-surface hover:bg-fill-4"
                )}
              >
                <div>
                  <p className="text-headline text-label">{s.name}</p>
                  <p className="text-label-secondary text-footnote">{s.desc}</p>
                </div>
                <Badge variant="neutral" className="shrink-0 tabular-nums">
                  {s.payout}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-title-2 flex items-center gap-2">
          <Sparkles className="text-tint size-5" aria-hidden />
          Club Command Desk
        </CardTitle>
        <CardDescription>
          Touch a voucher card below to reveal details and execute operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative flex h-[420px] flex-col gap-3 md:h-[450px]">
          {cards.map((card) => {
            const isExpanded = activeCard === card.id;
            const Icon = card.icon;

            return (
              <motion.div
                key={card.id}
                layout
                transition={springSmooth}
                className={cn(
                  "bg-surface-secondary rounded-row flex flex-col",
                  isExpanded ? "flex-1 p-4" : "overflow-hidden"
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      if (!isExpanded) setActiveCard(card.id);
                    }}
                    className={cn(
                      "focus-visible:outline-tint rounded-row flex flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2",
                      !isExpanded && "hover:bg-fill-4 cursor-pointer p-4"
                    )}
                  >
                    <div className="bg-tint-fill text-tint rounded-control-sm flex size-8 items-center justify-center">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div>
                      <h4 className="text-headline text-label">{card.title}</h4>
                      {!isExpanded && (
                        <p className="text-label-secondary text-footnote">{card.description}</p>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Close"
                      className="text-label-secondary"
                      onClick={() => setActiveCard(null)}
                    >
                      <Xmark />
                    </Button>
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={tweenFast}
                      className="mt-4 flex-1 overflow-y-auto"
                    >
                      {card.content}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
