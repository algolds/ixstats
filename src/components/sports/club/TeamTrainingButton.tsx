"use client";

import { SystemRestart as Loader2, Gym as Dumbbell, Group as Users } from "iconoir-react";
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
    // oxlint-disable-next-line eslint/no-unused-vars
    onSuccess: (data) => {
      utils.sports.getMyClubOverview.invalidate({ teamId });
      onTrained?.();
    },
  });

  return (
    <Button
      onClick={() => teamTraining.mutate({ teamId })}
      disabled={teamTraining.isPending || playerCount === 0}
      variant="secondary"
      className="w-full"
    >
      {teamTraining.isPending ? <Loader2 className="animate-spin" /> : <Dumbbell />}
      Team Training Session
      <span className="text-label-secondary text-footnote ml-auto tabular-nums">
        <Users className="mr-0.5 inline size-3.5" aria-hidden />
        {playerCount} &middot; 100c
      </span>
    </Button>
  );
}
