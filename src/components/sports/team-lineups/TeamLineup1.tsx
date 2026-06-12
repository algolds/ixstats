"use client";

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

export interface LineupPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  number?: number | null;
  overallRating: number;
  x?: number; // percentage (0-100)
  y?: number; // percentage (0-100)
}

interface TeamLineup1Props {
  teamName: string;
  teamColor: string;
  players: LineupPlayer[];
  sportPreset?: "soccer" | "basketball" | "football" | "hockey";
  className?: string;
}

export default function TeamLineup1({
  teamName,
  teamColor = "#3b82f6",
  players,
  sportPreset = "soccer",
  className,
}: TeamLineup1Props) {
  // Automatically distribute players based on position if x/y aren't provided
  const positionedPlayers = useMemo(() => {
    return players.map((player, index) => {
      if (player.x !== undefined && player.y !== undefined) {
        return player as Required<LineupPlayer>;
      }

      // Fallback auto-positioner (Soccer 4-4-2 default layout)
      const pos = player.position.toUpperCase();
      let x = 50;
      let y = 50;

      // Group and arrange players by position
      const gks = players.filter(p => p.position.toUpperCase().includes("GK") || p.position.toUpperCase().includes("GOAL"));
      const defs = players.filter(p => ["D", "CB", "LB", "RB", "DF", "SW"].some(suffix => p.position.toUpperCase().includes(suffix)));
      const mids = players.filter(p => ["M", "CM", "LM", "RM", "DM", "AM", "MF"].some(suffix => p.position.toUpperCase().includes(suffix)) && !p.position.toUpperCase().includes("GK"));
      const fwds = players.filter(p => ["F", "ST", "CF", "LW", "RW", "FW"].some(suffix => p.position.toUpperCase().includes(suffix)) && !["D", "M", "GK"].some(s => p.position.toUpperCase().includes(s)));

      if (pos.includes("GK") || pos.includes("GOAL")) {
        const gkIdx = gks.indexOf(player);
        x = gks.length > 1 ? 25 + (50 / (gks.length - 1)) * gkIdx : 50;
        y = 88;
      } else if (defs.includes(player)) {
        const defIdx = defs.indexOf(player);
        x = defs.length > 1 ? 15 + (70 / (defs.length - 1)) * defIdx : 50;
        y = 68;
      } else if (mids.includes(player)) {
        const midIdx = mids.indexOf(player);
        x = mids.length > 1 ? 15 + (70 / (mids.length - 1)) * midIdx : 50;
        y = 44;
      } else if (fwds.includes(player)) {
        const fwdIdx = fwds.indexOf(player);
        x = fwds.length > 1 ? 30 + (40 / (fwds.length - 1)) * fwdIdx : 50;
        y = 20;
      } else {
        // Uniform dispersion fallback
        const itemsInRow = 4;
        const rowIndex = Math.floor(index / itemsInRow);
        const colIndex = index % itemsInRow;
        x = 20 + colIndex * 20;
        y = 30 + rowIndex * 20;
      }

      return { ...player, x, y } as Required<LineupPlayer>;
    });
  }, [players]);

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "mx-auto w-full max-w-[550px] p-6 rounded-3xl border border-border/40 bg-card/90 shadow-xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-extrabold text-foreground leading-none">
          {teamName} Lineup
        </h3>
        <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1 inline-block">
          Active Formation • {sportPreset}
        </span>
      </div>

      {/* Field Area */}
      <div className="relative aspect-[4/5] w-full rounded-2xl border border-border/30 bg-gradient-to-b from-emerald-800/80 to-emerald-950/90 dark:from-emerald-900/40 dark:to-emerald-950/60 overflow-hidden shadow-inner">
        {/* Pitch markings */}
        <svg
          viewBox="0 0 400 500"
          className="absolute inset-0 w-full h-full stroke-white/20 fill-none stroke-[2px] pointer-events-none"
        >
          {/* Outer Border */}
          <rect x="15" y="15" width="370" height="470" />
          
          {/* Halfway Line */}
          <line x1="15" y1="250" x2="385" y2="250" />
          <circle cx="200" cy="250" r="60" />

          {/* Penalty Box Top */}
          <rect x="90" y="15" width="220" height="80" />
          <rect x="140" y="15" width="120" height="25" />
          <path d="M150 95 A 60 60 0 0 0 250 95" />

          {/* Penalty Box Bottom */}
          <rect x="90" y="405" width="220" height="80" />
          <rect x="140" y="460" width="120" height="25" />
          <path d="M150 405 A 60 60 0 0 1 250 405" />
        </svg>

        {/* Player Badges */}
        <TooltipProvider delayDuration={150}>
          {positionedPlayers.map((player) => {
            const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();

            return (
              <div
                key={player.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{ left: `${player.x}%`, top: `${player.y}%` }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center">
                      {/* Player Circle Token */}
                      <div
                        className="relative w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-black text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: teamColor }}
                      >
                        {player.number ?? initials}
                        
                        {/* Rating Overlay Badge */}
                        <div className="absolute -top-1.5 -right-1.5 bg-slate-950 border border-white/20 text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center text-white">
                          {player.overallRating}
                        </div>
                      </div>

                      {/* Mini Name underneath */}
                      <span className="mt-1 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded text-[8px] font-bold text-white tracking-tight leading-none shadow-xs truncate max-w-[70px]">
                        {player.lastName}
                      </span>
                    </div>
                  </TooltipTrigger>
                  
                  <TooltipContent className="p-3 bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-[180px]">
                    <div className="text-xs font-black leading-tight text-popover-foreground">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wide">
                      {player.position} #{player.number ?? "--"}
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground font-bold">RATING:</span>
                      <span className="font-extrabold text-emerald-400">{player.overallRating} Overall</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </FacetCard>
  );
}
