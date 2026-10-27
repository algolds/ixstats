import { LeagueSeasonPicker } from "./LeagueSeasonPicker";
import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";
import { ValueSelect } from "~/components/ui/value-select";
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
          {
            name: `${teamAName} Wins`,
            value: simulationResults.winsA,
            fill: "var(--color-chart-1)",
          },
          { name: "Draws", value: simulationResults.draws, fill: "var(--color-gray)" },
          {
            name: `${teamBName} Wins`,
            value: simulationResults.winsB,
            fill: "var(--color-chart-8)",
          },
        ]
      : [];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Home team name</Label>
            <Input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Away team name</Label>
            <Input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-footnote flex justify-between">
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
            <div className="text-footnote flex justify-between">
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
            <div className="text-footnote flex justify-between">
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
        <div className="border-separator grid grid-cols-2 gap-3 border-t pt-3">
          <div className="space-y-2">
            <Label className="text-subhead text-yellow">Home saint blessing</Label>
            <ValueSelect
              value={homeSaint}
              onValueChange={setHomeSaint}
              options={[
                ["none", "No blessing"],
                ["Saint Rais", "Saint Rais (+5 ELO)"],
                ["Saint Inonsia", "Saint Inonsia (+5 ELO)"],
                ["Saint Magador", "Saint Magador (+5 ELO)"],
              ]}
              size="sm"
              placeholder="Select saint"
            />
            <div className="mt-1 flex items-center gap-2">
              <Checkbox
                id="homeScandal"
                checked={homeScandal}
                onCheckedChange={(checked) => setHomeScandal(checked === true)}
              />
              <label
                htmlFor="homeScandal"
                className="text-label-secondary text-footnote cursor-pointer select-none"
              >
                Country Scandal (-8 ELO)
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-subhead text-yellow">Away saint blessing</Label>
            <ValueSelect
              value={awaySaint}
              onValueChange={setAwaySaint}
              options={[
                ["none", "No blessing"],
                ["Saint Rais", "Saint Rais (+5 ELO)"],
                ["Saint Inonsia", "Saint Inonsia (+5 ELO)"],
                ["Saint Magador", "Saint Magador (+5 ELO)"],
              ]}
              size="sm"
              placeholder="Select saint"
            />
            <div className="mt-1 flex items-center gap-2">
              <Checkbox
                id="awayScandal"
                checked={awayScandal}
                onCheckedChange={(checked) => setAwayScandal(checked === true)}
              />
              <label
                htmlFor="awayScandal"
                className="text-label-secondary text-footnote cursor-pointer select-none"
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
            <div className="bg-fill-4 rounded-control text-footnote space-y-1 border p-3 text-center">
              <p className="text-label-secondary text-eyebrow">Simulated result</p>
              <div className="text-title-2">
                {teamAName} {singleResult.homeScore} - {singleResult.awayScore} {teamBName}
              </div>
              <Badge variant={singleResult.upset ? "destructive" : "default"} className="mt-1">
                {singleResult.upset ? "Upset!" : "Expected Outcome"}
              </Badge>
              <p className="text-label-secondary text-footnote mt-1">
                Home Strength: {singleResult.keyStats?.homeStrength} &middot; Away Strength:{" "}
                {singleResult.keyStats?.awayStrength}
              </p>
            </div>

            {singleResult.trace && singleResult.trace.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-label-secondary text-subhead">Match events ticker</h6>
                <div className="thin-scrollbar bg-fill-4 rounded-control-sm text-footnote max-h-[160px] space-y-2 overflow-y-auto border p-2 pr-1 text-left font-mono">
                  {singleResult.trace.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="border-separator flex gap-2 border-b py-0.5 font-mono leading-relaxed last:border-0"
                    >
                      <span className="text-yellow min-w-[28px] font-semibold">{step.t}'</span>
                      <span
                        className={cn(
                          "flex-1",
                          step.type === "goal"
                            ? "text-green font-semibold"
                            : step.type === "penalty" || step.type === "card"
                              ? "text-red"
                              : step.type === "fight"
                                ? "text-orange font-semibold"
                                : step.type === "tactic_shift"
                                  ? "text-teal italic"
                                  : "text-label-secondary"
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
            <div className="bg-fill-3 rounded-control-sm text-footnote border p-3">
              <h5 className="mb-1 text-center font-semibold">100x Simulation Stats</h5>
              <div className="text-footnote mt-2 grid grid-cols-2 gap-2 text-center tabular-nums">
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
                    stroke="var(--color-label-secondary)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: "var(--color-fill-4)" }} />
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
      <LeagueSeasonPicker
        selectedLeagueId={selectedLeagueId}
        setSelectedLeagueId={setSelectedLeagueId}
        selectedSeasonId={selectedSeasonId}
        setSelectedSeasonId={setSelectedSeasonId}
      />

      {dbSeason && dbSeason.matches && (
        <div className="space-y-3">
          <h5 className="text-caption">
            Completed Matches: {dbSeason.matches.filter((m) => m.status === "completed").length}
          </h5>
          <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {dbSeason.matches
              .filter((m) => m.status === "completed")
              .slice(0, 10)
              .map((m) => (
                <div
                  key={m.id}
                  className="bg-fill-4 rounded-control-sm text-footnote space-y-1 border p-2"
                >
                  <div className="flex justify-between font-semibold">
                    <span>{m.homeTeam.name}</span>
                    <span className="text-teal font-semibold">
                      {m.homeScore} - {m.awayScore}
                    </span>
                    <span>{m.awayTeam.name}</span>
                  </div>
                  {m.matchStats && (
                    <p className="text-label-secondary text-footnote text-center tabular-nums">
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
