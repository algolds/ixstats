import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Trash as Trash2, Refresh as RefreshCw, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface PendingConfirm {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface LeagueAdvancedTabProps {
  league: {
    id: string;
    teams?: Array<{ id: string; name: string }>;
  };
  activeSeason: {
    id: string;
    seasonNumber: number;
    matches?: any[];
  } | null;
  gamesPerSeason: number;
  setGamesPerSeason: (v: number) => void;
  doubleRoundRobin: boolean;
  setDoubleRoundRobin: (v: boolean) => void;
  playoffFormat: string;
  setPlayoffFormat: (v: string) => void;
  seed: string;
  setSeed: (v: string) => void;
  onEditTeam?: (teamId: string) => void;
  onOpenRoster?: (teamId: string) => void;
  onOpenChange: (open: boolean) => void;
}

export const LeagueAdvancedTab = React.memo(function LeagueAdvancedTab({
  league,
  activeSeason,
  gamesPerSeason,
  setGamesPerSeason,
  doubleRoundRobin,
  setDoubleRoundRobin,
  playoffFormat,
  setPlayoffFormat,
  seed,
  setSeed,
  onEditTeam,
  onOpenRoster,
  onOpenChange,
}: LeagueAdvancedTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [forceEditTeamId, setForceEditTeamId] = useState("");
  const [overrideMatchId, setOverrideMatchId] = useState("");
  const [overrideHomeScore, setOverrideHomeScore] = useState(0);
  const [overrideAwayScore, setOverrideAwayScore] = useState(0);
  const [transferTeamId, setTransferTeamId] = useState("");
  const [transferTargetLeagueId, setTransferTargetLeagueId] = useState("");

  const { data: otherLeagues } = api.sports.getLeagues.useQuery({});

  const activeMatches = activeSeason?.matches ?? [];

  const resetSeason = api.sports.resetSeason.useMutation({
    onSuccess: () => {
      notify.success("Season reset successfully");
      void utils.sports.getLeague.invalidate({ id: league.id });
    },
    onError: (err) => notify.error(err.message),
  });

  const regenerateSchedule = api.sports.regenerateSchedule.useMutation({
    onSuccess: () => {
      notify.success("Matches regenerated successfully");
      void utils.sports.getLeague.invalidate({ id: league.id });
    },
    onError: (err) => notify.error(err.message),
  });

  const overrideMatchResult = api.sports.overrideMatchResult.useMutation({
    onSuccess: () => {
      notify.success("Match score saved and standings recalculated");
      void utils.sports.getLeague.invalidate({ id: league.id });
    },
    onError: (err) => notify.error(err.message),
  });

  const transferTeam = api.sports.transferTeam.useMutation({
    onSuccess: () => {
      notify.success("Team transferred successfully");
      setTransferTeamId("");
      setTransferTargetLeagueId("");
      void utils.sports.getLeague.invalidate({ id: league.id });
    },
    onError: (err) => notify.error(err.message),
  });

  return (
    <div className="thin-scrollbar max-h-[350px] space-y-5 overflow-y-auto pr-2">
      {/* 1. Roster Editor */}
      <div className="space-y-2">
        <Label className="text-subhead text-label-secondary">Force-Edit Team</Label>
        <div className="flex gap-2">
          <Select value={forceEditTeamId} onValueChange={setForceEditTeamId}>
            <SelectTrigger className="text-footnote h-9 flex-1">
              <SelectValue placeholder="Select team to edit..." />
            </SelectTrigger>
            <SelectContent>
              {league.teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!forceEditTeamId}
            onClick={() => {
              if (forceEditTeamId && onEditTeam) {
                onEditTeam(forceEditTeamId);
                onOpenChange(false);
              }
            }}
            className="text-footnote"
          >
            Rename / Brand
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!forceEditTeamId}
            onClick={() => {
              if (forceEditTeamId && onOpenRoster) {
                onOpenRoster(forceEditTeamId);
                onOpenChange(false);
              }
            }}
            className="text-footnote"
          >
            Roster
          </Button>
        </div>
        <p className="text-label-secondary text-footnote">
          As league creator you can rename, recolor, and rebrand any team here.
        </p>
      </div>

      {/* 2. Active Season Actions */}
      {activeSeason && (
        <div className="border-separator space-y-3 border-t pt-4">
          <Label className="text-subhead text-label-secondary">
            Season Operations (Season {activeSeason.seasonNumber})
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={resetSeason.isPending}
              onClick={() =>
                setPendingConfirm({
                  title: "Reset the current season?",
                  description:
                    "This will permanently delete all matches, standings, brackets, and races for the current season. Roster data is preserved.",
                  actionLabel: "Reset Season",
                  destructive: true,
                  onConfirm: () => resetSeason.mutate({ seasonId: activeSeason.id }),
                })
              }
            >
              {resetSeason.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Reset Current Season
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={regenerateSchedule.isPending}
              onClick={() =>
                setPendingConfirm({
                  title: "Regenerate matches?",
                  description:
                    "This will delete all matches and regenerate a fresh schedule of matches. This can only be done if no matches have been played yet.",
                  actionLabel: "Regenerate",
                  onConfirm: () => regenerateSchedule.mutate({ seasonId: activeSeason.id }),
                })
              }
            >
              {regenerateSchedule.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Regenerate Matches
            </Button>
          </div>
        </div>
      )}

      {/* 3. Custom Simulation Rules */}
      <div className="border-separator space-y-3 border-t pt-4">
        <Label className="text-subhead text-label-secondary">Custom Engine Rules</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="games-per-season" className="text-footnote">
              Games Per Season
            </Label>
            <Input
              id="games-per-season"
              type="number"
              min={1}
              value={gamesPerSeason}
              onChange={(e) => setGamesPerSeason(Math.max(1, Number(e.target.value) || 14))}
              className="text-footnote h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="double-rr" className="text-footnote">
              Double Round Robin
            </Label>
            <Select
              value={doubleRoundRobin ? "true" : "false"}
              onValueChange={(val) => setDoubleRoundRobin(val === "true")}
            >
              <SelectTrigger id="double-rr" className="text-footnote h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No (Single RR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="playoff-format" className="text-footnote">
              Playoff Format
            </Label>
            <Select value={playoffFormat} onValueChange={setPlayoffFormat}>
              <SelectTrigger id="playoff-format" className="text-footnote h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Playoffs (Table Winner)</SelectItem>
                <SelectItem value="finals">Top 2 (Finals Only)</SelectItem>
                <SelectItem value="semi_finals">Top 4 (Semifinals & Finals)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rng-seed" className="text-footnote">
              RNG Seed Override
            </Label>
            <Input
              id="rng-seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Automatic RNG seed..."
              className="text-footnote h-8 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* 4. Manual Result Override */}
      {activeSeason && activeMatches.length > 0 && (
        <div className="border-separator space-y-3 border-t pt-4">
          <Label className="text-subhead text-label-secondary">Manual Result Override</Label>
          <div className="space-y-2">
            <Select value={overrideMatchId} onValueChange={setOverrideMatchId}>
              <SelectTrigger className="text-footnote h-9">
                <SelectValue placeholder="Select match to override..." />
              </SelectTrigger>
              <SelectContent>
                {activeMatches.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    Md {m.matchDay}: {m.homeTeam.name} {m.homeScore ?? "?"} - {m.awayScore ?? "?"}{" "}
                    {m.awayTeam.name} ({m.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {overrideMatchId && (
              <div className="bg-fill-4 border-separator rounded-control space-y-3 border p-3">
                <div className="flex items-center justify-around gap-2">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-label-secondary text-footnote w-full truncate text-center font-semibold">
                      {activeMatches.find((m: any) => m.id === overrideMatchId)?.homeTeam.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={overrideHomeScore}
                      onChange={(e) =>
                        setOverrideHomeScore(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="text-headline h-9 w-16 text-center"
                    />
                  </div>
                  <span className="text-label-tertiary text-headline">VS</span>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-label-secondary text-footnote w-full truncate text-center font-semibold">
                      {activeMatches.find((m: any) => m.id === overrideMatchId)?.awayTeam.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={overrideAwayScore}
                      onChange={(e) =>
                        setOverrideAwayScore(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="text-headline h-9 w-16 text-center"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={overrideMatchResult.isPending}
                  onClick={() =>
                    setPendingConfirm({
                      title: "Force set this score?",
                      description: "Standings will be automatically recalculated.",
                      actionLabel: "Save Score",
                      onConfirm: () =>
                        overrideMatchResult.mutate({
                          matchId: overrideMatchId,
                          homeScore: overrideHomeScore,
                          awayScore: overrideAwayScore,
                        }),
                    })
                  }
                  className="w-full"
                >
                  {overrideMatchResult.isPending && <Loader2 className="animate-spin" />}
                  Save Overridden Score
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Transfer / Swap Teams */}
      <div className="border-separator space-y-3 border-t pt-4">
        <Label className="text-subhead text-label-secondary">Transfer Team to League</Label>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={transferTeamId} onValueChange={setTransferTeamId}>
              <SelectTrigger className="text-footnote h-9">
                <SelectValue placeholder="Select team..." />
              </SelectTrigger>
              <SelectContent>
                {league.teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={transferTargetLeagueId} onValueChange={setTransferTargetLeagueId}>
              <SelectTrigger className="text-footnote h-9">
                <SelectValue placeholder="Target league..." />
              </SelectTrigger>
              <SelectContent>
                {otherLeagues
                  ?.filter((l) => l.id !== league.id)
                  ?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!transferTeamId || !transferTargetLeagueId || transferTeam.isPending}
            onClick={() => {
              const teamName = league.teams?.find((t) => t.id === transferTeamId)?.name;
              const targetName = otherLeagues?.find((l) => l.id === transferTargetLeagueId)?.name;
              setPendingConfirm({
                title: "Transfer this team?",
                description: `Are you sure you want to move the team "${teamName}" to "${targetName}"?`,
                actionLabel: "Transfer",
                onConfirm: () =>
                  transferTeam.mutate({
                    teamId: transferTeamId,
                    targetLeagueId: transferTargetLeagueId,
                  }),
              });
            }}
            className="w-full"
          >
            {transferTeam.isPending && <Loader2 className="animate-spin" />}
            Execute Transfer
          </Button>
        </div>
      </div>

      <AlertDialog
        open={!!pendingConfirm}
        onOpenChange={(open) => !open && setPendingConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingConfirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingConfirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingConfirm?.destructive ? "destructive" : "filled"}
              onClick={() => pendingConfirm?.onConfirm()}
            >
              {pendingConfirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
