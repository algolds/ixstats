"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Coins, Group as Users, Shield, LightBulb as Lightbulb, Globe, Check, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";

interface QuickCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCountry: {
    name: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    landArea?: number | null;
  };
}

const PEER_NATIONS = [
  {
    name: "Vesconia",
    gdp: "$48.2T",
    gdpRaw: 48.2,
    population: "412.0M",
    gdpPerCapita: "$116,990",
    militaryScore: 81,
    wellbeingScore: 88,
    techScore: 92,
  },
  {
    name: "Ostrana",
    gdp: "$43.7T",
    gdpRaw: 43.7,
    population: "520.4M",
    gdpPerCapita: "$83,973",
    militaryScore: 86,
    wellbeingScore: 78,
    techScore: 84,
  },
  {
    name: "Tretrid",
    gdp: "$37.1T",
    gdpRaw: 37.1,
    population: "380.1M",
    gdpPerCapita: "$97,605",
    militaryScore: 76,
    wellbeingScore: 85,
    techScore: 89,
  },
];

export function QuickCompareModal({ isOpen, onClose, currentCountry }: QuickCompareModalProps) {
  const [selectedPeer, setSelectedPeer] = useState(PEER_NATIONS[0]!);

  const currentGdpRaw = (currentCountry.currentTotalGdp || 40200000000000) / 1000000000000;
  const currentPopRaw = (currentCountry.currentPopulation || 626200000) / 1000000;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl border-white/10 bg-background/95 p-6 backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Cross-Country Benchmarking
            </span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Compare {currentCountry.name} with Global Peers
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Side-by-side sovereign telemetry comparison across economic output, demographics, and national indices.
          </DialogDescription>
        </DialogHeader>

        {/* Peer Selection Pills */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 pt-2">
          <span className="text-xs font-semibold text-muted-foreground">Benchmark Against:</span>
          {PEER_NATIONS.map((peer) => (
            <button
              key={peer.name}
              type="button"
              data-cuelume-press="soft"
              onClick={() => setSelectedPeer(peer)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 active:scale-[0.96]",
                selectedPeer.name === peer.name
                  ? "border border-[var(--flag-primary)] bg-[var(--flag-primary)]/15 text-[var(--flag-primary)]"
                  : "border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              )}
            >
              {peer.name}
            </button>
          ))}
        </div>

        {/* Comparison Matrix Grid */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          {/* Dimension Header */}
          <div className="space-y-4 pt-8 text-xs font-semibold text-muted-foreground">
            <div className="py-2 border-b border-white/5">Total Nominal GDP</div>
            <div className="py-2 border-b border-white/5">Total Population</div>
            <div className="py-2 border-b border-white/5">GDP per Capita</div>
            <div className="py-2 border-b border-white/5">Military Power Index</div>
            <div className="py-2 border-b border-white/5">Quality of Life Index</div>
            <div className="py-2">Technology Frontier</div>
          </div>

          {/* Current Country Column */}
          <div className="rounded-xl border border-[var(--flag-primary)]/30 bg-[var(--flag-primary)]/5 p-4 text-center">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] font-extrabold uppercase text-[var(--flag-primary)]">Baseline</span>
              <h4 className="text-sm font-extrabold text-foreground truncate">{currentCountry.name}</h4>
            </div>
            <div className="space-y-4 pt-3 text-xs font-bold text-foreground">
              <div className="py-2 border-b border-white/5">${currentGdpRaw.toFixed(1)}T</div>
              <div className="py-2 border-b border-white/5">{currentPopRaw.toFixed(1)}M</div>
              <div className="py-2 border-b border-white/5">
                ${Math.round(currentCountry.currentGdpPerCapita || 64273).toLocaleString()}
              </div>
              <div className="py-2 border-b border-white/5 text-red-400">72/100</div>
              <div className="py-2 border-b border-white/5 text-emerald-400">82/100</div>
              <div className="py-2 text-indigo-400">88/100</div>
            </div>
          </div>

          {/* Selected Peer Column */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Peer</span>
              <h4 className="text-sm font-extrabold text-foreground truncate">{selectedPeer.name}</h4>
            </div>
            <div className="space-y-4 pt-3 text-xs font-bold text-foreground">
              <div className="py-2 border-b border-white/5">{selectedPeer.gdp}</div>
              <div className="py-2 border-b border-white/5">{selectedPeer.population}</div>
              <div className="py-2 border-b border-white/5">{selectedPeer.gdpPerCapita}</div>
              <div className="py-2 border-b border-white/5 text-red-400">{selectedPeer.militaryScore}/100</div>
              <div className="py-2 border-b border-white/5 text-emerald-400">{selectedPeer.wellbeingScore}/100</div>
              <div className="py-2 text-indigo-400">{selectedPeer.techScore}/100</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
