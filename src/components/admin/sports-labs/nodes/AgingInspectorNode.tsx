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
            <div className="text-footnote flex justify-between">
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

          <Button className="w-full gap-2" size="sm" onClick={handleSimulateAging}>
            <Sliders className="h-4 w-4" /> Simulate 1-Year Aging Cycle
          </Button>
        </div>

        {agingResults.length > 0 && (
          <div className="thin-scrollbar max-h-[280px] space-y-2 overflow-y-auto pr-1">
            <h5 className="text-label-secondary text-subhead">Aging results</h5>
            {agingResults.map((r, i) => (
              <div
                key={i}
                className="bg-fill-4 rounded-control-sm text-footnote flex items-center justify-between border p-2"
              >
                <div>
                  <p className="font-semibold">{r.playerId}</p>
                  <p className="text-label-secondary text-footnote">
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
                          variant="default"
                          className={cn(
                            "text-footnote tabular-nums",
                            v >= 0 ? "text-green" : "text-red"
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
      <div className="space-y-2">
        <Label>Select league</Label>
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
        <div className="space-y-2">
          <Label>Select season</Label>
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
        <div className="rounded-control border-yellow/20 bg-yellow/5 text-footnote space-y-2 border p-3">
          <h5 className="text-yellow flex items-center gap-1 font-semibold">
            🏆 Quadrennial World Cup Cycle
          </h5>
          <div className="text-label-secondary text-footnote flex justify-between">
            <span>Current Season:</span>
            <span className="text-label font-semibold">Season {dbSeason.seasonNumber}</span>
          </div>
          <div className="text-label-secondary text-footnote flex justify-between">
            <span>Next Season:</span>
            <span className="text-label font-semibold">Season {dbSeason.seasonNumber + 1}</span>
          </div>
          <div className="text-label-secondary text-footnote flex justify-between">
            <span>Cycle Status:</span>
            <Badge
              variant="outline"
              className={cn(
                "text-caption px-1",
                (dbSeason.seasonNumber + 1) % 4 === 0
                  ? "border-green/30 bg-green/10 text-green"
                  : "border-separator text-label-secondary"
              )}
            >
              {(dbSeason.seasonNumber + 1) % 4 === 0
                ? "🏆 World Cup Year!"
                : "Domestic League Season"}
            </Badge>
          </div>
          <p className="text-label-secondary border-separator text-footnote border-t pt-1 leading-relaxed">
            At season transition, if it is a World Cup year, national squads will be drafted
            automatically from top-performing citizens.
          </p>
        </div>
      )}

      {dbDraftPicks && dbDraftPicks.length > 0 ? (
        <div className="thin-scrollbar max-h-[200px] space-y-2 overflow-y-auto pr-1">
          <h5 className="text-caption flex items-center gap-1">
            <Briefcase className="text-tint h-4 w-4" />
            Draft Picks recorded ({dbDraftPicks.length})
          </h5>
          {dbDraftPicks.map((p: any) => (
            <div
              key={p.id}
              className="rounded-control-sm text-footnote flex items-center justify-between border p-2"
            >
              <div>
                <span className="text-label-secondary mr-1 font-semibold">
                  R{p.round} P{p.pickNumber}
                </span>
                <span className="text-label font-semibold">
                  {p.player?.firstName} {p.player?.lastName}
                </span>
                <p className="text-label-secondary text-footnote flex items-center gap-1">
                  {p.player?.position ? (
                    <PositionTooltip position={p.player.position}>
                      <span className="hover:text-label cursor-help font-medium transition-colors">
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
        <p className="text-label-secondary text-footnote py-6 text-center">
          No draft picks/transfers found for this season.
        </p>
      )}
    </div>
  );
});
