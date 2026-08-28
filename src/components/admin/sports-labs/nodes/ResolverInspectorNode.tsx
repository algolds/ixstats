import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
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
import { Play, StatUp as TrendingUp } from "iconoir-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { resolveMatch, type SportPresetKey } from "~/lib/sports";

interface ResolverInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (id: string) => void;
}

export const ResolverInspectorNode = React.memo(function ResolverInspectorNode({
  isSandbox,
  selectedSport,
  selectedLeagueId,
  setSelectedLeagueId,
  selectedSeasonId,
  setSelectedSeasonId,
}: ResolverInspectorNodeProps) {
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [teamAOverall, setTeamAOverall] = useState(65);
  const [teamBOverall, setTeamBOverall] = useState(60);
  const [homeAdvantage, setHomeAdvantage] = useState(55);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [simulationResults, setSimulationResults] = useState<any>(null);

  // Sandbox storytelling modifiers
  const [homeSaint, setHomeSaint] = useState<string>("none");
  const [awaySaint, setAwaySaint] = useState<string>("none");
  const [homeScandal, setHomeScandal] = useState<boolean>(false);
  const [awayScandal, setAwayScandal] = useState<boolean>(false);

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

  const createRatingVector = (overall: number) => ({
    overall,
    offense: overall,
    defense: overall,
    form: 50,
    depth: 50,
    coaching: 50,
  });

  const handleSimulateSingleMatch = () => {
    const res = resolveMatch({
      sport: selectedSport,
      homeTeam: createRatingVector(teamAOverall),
      awayTeam: createRatingVector(teamBOverall),
      archetype: "league",
      seed: Date.now(),
      context: { homeAdvantage },
      homeTeamModifiers: {
        saintBlessing: homeSaint !== "none" ? 5 : undefined,
        countryScandal: homeScandal ? 8 : undefined,
      },
      awayTeamModifiers: {
        saintBlessing: awaySaint !== "none" ? 5 : undefined,
        countryScandal: awayScandal ? 8 : undefined,
      },
    });
    setSingleResult(res);
  };

  const handleSimulate100Matches = () => {
    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    let goalsA = 0;
    let goalsB = 0;

    for (let i = 0; i < 100; i++) {
      const res = resolveMatch({
        sport: selectedSport,
        homeTeam: createRatingVector(teamAOverall),
        awayTeam: createRatingVector(teamBOverall),
        archetype: "league",
        seed: Date.now() + i,
        context: { homeAdvantage },
        homeTeamModifiers: {
          saintBlessing: homeSaint !== "none" ? 5 : undefined,
          countryScandal: homeScandal ? 8 : undefined,
        },
        awayTeamModifiers: {
          saintBlessing: awaySaint !== "none" ? 5 : undefined,
          countryScandal: awayScandal ? 8 : undefined,
        },
      });
      goalsA += res.homeScore;
      goalsB += res.awayScore;
      if (res.homeScore > res.awayScore) winsA++;
      else if (res.awayScore > res.homeScore) winsB++;
      else draws++;
    }

    setSimulationResults({
      winsA,
      winsB,
      draws,
      avgGoalsA: (goalsA / 100).toFixed(2),
      avgGoalsB: (goalsB / 100).toFixed(2),
    });
  };

  if (isSandbox) {
    const data = simulationResults
      ? [
          { name: `${teamAName} Wins`, value: simulationResults.winsA, fill: "#3b82f6" },
          { name: "Draws", value: simulationResults.draws, fill: "#64748b" },
          { name: `${teamBName} Wins`, value: simulationResults.winsB, fill: "#f43f5e" },
        ]
      : [];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Home Team Name</Label>
            <Input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Away Team Name</Label>
            <Input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Home Overall: {teamAOverall}</span>
            </div>
            <Slider
              value={[teamAOverall]}
              min={1}
              max={99}
              step={1}
              onValueChange={([v]) => setTeamAOverall(v)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Away Overall: {teamBOverall}</span>
            </div>
            <Slider
              value={[teamBOverall]}
              min={1}
              max={99}
              step={1}
              onValueChange={([v]) => setTeamBOverall(v)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Home Advantage Weight: {homeAdvantage}</span>
            </div>
            <Slider
              value={[homeAdvantage]}
              min={50}
              max={60}
              step={1}
              onValueChange={([v]) => setHomeAdvantage(v)}
            />
          </div>
        </div>

        {/* Spiritual Blessings & Storyteller Modifiers */}
        <div className="border-border/40 grid grid-cols-2 gap-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-amber-500/80 uppercase">
              Home Saint Blessing
            </Label>
            <Select value={homeSaint} onValueChange={setHomeSaint}>
              <SelectTrigger className="bg-background/50 h-8 border-amber-500/20 text-xs">
                <SelectValue placeholder="Select Saint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Blessing</SelectItem>
                <SelectItem value="Saint Rais">Saint Rais (+5 ELO)</SelectItem>
                <SelectItem value="Saint Inonsia">Saint Inonsia (+5 ELO)</SelectItem>
                <SelectItem value="Saint Magador">Saint Magador (+5 ELO)</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                id="homeScandal"
                checked={homeScandal}
                onChange={(e) => setHomeScandal(e.target.checked)}
                className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded"
              />
              <label
                htmlFor="homeScandal"
                className="text-muted-foreground cursor-pointer text-[10px] select-none"
              >
                Country Scandal (-8 ELO)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-amber-500/80 uppercase">
              Away Saint Blessing
            </Label>
            <Select value={awaySaint} onValueChange={setAwaySaint}>
              <SelectTrigger className="bg-background/50 h-8 border-amber-500/20 text-xs">
                <SelectValue placeholder="Select Saint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Blessing</SelectItem>
                <SelectItem value="Saint Rais">Saint Rais (+5 ELO)</SelectItem>
                <SelectItem value="Saint Inonsia">Saint Inonsia (+5 ELO)</SelectItem>
                <SelectItem value="Saint Magador">Saint Magador (+5 ELO)</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                id="awayScandal"
                checked={awayScandal}
                onChange={(e) => setAwayScandal(e.target.checked)}
                className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded"
              />
              <label
                htmlFor="awayScandal"
                className="text-muted-foreground cursor-pointer text-[10px] select-none"
              >
                Country Scandal (-8 ELO)
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 gap-1" size="sm" onClick={handleSimulateSingleMatch}>
            <Play className="h-3 w-3" /> Single
          </Button>
          <Button
            className="flex-1 gap-1"
            variant="outline"
            size="sm"
            onClick={handleSimulate100Matches}
          >
            <TrendingUp className="h-3 w-3" /> 100x Run
          </Button>
        </div>

        {singleResult && (
          <div className="space-y-3">
            <div className="bg-muted/30 space-y-1 rounded-lg border p-3 text-center text-xs">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Simulated Result
              </p>
              <div className="text-xl font-bold">
                {teamAName} {singleResult.homeScore} - {singleResult.awayScore} {teamBName}
              </div>
              <Badge variant={singleResult.upset ? "destructive" : "secondary"} className="mt-1">
                {singleResult.upset ? "Upset!" : "Expected Outcome"}
              </Badge>
              <p className="text-muted-foreground mt-1 text-[10px]">
                Home Strength: {singleResult.keyStats?.homeStrength} &middot; Away Strength:{" "}
                {singleResult.keyStats?.awayStrength}
              </p>
            </div>

            {/* Match Events Ticker Trace */}
            {singleResult.trace && singleResult.trace.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Match Events Ticker
                </h6>
                <div className="thin-scrollbar bg-muted/10 max-h-[160px] space-y-1.5 overflow-y-auto rounded border p-2 pr-1 text-left font-mono text-[10px]">
                  {singleResult.trace.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="border-border/5 flex gap-1.5 border-b py-0.5 font-mono leading-relaxed last:border-0"
                    >
                      <span className="min-w-[28px] font-bold text-amber-500">{step.t}'</span>
                      <span
                        className={cn(
                          "flex-1",
                          step.type === "goal"
                            ? "font-semibold text-emerald-400"
                            : step.type === "penalty" || step.type === "card"
                              ? "text-red-400"
                              : step.type === "fight"
                                ? "font-semibold text-orange-400"
                                : step.type === "tactic_shift"
                                  ? "text-cyan-400 italic"
                                  : "text-muted-foreground"
                        )}
                      >
                        {step.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {simulationResults && (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded border p-3 text-xs">
              <h5 className="mb-1 text-center font-bold">100x Simulation Stats</h5>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center font-mono text-[10px]">
                <div>
                  Avg Goals {teamAName}: {simulationResults.avgGoalsA}
                </div>
                <div>
                  Avg Goals {teamBName}: {simulationResults.avgGoalsB}
                </div>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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

      {dbSeason && dbSeason.matches && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold">
            Completed Matches: {dbSeason.matches.filter((m) => m.status === "completed").length}
          </h5>
          <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {dbSeason.matches
              .filter((m) => m.status === "completed")
              .slice(0, 10)
              .map((m) => (
                <div key={m.id} className="bg-muted/10 space-y-1 rounded border p-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{m.homeTeam.name}</span>
                    <span className="font-bold text-cyan-400">
                      {m.homeScore} - {m.awayScore}
                    </span>
                    <span>{m.awayTeam.name}</span>
                  </div>
                  {m.matchStats && (
                    <p className="text-muted-foreground/80 text-center font-mono text-[10px]">
                      Resolved: {new Date(m.resolvedIxTime || 0).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});
