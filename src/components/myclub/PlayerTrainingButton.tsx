"use client";

import { useState } from "react";
import { Loader2, Dumbbell, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

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
  teamId: _teamId,
  attributes,
  currentRatings,
  onTrained,
}: PlayerTrainingButtonProps) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const trainPlayer = api.sports.trainPlayer.useMutation({
    onSuccess: () => {
      utils.sports.getMyClubOverview.invalidate();
      onTrained?.();
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-muted-foreground hover:text-foreground h-7 px-2 text-[10px]"
        )}
      >
        <Dumbbell className="mr-1 h-3 w-3" />
        Train
      </PopoverTrigger>

      <PopoverContent className="border-border bg-card pointer-events-auto w-52 rounded-xl border p-3 shadow-xl backdrop-blur-xl">
        <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          Focus Attribute
        </p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {attributes.map((attr) => {
            const val = currentRatings[attr] ?? 50;
            return (
              <button
                key={attr}
                disabled={trainPlayer.isPending}
                onClick={() => {
                  trainPlayer.mutate({ playerId, attributeFocus: attr });
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-muted flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition",
                  trainPlayer.isPending && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="capitalize">{attr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded px-1 py-0 text-[9px] font-bold",
                      val >= 80
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : val >= 70
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-muted bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {val}
                  </Badge>
                  <span className="text-muted-foreground text-[9px]">25c</span>
                </div>
              </button>
            );
          })}
        </div>
        {trainPlayer.isPending && (
          <div className="mt-2 flex items-center justify-center">
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
