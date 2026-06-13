"use client";

import { Loader2, Dumbbell, Users } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

interface TeamTrainingButtonProps {
  teamId: string;
  playerCount: number;
  onTrained?: () => void;
}

export function TeamTrainingButton({ teamId, playerCount, onTrained }: TeamTrainingButtonProps) {
  const utils = api.useUtils();

  const teamTraining = api.sports.teamTraining.useMutation({
    onSuccess: (data) => {
      utils.sports.getMyClubOverview.invalidate();
      onTrained?.();
    },
  });

  return (
    <Button
      onClick={() => teamTraining.mutate({ teamId })}
      disabled={teamTraining.isPending || playerCount === 0}
      variant="outline"
      size="sm"
      className="w-full gap-2 text-xs"
    >
      {teamTraining.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Dumbbell className="h-3.5 w-3.5" />
      )}
      Team Training Session
      <span className="text-muted-foreground ml-auto">
        <Users className="mr-0.5 inline h-3 w-3" />
        {playerCount} &middot; 100c
      </span>
    </Button>
  );
}
