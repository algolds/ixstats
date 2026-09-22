"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { LineupBuilder } from "~/components/sports/club/LineupBuilder";
import { SPORT_PRESETS, type SportPreset } from "~/lib/sports/presets";
import { cn } from "~/lib/utils";

const TACTICAL_INTENTS = [
  {
    key: "neutral",
    name: "Neutral (Balanced)",
    description:
      "Standard balanced formation. No attribute modifications. Best for even matchups or when scouted data is unavailable.",
    stats: "Offense: Baseline · Defense: Baseline · Volatility: Baseline",
    offenseOffset: "90",
    offenseVal: "0",
    defenseOffset: "90",
    defenseVal: "0",
  },
  {
    key: "all_out_attack",
    name: "All-Out Attack",
    description:
      "Commits players forward. Significantly boosts goal scoring chance but leaves the backline highly vulnerable to counters.",
    stats: "Offense: +10 · Defense: -12 · Volatility & Tempo: High (+0.8)",
    offenseOffset: "32",
    offenseVal: "+10",
    defenseOffset: "125",
    defenseVal: "-12",
  },
  {
    key: "catenaccio",
    name: "Catenaccio (Bus Parking)",
    description:
      "Extreme defensive lock-out. Maximizes defensive resistance while shutting down offense and dropping match volatility to a minimum.",
    stats: "Offense: -12 · Defense: +15 · Volatility & Tempo: Very Low (-1.0)",
    offenseOffset: "130",
    offenseVal: "-12",
    defenseOffset: "20",
    defenseVal: "+15",
  },
  {
    key: "counter_attack",
    name: "Counter-Attack",
    description:
      "Absorbs pressure and breaks rapidly. Moderately buffs both offense and defense. Automatically counters All-Out Attack (+8 overall bonus).",
    stats: "Offense: +5 · Defense: +5 · Counter bonus vs All-Out Attack",
    offenseOffset: "80",
    offenseVal: "+5",
    defenseOffset: "80",
    defenseVal: "+5",
  },
  {
    key: "tiki_taka",
    name: "Tiki-Taka",
    description:
      "Focuses on short passing, high possession, and spatial control. Buffs offense and defense while keeping volatility low.",
    stats: "Offense: +8 · Defense: +4 · Volatility & Tempo: Low (-0.5)",
    offenseOffset: "45",
    offenseVal: "+8",
    defenseOffset: "70",
    defenseVal: "+4",
  },
  {
    key: "gegenpressing",
    name: "Gegenpressing",
    description:
      "Aggressive press upon losing possession. Heavy offensive bonus, high volatility, but leaves backline exposed if bypassed.",
    stats: "Offense: +12 · Defense: -5 · Volatility & Tempo: High (+0.6)",
    offenseOffset: "20",
    offenseVal: "+12",
    defenseOffset: "110",
    defenseVal: "-5",
  },
  {
    key: "kick_and_rush",
    name: "Kick and Rush",
    description:
      "Direct, high-tempo long-ball play. Direct offensive threat at the cost of defensive organization and higher volatility.",
    stats: "Offense: +6 · Defense: -8 · Volatility & Tempo: Very High (+1.0)",
    offenseOffset: "60",
    offenseVal: "+6",
    defenseOffset: "120",
    defenseVal: "-8",
  },
];

export interface ClubTacticsSectionProps {
  team: {
    id: string;
    name: string;
    color?: string | null;
    tacticalIntent?: string | null;
    attackFocus?: number | null;
    teamIntensity?: number | null;
    players?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      position: string;
      number?: number | null;
      ratings?: Record<string, unknown> | null;
    }>;
    league?: {
      sportPreset?: string | null;
    } | null;
    lineup?: Record<string, unknown> | null;
  };
  onUpdateTactics: (params: {
    tacticalIntent?: string;
    attackFocus?: number;
    teamIntensity?: number;
  }) => void;
  isUpdatingTactics?: boolean;
  onSavedLineup?: () => void;
}

