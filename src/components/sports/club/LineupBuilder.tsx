"use client";

import { useState, useMemo } from "react";
import { SystemRestart as Loader2, Shop as Shirt, Star, Check } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TeamLineup } from "~/components/sports/TeamLineup";
import { useNotify } from "~/hooks/useNotify";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import type { SportPreset } from "~/lib/sports/presets";

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
    ratings?: Record<string, number | undefined> | null;
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
        overallRating: (p.ratings as Record<string, number> | undefined)?.overall,
      }));
  }, [players, starters]);

  const setLineup = api.sports.setLineup.useMutation({
    onSuccess: () => {
      onSaved?.();
    },
  });

  const startingSlots: Record<string, number> =
    (preset?.startingSlots as Record<string, number>) ?? {};

  const maxStarters: number = useMemo(() => {
    return Object.values(startingSlots).reduce((sum: number, val: number) => sum + val, 0);
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
      <Card className="flex h-full flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shirt className="text-label-secondary size-5" aria-hidden />
            Starting XI
            <Badge variant="default" className="ml-2 tabular-nums">
              {starterCount} selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid max-h-[460px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {[...players]
              .sort((a, b) => {
                const ovrA = a.ratings?.overall ?? 50;
                const ovrB = b.ratings?.overall ?? 50;
                return ovrB - ovrA;
              })
              .map((player) => {
                const isStarter = starters.includes(player.id);
                const isCaptain = captainId === player.id;
                const ovr = player.ratings?.overall;

                return (
                  <div
                    key={player.id}
                    className={cn(
                      "rounded-row duration-fast ease-out-facet flex items-center gap-1 border pe-1 transition-colors",
                      isStarter
                        ? "border-tint/40 bg-tint-fill"
                        : "border-separator bg-surface-secondary"
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isStarter}
                      onClick={() => handleToggleStarter(player.id)}
                      className="focus-visible:outline-tint text-label rounded-row flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
                    >
                      {player.number && (
                        <span className="text-label-secondary text-footnote w-6 text-center font-medium tabular-nums">
                          #{player.number}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-body truncate font-medium">
                            {player.firstName} {player.lastName}
                          </span>
                          {isCaptain && (
                            <Star className="text-yellow size-3.5 shrink-0" aria-label="Captain" />
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <PositionTooltip position={player.position}>
                            <Badge variant="default" className="cursor-help">
                              {player.position}
                            </Badge>
                          </PositionTooltip>
                          <span
                            className={cn(
                              "text-footnote font-semibold tabular-nums",
                              ovr !== undefined && ovr >= 80
                                ? "text-yellow"
                                : ovr !== undefined && ovr >= 70
                                  ? "text-green"
                                  : "text-label-secondary"
                            )}
                          >
                            {ovr ?? <span aria-label="Not recorded">—</span>}
                          </span>
                        </div>
                      </div>
                      {isStarter && <Check className="text-tint size-4 shrink-0" aria-hidden />}
                    </button>
                    {!isStarter && isCaptain !== false && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setCaptainId(isCaptain ? null : player.id)}
                        className={isCaptain ? "text-yellow" : "text-label-secondary"}
                        title={isCaptain ? "Remove captain" : "Set as captain"}
                        aria-label={isCaptain ? "Remove captain" : "Set as captain"}
                      >
                        <Star />
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>

          <Button onClick={handleSave} disabled={setLineup.isPending} className="w-full" size="sm">
            {setLineup.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Save lineup
          </Button>
        </CardContent>
      </Card>

      <TeamLineup
        teamName={teamName}
        teamColor={teamColor}
        players={starterPlayersMapped}
        sportPreset={sportPreset}
      />
    </div>
  );
}
