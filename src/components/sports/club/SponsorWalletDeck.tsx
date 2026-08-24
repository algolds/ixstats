"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Bank as Landmark, ArrowUpRight, Trophy, Sparks as Sparkles, Check, HelpCircle } from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";

interface SponsorWalletDeckProps {
  team: any;
  refetchTeam: () => void;
}

export function SponsorWalletDeck({ team, refetchTeam }: SponsorWalletDeckProps) {
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<number>((team as any).ticketPrice ?? 15);
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const upgradeStadium = api.sports.upgradeStadium.useMutation({
    onSuccess: () => {
      refetchTeam();
      alert("Stadium upgraded successfully! Capacity increased by 1,000 seats.");
    },
    onError: (err) => {
      alert(err.message || "Failed to upgrade stadium");
    },
  });

  const setTicketPrice = api.sports.setTicketPrice.useMutation({
    onSuccess: () => {
      refetchTeam();
      setUpdatingPrice(false);
      alert("Ticket price updated successfully!");
    },
    onError: (err) => {
      alert(err.message || "Failed to set ticket price");
    },
  });

  const selectSponsor = api.sports.selectSponsor.useMutation({
    onSuccess: () => {
      refetchTeam();
      alert("Sponsorship contract activated successfully!");
    },
    onError: (err) => {
      alert(err.message || "Failed to activate sponsorship");
    },
  });

  const currentSponsor = (team as any).sponsor as any;

  const cards = [
    {
      id: 0,
      title: "Sovereign Wallet & Budget",
      description: "Manage club balances and pricing structures",
      color:
        "from-card/90 to-card/60 border-border dark:from-slate-800 dark:to-slate-900 dark:border-slate-700/50",
      icon: Landmark,
      content: (
        <div className="space-y-4 pt-2">
          <div className="border-border bg-muted/40 flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase">
                Current Ticket Price
              </p>
              <p className="text-foreground text-2xl font-bold">₷{team.ticketPrice}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={100}
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="border-border bg-background/50 h-8 w-16 text-center"
              />
              <Button
                size="sm"
                onClick={() => {
                  setUpdatingPrice(true);
                  setTicketPrice.mutate({ teamId: team.id, price: newPrice });
                }}
                disabled={updatingPrice || setTicketPrice.isPending}
                style={{ backgroundColor: team.color }}
                className="font-semibold text-white transition-all hover:opacity-90"
              >
                {setTicketPrice.isPending ? "..." : "Save"}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-[10px] leading-relaxed">
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
      color:
        "from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 dark:from-emerald-950 dark:to-teal-900 dark:border-emerald-800/40",
      icon: ArrowUpRight,
      content: (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase dark:text-emerald-400">
                Current Capacity
              </p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {team.stadiumCapacity?.toLocaleString() ?? "5,000"} seats
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-200"
              onClick={() => upgradeStadium.mutate({ teamId: team.id })}
              disabled={upgradeStadium.isPending}
            >
              {upgradeStadium.isPending ? "Upgrading..." : "Expand (+1k seats)"}
            </Button>
          </div>
          <p className="text-[10px] leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
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
      color:
        "from-amber-500/10 to-amber-600/5 border-amber-500/30 dark:from-amber-950 dark:to-orange-950 dark:border-amber-800/40",
      icon: Trophy,
      content: (
        <div className="space-y-4 pt-2">
          {currentSponsor ? (
            <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <Badge className="mb-1 font-bold text-white" style={{ backgroundColor: team.color }}>
                Active Partner
              </Badge>
              <h5 className="font-bold text-amber-900 dark:text-amber-200">
                {currentSponsor.name}
              </h5>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-amber-500/20 pt-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase">Base Fee</span>
                  <span className="text-foreground font-semibold">
                    ₷{currentSponsor.baseFee} / season
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase">
                    Win Bonus
                  </span>
                  <span className="text-foreground font-semibold">
                    ₷{currentSponsor.winBonus} / match
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-2 text-xs text-amber-700/80 dark:text-amber-300/80">
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
                key={s.type}
                onClick={() =>
                  selectSponsor.mutate({ teamId: team.id, sponsorType: s.type as any })
                }
                disabled={selectSponsor.isPending}
                style={
                  currentSponsor?.name === s.name
                    ? { borderColor: team.color, backgroundColor: `${team.color}20` }
                    : {}
                }
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 text-left transition-all",
                  currentSponsor?.name === s.name
                    ? ""
                    : "border-border bg-muted/40 hover:bg-muted/80 text-foreground"
                )}
              >
                <div>
                  <p className="text-xs font-bold">{s.name}</p>
                  <p className="text-muted-foreground text-[10px]">{s.desc}</p>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
                >
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
    <Card className="facet-hierarchy-child border-border bg-card/45 overflow-hidden rounded-3xl backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Club Command Desk
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Touch a voucher card below to reveal details and execute operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative flex h-[420px] flex-col gap-3 md:h-[450px]">
          {cards.map((card, _idx) => {
            const isExpanded = activeCard === card.id;
            const Icon = card.icon;

            return (
              <motion.div
                key={card.id}
                layout
                onClick={() => {
                  if (!isExpanded) setActiveCard(card.id);
                }}
                className={cn(
                  "flex cursor-pointer flex-col rounded-2xl border bg-gradient-to-br p-4 transition-all",
                  card.color,
                  isExpanded
                    ? "z-10 flex-1 scale-[1.01] shadow-2xl"
                    : "h-16 overflow-hidden hover:translate-y-[-4px]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm leading-none font-bold">{card.title}</h4>
                      {!isExpanded && (
                        <p className="text-muted-foreground mt-1 text-[10px] leading-none">
                          {card.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCard(null);
                      }}
                    >
                      &times;
                    </Button>
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
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