export function ClubTacticsSection({
  team,
  onUpdateTactics,
  isUpdatingTactics,
  onSavedLineup,
}: ClubTacticsSectionProps) {
  const teamColor = team.color || "#3b82f6";
  const [attackFocus, setAttackFocus] = useState<number>(team.attackFocus ?? 50);
  const [teamIntensity, setTeamIntensity] = useState<number>(team.teamIntensity ?? 50);

  const activeIntent =
    TACTICAL_INTENTS.find((t) => t.key === team.tacticalIntent) ?? TACTICAL_INTENTS[0]!;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Tactical Shapes / Presets */}
      <div className="lg:col-span-2">
        <Card className="facet-hierarchy-child bg-card/45 border-border">
          <CardHeader>
            <CardTitle>Team Tactics & Strategy</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select your default tactical intent. Underlying formulas adjust offense, defense, and
              match volatility ratings.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {TACTICAL_INTENTS.map((tactic) => {
              const isActive = (team.tacticalIntent || "neutral") === tactic.key;
              return (
                <div
                  key={tactic.key}
                  style={
                    isActive
                      ? {
                          borderColor: teamColor,
                          backgroundColor: `${teamColor}15`,
                          boxShadow: `0 0 0 2px ${teamColor}20`,
                        }
                      : {}
                  }
                  className={cn(
                    "cursor-pointer rounded-2xl border p-4 transition-all duration-300",
                    isActive
                      ? "scale-[1.01] border-transparent"
                      : "border-border/50 bg-muted/40 hover:bg-muted/80 text-foreground"
                  )}
                  onClick={() => {
                    if (isUpdatingTactics) return;
                    onUpdateTactics({
                      tacticalIntent: tactic.key,
                      attackFocus,
                      teamIntensity,
                    });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold">{tactic.name}</h4>
                    {isActive && (
                      <Badge
                        style={{ backgroundColor: teamColor }}
                        className="font-bold text-white"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                    {tactic.description}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Strategic Weighting & Sliders */}
      <div>
        <Card className="facet-hierarchy-child bg-card/40 border-border">
          <CardHeader>
            <CardTitle className="text-base font-bold">Strategic Weighting</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-stretch space-y-6 py-6">
            {/* Offense Ring */}
            <div className="flex w-full items-center justify-start gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg className="h-full w-full -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-muted/30 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="fill-none transition-all duration-500"
                    style={{ stroke: teamColor }}
                    strokeWidth="6"
                    strokeDasharray="163.3"
                    strokeDashoffset={activeIntent.offenseOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
                  {activeIntent.offenseVal}
                </div>
              </div>
              <div>
                <h5 className="text-sm leading-none font-bold">Offense Bias</h5>
                <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
                  Adjusts match scoring chances
                </p>
              </div>
            </div>

            {/* Defense Ring */}
            <div className="flex w-full items-center justify-start gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg className="h-full w-full -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-muted/30 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="fill-none transition-all duration-500"
                    style={{ stroke: teamColor }}
                    strokeWidth="6"
                    strokeDasharray="163.3"
                    strokeDashoffset={activeIntent.defenseOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
                  {activeIntent.defenseVal}
                </div>
              </div>
              <div>
                <h5 className="text-sm leading-none font-bold">Defense Bias</h5>
                <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
                  Concede probability coefficient
                </p>
              </div>
            </div>

            {/* Custom Sliders */}
            <div className="my-4 space-y-4 border-t border-white/10 pt-4">
              <h5 className="text-foreground text-xs font-extrabold tracking-widest uppercase">
                Custom Sliders
              </h5>

              {/* Attack Focus Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-muted-foreground">Attack Focus</span>
                  <span style={{ color: teamColor }}>{attackFocus}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={attackFocus}
                  onChange={(e) => setAttackFocus(Number(e.target.value))}
                  onMouseUp={() => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      attackFocus,
                      teamIntensity,
                    });
                  }}
                  onTouchEnd={() => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      attackFocus,
                      teamIntensity,
                    });
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800"
                  style={{ accentColor: teamColor }}
                />
                <div className="text-muted-foreground/60 flex justify-between text-[9px]">
                  <span>Defensive (-8 Off)</span>
                  <span>Balanced</span>
                  <span>Attacking (+8 Off)</span>
                </div>
              </div>

              {/* Team Intensity Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-muted-foreground">Team Intensity</span>
                  <span style={{ color: teamColor }}>{teamIntensity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={teamIntensity}
                  onChange={(e) => setTeamIntensity(Number(e.target.value))}
                  onMouseUp={() => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      attackFocus,
                      teamIntensity,
                    });
                  }}
                  onTouchEnd={() => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      attackFocus,
                      teamIntensity,
                    });
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800"
                  style={{ accentColor: teamColor }}
                />
                <div className="text-muted-foreground/60 flex justify-between text-[9px]">
                  <span>Conservative (-0.5 Vol)</span>
                  <span>Standard</span>
                  <span>Intense (+0.5 Vol)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lineup Builder */}
      <div className="lg:col-span-3">
        <LineupBuilder
          teamId={team.id}
          teamName={team.name}
          teamColor={teamColor}
          players={
            (team.players ?? []).map((p) => ({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              position: p.position,
              number: p.number,
              ratings: p.ratings as Record<string, number | undefined> | undefined,
            }))
          }
          presets={SPORT_PRESETS}
          sportPreset={team.league?.sportPreset ?? ""}
          currentLineup={team.lineup as { starters?: string[]; captainId?: string } | undefined}
          onSaved={onSavedLineup}
        />
      </div>
    </div>
  );
}

export default ClubTacticsSection;
