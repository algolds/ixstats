import { LeagueSeasonPicker } from "./LeagueSeasonPicker";
import React from "react";
import { Badge } from "~/components/ui/badge";
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
        <p className="text-label-secondary text-footnote">
          Standings node displays cumulative stats (Wins, Losses, Draws, Points). In Sandbox,
          standings can be simulated locally from schedule runs.
        </p>
        <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote border p-3 text-center">
          Click Match Resolver Node to run sandbox matches and view simulator outputs.
        </div>
      </div>
    );
  }

  // DB Mode
  return (
    <div className="space-y-4">
      <LeagueSeasonPicker
        selectedLeagueId={selectedLeagueId}
        setSelectedLeagueId={setSelectedLeagueId}
        selectedSeasonId={selectedSeasonId}
        setSelectedSeasonId={setSelectedSeasonId}
      />

      {dbSeason && dbSeason.standings && (
        <div className="space-y-3">
          {dbLeague && (
            <div className="bg-fill-4 rounded-control-sm text-footnote space-y-1 border p-3">
              <p className="text-label-secondary flex items-center justify-between font-semibold">
                <span>League Division Tier: {(dbLeague as any).tier ?? 1}</span>
                <Badge variant="outline" className="border-tint/20 text-tint">
                  Pyramid level
                </Badge>
              </p>
              {(dbLeague as any).parentLeague && (
                <p className="text-green font-medium">
                  ▲ Superior League: {(dbLeague as any).parentLeague.name}
                </p>
              )}
              {(dbLeague as any).subLeagues && (dbLeague as any).subLeagues.length > 0 && (
                <p className="text-red font-medium">
                  ▼ Sub-Leagues: {(dbLeague as any).subLeagues.map((l: any) => l.name).join(", ")}
                </p>
              )}
              <p className="text-label-secondary text-footnote">
                Zone rules: Top {(dbLeague as any).promotionCount ?? 3} Promoted / Bottom{" "}
                {(dbLeague as any).relegationCount ?? 3} Relegated
              </p>
            </div>
          )}

          <Table containerClassName="max-h-[260px]">
            <TableHeader sticky>
              <TableRow>
                <TableHead className="text-footnote w-10">#</TableHead>
                <TableHead className="text-footnote">Team</TableHead>
                <TableHead className="text-footnote text-center">W-L-D</TableHead>
                <TableHead className="text-footnote text-center">Pts</TableHead>
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
                      isPromotionZone && "border-l-green bg-green/5 hover:bg-green/10 border-l-2",
                      isRelegationZone && "border-l-red bg-red/5 hover:bg-red/10 border-l-2"
                    )}
                  >
                    <TableCell className="text-caption">{s.rank ?? i + 1}</TableCell>
                    <TableCell className="text-caption flex max-w-[120px] items-center gap-1 truncate">
                      {s.team.name}
                      {isPromotionZone && <Badge variant="success">Prom</Badge>}
                      {isRelegationZone && <Badge variant="destructive">Releg</Badge>}
                    </TableCell>
                    <TableCell className="text-footnote text-center tabular-nums">
                      {s.wins}-{s.losses}-{s.draws}
                    </TableCell>
                    <TableCell className="text-caption text-center">{s.points}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});
