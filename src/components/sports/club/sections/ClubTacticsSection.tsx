"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { LineupBuilder } from "~/components/sports/club/LineupBuilder";
import { SPORT_PRESETS } from "~/lib/sports/presets";
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

interface ClubTacticsSectionProps {
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
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Team tactics & strategy</CardTitle>
            <CardDescription className="text-label-secondary">
              Select your default tactical intent. Underlying formulas adjust offense, defense, and
              match volatility ratings.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {TACTICAL_INTENTS.map((tactic) => {
              const isActive = (team.tacticalIntent || "neutral") === tactic.key;
              return (
                <button
                  type="button"
                  key={tactic.key}
                  aria-pressed={isActive}
                  disabled={isUpdatingTactics}
                  className={cn(
                    "focus-visible:outline-tint rounded-row duration-fast ease-out-facet border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait",
                    isActive
                      ? "border-tint bg-tint-fill"
                      : "border-separator bg-surface-secondary hover:bg-fill-4 cursor-pointer"
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
                    <h4 className="text-headline text-label">{tactic.name}</h4>
                    {isActive && <Badge variant="secondary">Active</Badge>}
                  </div>
                  <p className="text-label-secondary text-callout mt-2">{tactic.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Strategic Weighting & Sliders */}
      <div>
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Strategic weighting</CardTitle>
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
                    className="stroke-fill-2 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-tint ease-out-facet fill-none transition-[stroke-dashoffset] duration-500"
                    strokeWidth="6"
                    strokeDasharray="163.3"
                    strokeDashoffset={activeIntent.offenseOffset}
                  />
                </svg>
                <div className="text-footnote text-label absolute inset-0 flex items-center justify-center font-semibold tabular-nums">
                  {activeIntent.offenseVal}
                </div>
              </div>
              <div>
                <h5 className="text-headline text-label">Offense bias</h5>
                <p className="text-label-secondary text-footnote mt-0.5">
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
                    className="stroke-fill-2 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-tint ease-out-facet fill-none transition-[stroke-dashoffset] duration-500"
                    strokeWidth="6"
                    strokeDasharray="163.3"
                    strokeDashoffset={activeIntent.defenseOffset}
                  />
                </svg>
                <div className="text-footnote text-label absolute inset-0 flex items-center justify-center font-semibold tabular-nums">
                  {activeIntent.defenseVal}
                </div>
              </div>
              <div>
                <h5 className="text-headline text-label">Defense bias</h5>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Concede probability coefficient
                </p>
              </div>
            </div>

            {/* Custom Sliders */}
            <div className="border-separator my-4 space-y-4 border-t pt-4">
              <h5 className="text-subhead text-label-secondary">Custom sliders</h5>

              {/* Attack Focus Slider */}
              <div className="space-y-2">
                <div className="text-footnote flex justify-between font-medium">
                  <span className="text-label-secondary">Attack focus</span>
                  <span className="text-tint tabular-nums">{attackFocus}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={[attackFocus]}
                  aria-label="Attack focus"
                  onValueChange={([v]) => setAttackFocus(v ?? 0)}
                  onValueCommit={([v]) => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      attackFocus: v ?? 0,
                      teamIntensity,
                    });
                  }}
                />
                <div className="text-label-tertiary text-footnote flex justify-between">
                  <span>Defensive (-8 Off)</span>
                  <span>Balanced</span>
                  <span>Attacking (+8 Off)</span>
                </div>
              </div>

              {/* Team Intensity Slider */}
              <div className="space-y-2 pt-2">
                <div className="text-footnote flex justify-between font-medium">
                  <span className="text-label-secondary">Team intensity</span>
                  <span className="text-tint tabular-nums">{teamIntensity}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={[teamIntensity]}
                  aria-label="Team intensity"
                  onValueChange={([v]) => setTeamIntensity(v ?? 0)}
                  onValueCommit={([v]) => {
                    onUpdateTactics({
                      tacticalIntent: team.tacticalIntent ?? "neutral",
                      teamIntensity: v ?? 0,
                      attackFocus,
                    });
                  }}
                />
                <div className="text-label-tertiary text-footnote flex justify-between">
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
          players={(team.players ?? []).map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position,
            number: p.number,
            ratings: p.ratings as Record<string, number | undefined> | undefined,
          }))}
          presets={SPORT_PRESETS}
          sportPreset={team.league?.sportPreset ?? ""}
          currentLineup={team.lineup as { starters?: string[]; captainId?: string } | undefined}
          onSaved={onSavedLineup}
        />
      </div>
    </div>
  );
}
