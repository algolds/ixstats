"use client";

import { Upload, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

/** "Publish to wiki": writes the league's standings into its wiki article, as the signed-in manager. */
export function PublishStandingsButton({ leagueId }: { leagueId: string }) {
  const notify = useNotify();
  const publish = api.sports.publishStandingsToWiki.useMutation({
    onSuccess: (result) => {
      if (result.success) notify.success("Standings published to the wiki");
      else notify.warning("The article changed while you were publishing. Try again.");
    },
    onError: (err) => notify.error(err.message || "Could not publish the standings"),
  });

  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={publish.isPending}
      onClick={() => publish.mutate({ leagueId })}
      className="text-label-secondary"
    >
      {publish.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
      <span>Publish to wiki</span>
    </Button>
  );
}
