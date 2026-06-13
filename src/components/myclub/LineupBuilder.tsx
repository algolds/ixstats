"use client";

import { useState, useMemo } from "react";
import { Loader2, Shirt, Star, Check } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { SportPreset } from "~/lib/sports/presets";
import TeamLineup1 from "~/components/sports/team-lineups/TeamLineup1";
import { useNotify } from "~/hooks/useNotify";
import { PositionTooltip } from "~/components/sports/PositionTooltip";

interface LineupBuilderProps {
  teamId: string;
  teamName: string;
  teamColor?: string;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    number?: number | null;
    ratings: Record<string, any>;
  }>;
  presets: SportPreset[];
  sportPreset: string;
  currentLineup?: {
    starters?: string[];
    captainId?: string | null;
    formation?: string;
  } | null;
  onSaved?: () => void;
}

export function LineupBuilder({
  teamId,
  teamName,
  teamColor = "#3b82f6",
  players,
  presets,
  sportPreset,
  currentLineup,
  onSaved,
}: LineupBuilderProps) {
  const utils = api.useUtils();
  const notify = useNotify();
  const preset = presets.find((p) => p.key === sportPreset);

  const [starters, setStarters] = useState<string[]>(currentLineup?.starters ?? []);
  const [captainId, setCaptainId] = useState<string | null>(currentLineup?.captainId ?? null);

  const starterPlayersMapped = useMemo(() => {
    return players
      .filter((p) => starters.includes(p.id))
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        number: p.number,
        overallRating: (p.ratings as any)?.overall ?? 50,
      }));
  }, [players, starters]);

  const setLineup = api.sports.setLineup.useMutation({
    onSuccess: () => {
      utils.sports.getMyClubOverview.invalidate();
      onSaved?.();
    },
  });

  const startingSlots = preset?.startingSlots ?? {};

  const maxStarters = useMemo(() => {
    return Object.values(startingSlots).reduce((sum, val) => sum + val, 0);
  }, [startingSlots]);

  const handleToggleStarter = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    const isCurrentlyStarter = starters.includes(playerId);

    if (!isCurrentlyStarter) {
      // 1. Check total starters limit
      if (starters.length >= maxStarters) {
        notify.error(
          "Lineup Limit Reached",
          `You can only select up to ${maxStarters} starters for this sport.`
        );
        return;
      }

      // 2. Check position-specific limit
      const pos = player.position;
      const slotsLimit = startingSlots[pos] ?? 0;
      const currentPosCount = players.filter(
        (p) => starters.includes(p.id) && p.position === pos
      ).length;

      if (currentPosCount >= slotsLimit) {
        notify.error(
          "Position Limit Reached",
          `You can only select up to ${slotsLimit} starters for the ${pos} position.`
        );
        return;
      }
    }

    setStarters((prev) =>
      isCurrentlyStarter ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const handleSave = () => {
    setLineup.mutate({
      teamId,
      starters,
      captainId: captainId ?? undefined,
      formation: "4-4-2",
    });
  };

  const starterCount = starters.length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
      <Card className="facet-hierarchy-child bg-card/40 border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Shirt className="h-5 w-5" style={{ color: teamColor }} />
            Starting XI
            <Badge
              variant="outline"
              className="border-border text-muted-foreground ml-2 text-[10px]"
            >
              {starterCount} selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 max-h-[460px] overflow-y-auto pr-1">
            {[...players]
              .sort((a, b) => {
                const ovrA = (a.ratings as any)?.overall ?? 50;
                const ovrB = (b.ratings as any)?.overall ?? 50;
                return ovrB - ovrA;
              })
              .map((player) => {
                const isStarter = starters.includes(player.id);
                const isCaptain = captainId === player.id;
                const ovr = (player.ratings as any)?.overall ?? 50;

                return (
                  <button
                    key={player.id}
                    onClick={() => handleToggleStarter(player.id)}
                    style={
                      isStarter
                        ? { borderColor: `${teamColor}60`, backgroundColor: `${teamColor}15` }
                        : {}
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                      isStarter
                        ? "text-foreground border-transparent"
                        : "border-border bg-muted/40 hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {player.number && (
                      <span className="text-muted-foreground w-5 text-center text-[10px] font-bold tabular-nums">
                        #{player.number}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {player.firstName} {player.lastName}
                        </span>
                        {isCaptain && <Star className="h-3 w-3 shrink-0 text-amber-400" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <PositionTooltip position={player.position}>
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground cursor-help rounded px-1 py-0 text-[9px]"
                          >
                            {player.position}
                          </Badge>
                        </PositionTooltip>
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            ovr >= 80
                              ? "text-amber-400"
                              : ovr >= 70
                                ? "text-emerald-400"
                                : "text-muted-foreground"
                          )}
                        >
                          {ovr}
                        </span>
                      </div>
                    </div>
                    {isStarter && (
                      <Check className="h-4 w-4 shrink-0" style={{ color: teamColor }} />
                    )}
                    {!isStarter && isCaptain !== false && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptainId(isCaptain ? null : player.id);
                        }}
                        className={cn(
                          "rounded p-1 text-xs transition",
                          isCaptain
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-muted-foreground hover:text-amber-400"
                        )}
                        title={isCaptain ? "Remove captain" : "Set as captain"}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </button>
                );
              })}
          </div>

          <Button
            onClick={handleSave}
            disabled={setLineup.isPending}
            className="w-full text-xs font-semibold transition-all hover:opacity-90"
            size="sm"
            style={{ backgroundColor: teamColor, color: "#ffffff" }}
          >
            {setLineup.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save Lineup
          </Button>
        </CardContent>
      </Card>

      <TeamLineup1
        teamName={teamName}
        teamColor={teamColor}
        players={starterPlayersMapped}
        sportPreset={sportPreset as any}
      />
    </div>
  );
}
