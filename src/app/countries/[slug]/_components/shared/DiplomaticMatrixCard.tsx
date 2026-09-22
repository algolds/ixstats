"use client";

import React from "react";
import { Globe, Group as Users, Shield, Coins, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";

interface DiplomaticMatrixCardProps {
  countryName: string;
  standingScore?: number;
  tradeBalance?: number; // USD
  className?: string;
}

const ALLIES = [
  { name: "Vesconia", tier: "Strategic Alliance", score: 91, trade: "+$1.8T", flag: "🔵" },
  { name: "Molata", tier: "Defense Pact", score: 84, trade: "+$740B", flag: "🟢" },
  { name: "Devecus", tier: "Trade Partner", score: 78, trade: "+$320B", flag: "🟡" },
];

const TENSIONS = [
  { name: "Ostrana", tier: "Border Friction", score: 38, trade: "-$120B", flag: "🔴" },
];

export function DiplomaticMatrixCard({
  countryName,
  standingScore = 68,
  tradeBalance = 1200000000000,
  className,
}: DiplomaticMatrixCardProps) {
  return (
    <div
      className={cn(
        "facet-surface facet-refraction space-y-4 rounded-2xl border border-white/10 p-5 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            International Relations
          </span>
          <h3 className="text-base font-bold tracking-tight text-foreground">
            Diplomatic Matrix & Alliances
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-400">
            Score: {standingScore}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Strategic Partners & Allies */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span>Key Alliances & Treaties</span>
          </div>

          <div className="space-y-1.5">
            {ALLIES.map((partner, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 backdrop-blur-sm transition-all hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{partner.flag}</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{partner.name}</p>
                    <p className="text-[10px] text-muted-foreground">{partner.tier}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-emerald-400">{partner.score}%</span>
                  <p className="text-[10px] text-muted-foreground">{partner.trade}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Geopolitical Tensions & Trade Network */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            <span>Trade Surplus & Regional Tension</span>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[11px] text-muted-foreground">Annual Trade Balance</span>
              <span className="text-xs font-bold text-emerald-400">+$1.2 Trillion Surplus</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[11px] text-muted-foreground">Active Treaties & Accords</span>
              <span className="text-xs font-bold text-foreground">14 Ratified Treaties</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Active Embassies</span>
              <span className="text-xs font-bold text-foreground">58 Missions Worldwide</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
