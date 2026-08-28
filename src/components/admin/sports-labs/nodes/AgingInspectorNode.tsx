import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { ControlSlider as Sliders, Suitcase as Briefcase } from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { processAging, generateTeamRoster, type SportPresetKey } from "~/lib/sports";
import { getPlayerOverall } from "../sports-labs-utils";

interface AgingInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (id: string) => void;
}

export const AgingInspectorNode = React.memo(function AgingInspectorNode({
  isSandbox,
  selectedSport,
  selectedLeagueId,
  setSelectedLeagueId,
  selectedSeasonId,
  setSelectedSeasonId,
}: AgingInspectorNodeProps) {
  const [coachDev, setCoachDev] = useState(70);
  const [agingResults, setAgingResults] = useState<any[]>([]);

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
  const { data: dbDraftPicks } = api.sports.getDraftPicks.useQuery(
    { seasonId: selectedSeasonId },
    { enabled: !!selectedSeasonId }
  );

  const handleSimulateAging = () => {
    const freshPlayers = generateTeamRoster({
      sport: selectedSport,
      rosterSize: 12,
      seed: Date.now(),
    }).map((p, i) => ({
      id: `Player ${i + 1} (${p.firstName} ${p.lastName})`,
      age: p.age,
      careerStage: p.careerStage,
      ratings: p.ratings as Record<string, number>,
    }));

    const coachMap = new Map<string, number>();
    coachMap.set("default", coachDev);

    const results = processAging({
      players: freshPlayers,
      coaches: [],
      coachMap,
      seed: Date.now(),
    });
    setAgingResults(results.playerResults);
  };

  if (isSandbox) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Coach Development Rating: {coachDev}</span>
            </div>
            <Slider
              value={[coachDev]}
              min={1}
              max={99}
              step={1}
              onValueChange={([v]) => setCoachDev(v)}
            />
          </div>

          <Button className="w-full gap-1.5" size="sm" onClick={handleSimulateAging}>
            <Sliders className="h-4 w-4" /> Simulate 1-Year Aging Cycle
          </Button>
        </div>

        {agingResults.length > 0 && (
          <div className="thin-scrollbar max-h-[280px] space-y-2 overflow-y-auto pr-1">
            <h5 className="text-muted-foreground text-xs font-bold uppercase">Aging Results</h5>
            {agingResults.map((r, i) => (
              <div
                key={i}
                className="bg-muted/20 flex items-center justify-between rounded border p-2 text-xs"
              >
                <div>
                  <p className="font-semibold">{r.playerId}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {r.oldStage} &rarr; {r.newStage}
                  </p>
                </div>
                {r.retired ? (
                  <Badge variant="destructive">Retired</Badge>
                ) : (
                  <div className="flex gap-1">
                    {Object.entries((r.ratingChanges || {}) as Record<string, number>)
                      .slice(0, 2)
                      .map(([k, v]) => (
                        <Badge
                          key={k}
                          variant="secondary"
                          className={cn(
                            "font-mono text-[9px]",
                            v >= 0 ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {k} {v >= 0 ? `+${v}` : v}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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

      {dbSeason && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
          <h5 className="flex items-center gap-1 font-semibold text-amber-400">
            🏆 Quadrennial World Cup Cycle
          </h5>
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Current Season:</span>
            <span className="text-foreground font-bold">Season {dbSeason.seasonNumber}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Next Season:</span>
            <span className="text-foreground font-bold">Season {dbSeason.seasonNumber + 1}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Cycle Status:</span>
            <Badge
              variant="outline"
              className={cn(
                "px-1 text-[9px] font-semibold",
                (dbSeason.seasonNumber + 1) % 4 === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-border text-muted-foreground"
              )}
            >
              {(dbSeason.seasonNumber + 1) % 4 === 0
                ? "🏆 World Cup Year!"
                : "Domestic League Season"}
            </Badge>
          </div>
          <p className="text-muted-foreground/80 border-border/20 border-t pt-1 text-[9px] leading-relaxed">
            At season transition, if it is a World Cup year, national squads will be drafted
            automatically from top-performing citizens.
          </p>
        </div>
      )}

      {dbDraftPicks && dbDraftPicks.length > 0 ? (
        <div className="thin-scrollbar max-h-[200px] space-y-2 overflow-y-auto pr-1">
          <h5 className="flex items-center gap-1 text-xs font-semibold">
            <Briefcase className="text-primary h-4 w-4" />
            Draft Picks recorded ({dbDraftPicks.length})
          </h5>
          {dbDraftPicks.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded border p-2 text-xs"
            >
              <div>
                <span className="text-muted-foreground mr-1 font-bold">
                  R{p.round} P{p.pickNumber}
                </span>
                <span className="text-foreground font-semibold">
                  {p.player?.firstName} {p.player?.lastName}
                </span>
                <p className="text-muted-foreground flex items-center gap-1 text-[9px]">
                  {p.player?.position ? (
                    <PositionTooltip position={p.player.position}>
                      <span className="hover:text-foreground cursor-help font-medium transition-colors">
                        {p.player.position}
                      </span>
                    </PositionTooltip>
                  ) : (
                    "-"
                  )}{" "}
                  &middot; Rating: {p.player ? getPlayerOverall(p.player.ratings) : "-"}
                </p>
              </div>
              <Badge variant="outline">{p.team.name}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-6 text-center text-xs">
          No draft picks/transfers found for this season.
        </p>
      )}
    </div>
  );
});
