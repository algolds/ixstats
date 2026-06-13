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
      const gks = players.filter(
        (p) => p.position.toUpperCase().includes("GK") || p.position.toUpperCase().includes("GOAL")
      );
      const defs = players.filter((p) =>
        ["D", "CB", "LB", "RB", "DF", "SW"].some((suffix) =>
          p.position.toUpperCase().includes(suffix)
        )
      );
      const mids = players.filter(
        (p) =>
          ["M", "CM", "LM", "RM", "DM", "AM", "MF"].some((suffix) =>
            p.position.toUpperCase().includes(suffix)
          ) && !p.position.toUpperCase().includes("GK")
      );
      const fwds = players.filter(
        (p) =>
          ["F", "ST", "CF", "LW", "RW", "FW"].some((suffix) =>
            p.position.toUpperCase().includes(suffix)
          ) && !["D", "M", "GK"].some((s) => p.position.toUpperCase().includes(s))
      );

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
        "border-border/40 bg-card/90 mx-auto w-full max-w-[550px] overflow-hidden rounded-3xl border p-6 shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-foreground text-lg leading-none font-extrabold">{teamName} Lineup</h3>
        <span className="text-muted-foreground mt-1 inline-block text-[10px] font-bold uppercase">
          Active Formation • {sportPreset}
        </span>
      </div>

      {/* Field Area */}
      <div className="border-border/30 relative aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-emerald-800/80 to-emerald-950/90 shadow-inner dark:from-emerald-900/40 dark:to-emerald-950/60">
        {/* Pitch markings */}
        <svg
          viewBox="0 0 400 500"
          className="pointer-events-none absolute inset-0 h-full w-full fill-none stroke-white/20 stroke-[2px]"
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
            const initials =
              `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();

            return (
              <div
                key={player.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${player.x}%`, top: `${player.y}%` }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center">
                      {/* Player Circle Token */}
                      <div
                        className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: teamColor }}
                      >
                        {player.number ?? initials}

                        {/* Rating Overlay Badge */}
                        <div className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-[8px] font-black text-white">
                          {player.overallRating}
                        </div>
                      </div>

                      {/* Mini Name underneath */}
                      <span className="mt-1 max-w-[70px] truncate rounded bg-black/60 px-1.5 py-0.5 text-[8px] leading-none font-bold tracking-tight text-white shadow-xs backdrop-blur-xs">
                        {player.lastName}
                      </span>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[180px] rounded-xl border p-3 shadow-xl">
                    <div className="text-popover-foreground text-xs leading-tight font-black">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wide uppercase">
                      {player.position} #{player.number ?? "--"}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
                      <span className="text-muted-foreground font-bold">RATING:</span>
                      <span className="font-extrabold text-emerald-400">
                        {player.overallRating} Overall
                      </span>
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
