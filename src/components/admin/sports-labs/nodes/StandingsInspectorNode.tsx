import React from "react";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { SportPresetKey } from "~/lib/sports";

interface StandingsInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (id: string) => void;
}

export const StandingsInspectorNode = React.memo(function StandingsInspectorNode({
  isSandbox,
  selectedLeagueId,
  setSelectedLeagueId,
  selectedSeasonId,
  setSelectedSeasonId,
}: StandingsInspectorNodeProps) {
  // DB queries
  const { data: dbLeagues } = api.sports.getLeagues.useQuery({});
  const { data: dbLeague } = api.sports.getLeague.useQuery(
    { id: selectedLeagueId },
    { enabled: !!selectedLeagueId }
  );
  const { data: dbSeason } = api.sports.getSeason.useQuery(
    { id: selectedSeasonId },
    { enabled: !!selectedSeasonId }
  );

  if (isSandbox) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          Standings node displays cumulative stats (Wins, Losses, Draws, Points). In Sandbox,
          standings can be simulated locally from schedule runs.
        </p>
        <div className="text-muted-foreground bg-muted/30 rounded border p-3 text-center text-xs">
          Click Match Resolver Node to run sandbox matches and view simulator outputs.
        </div>
      </div>
    );
  }

  // DB Mode
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Select League</Label>
        <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose league" />
          </SelectTrigger>
          <SelectContent>
            {dbLeagues?.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dbLeague && dbLeague.seasons && (
        <div className="space-y-1.5">
          <Label>Select Season</Label>
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose season" />
            </SelectTrigger>
            <SelectContent>
              {dbLeague.seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Season {s.seasonNumber} ({s.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {dbSeason && dbSeason.standings && (
        <div className="space-y-3">
          {dbLeague && (
            <div className="bg-muted/20 space-y-1 rounded border p-2.5 text-[10px]">
              <p className="text-muted-foreground flex items-center justify-between font-semibold">
                <span>League Division Tier: {(dbLeague as any).tier ?? 1}</span>
                <Badge variant="outline" className="border-primary/20 text-primary text-[9px]">
                  Pyramid Level
                </Badge>
              </p>
              {(dbLeague as any).parentLeague && (
                <p className="font-medium text-emerald-400/90">
                  ▲ Superior League: {(dbLeague as any).parentLeague.name}
                </p>
              )}
              {(dbLeague as any).subLeagues && (dbLeague as any).subLeagues.length > 0 && (
                <p className="font-medium text-red-400/90">
                  ▼ Sub-Leagues: {(dbLeague as any).subLeagues.map((l: any) => l.name).join(", ")}
                </p>
              )}
              <p className="text-muted-foreground text-[9px]">
                Zone rules: Top {(dbLeague as any).promotionCount ?? 3} Promoted / Bottom{" "}
                {(dbLeague as any).relegationCount ?? 3} Relegated
              </p>
            </div>
          )}

          <div className="thin-scrollbar max-h-[260px] space-y-2 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-[10px]">#</TableHead>
                  <TableHead className="text-[10px]">Team</TableHead>
                  <TableHead className="text-center text-[10px]">W-L-D</TableHead>
                  <TableHead className="text-center text-[10px]">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dbSeason.standings.map((s, i) => {
                  const promotionCount = (dbLeague as any)?.promotionCount ?? 3;
                  const relegationCount = (dbLeague as any)?.relegationCount ?? 3;
                  const totalTeams = dbSeason.standings.length;

                  const isPromotionZone = i < promotionCount && (dbLeague as any)?.parentLeague;
                  const isRelegationZone =
                    i >= totalTeams - relegationCount && (dbLeague as any)?.subLeagues?.length > 0;

                  return (
                    <TableRow
                      key={s.id}
                      className={cn(
                        isPromotionZone &&
                          "border-l-2 border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10",
                        isRelegationZone &&
                          "border-l-2 border-l-red-500 bg-red-500/5 hover:bg-red-500/10"
                      )}
                    >
                      <TableCell className="text-xs font-semibold">{s.rank ?? i + 1}</TableCell>
                      <TableCell className="flex max-w-[120px] items-center gap-1 truncate text-xs font-medium">
                        {s.team.name}
                        {isPromotionZone && (
                          <span className="rounded bg-emerald-500/15 px-1 text-[8px] font-semibold text-emerald-400">
                            Prom
                          </span>
                        )}
                        {isRelegationZone && (
                          <span className="rounded bg-red-500/15 px-1 text-[8px] font-semibold text-red-400">
                            Releg
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px]">
                        {s.wins}-{s.losses}-{s.draws}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold">{s.points}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
});
