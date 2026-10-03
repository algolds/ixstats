"use client";

import { useState } from "react";
import { SystemRestart as Loader2, Gym as Dumbbell, StatUp as TrendingUp } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";

interface PlayerTrainingButtonProps {
  playerId: string;
  playerName: string;
  teamId: string;
  attributes: string[];
  currentRatings: Record<string, number>;
  onTrained?: () => void;
}

export function PlayerTrainingButton({
  playerId,
  playerName: _playerName,
  teamId,
  attributes,
  currentRatings,
  onTrained,
}: PlayerTrainingButtonProps) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const trainPlayer = api.sports.trainPlayer.useMutation({
    onSuccess: () => {
      utils.sports.getMyClubOverview.invalidate({ teamId });
      onTrained?.();
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
        <Dumbbell />
        Train
      </PopoverTrigger>

      <PopoverContent className="pointer-events-auto w-56 p-3">
        <p className="text-subhead text-label-secondary mb-2">Focus attribute</p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {attributes.map((attr) => {
            const val = currentRatings[attr];
            return (
              <Button
                variant="ghost"
                key={attr}
                disabled={trainPlayer.isPending}
                onClick={() => {
                  trainPlayer.mutate({ playerId, attributeFocus: attr });
                  setOpen(false);
                }}
                className="text-body text-label h-auto w-full justify-between px-2 py-2 font-normal"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-green size-3.5" aria-hidden />
                  <span className="capitalize">{attr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className="tabular-nums"
                    variant={
                      val === undefined
                        ? "default"
                        : val >= 80
                          ? "warning"
                          : val >= 70
                            ? "success"
                            : "default"
                    }
                  >
                    {val ?? "—"}
                  </Badge>
                  <span className="text-label-secondary text-footnote tabular-nums">25c</span>
                </div>
              </Button>
            );
          })}
        </div>
        {trainPlayer.isPending && (
          <div className="mt-2 flex items-center justify-center">
            <Loader2 className="text-label-secondary size-3.5 animate-spin" aria-label="Training" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
