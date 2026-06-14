"use client";

import React, { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { useUserCountry } from "~/hooks/useUserCountry";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
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
import {
  getAllPresets,
  getPreset,
  resolveMatch,
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  processAging,
  type SportPresetKey,
  type ArchetypeType,
} from "~/lib/sports";
import {
  Trophy,
  Users,
  Calendar,
  Swords,
  Play,
  RotateCcw,
  Sliders,
  Database,
  Briefcase,
  TrendingUp,
} from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface SportsLabsInspectorProps {
  selectedNodeId: string;
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  setSelectedSport: (sport: SportPresetKey) => void;
  className?: string;
}

export function SportsLabsInspector({
  selectedNodeId,
  isSandbox,
  selectedSport,
  setSelectedSport,
  className,
}: SportsLabsInspectorProps) {
  // ─── Shared Sandbox State ──────────────────────────────────────────────────
  const [seed, setSeed] = useState(42);

  // Roster node state
  const [mockRoster, setMockRoster] = useState<any[]>([]);
  const [mockCoach, setMockCoach] = useState<any>(null);

  // Schedule node state
  const [mockSchedule, setMockSchedule] = useState<any[]>([]);
  const [teamCountSched, setTeamCountSched] = useState(8);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeType | "default">("default");

  // Resolver node state
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

  // Aging node state
  const [agingRoster, setAgingRoster] = useState<any[]>([]);
  const [coachDev, setCoachDev] = useState(70);
  const [agingResults, setAgingResults] = useState<any[]>([]);

  // ─── Shared DB State ───────────────────────────────────────────────────────
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

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

  const { data: dbTeam, refetch: refetchTeam } = api.sports.getTeam.useQuery(
    { id: selectedTeamId },
    { enabled: !!selectedTeamId }
  );

  const [selectedSaint, setSelectedSaint] = useState("Saint Rais");
  const { userProfile } = useUserCountry();
  const isOwner = dbTeam && userProfile && dbTeam.ownerUserId === userProfile.id;

  const invokeSaintMutation = api.sports.invokePatronSaint.useMutation({
    onSuccess: () => {
      alert("Patron Saint successfully invoked! Blessing created.");
      void refetchTeam();
    },
    onError: (err) => {
      alert(`Failed to invoke saint: ${err.message}`);
    },
  });

  const handleInvokeSaint = () => {
    if (!dbTeam) return;
    invokeSaintMutation.mutate({ teamId: dbTeam.id, saintName: selectedSaint });
  };

  const isInvoking = invokeSaintMutation.isPending;

  const { data: dbDraftPicks } = api.sports.getDraftPicks.useQuery(
    { seasonId: selectedSeasonId },
    { enabled: !!selectedSeasonId && selectedNodeId === "aging" }
  );

  const activePreset = useMemo(() => {
    return getPreset(selectedSport);
  }, [selectedSport]);

  const presetList = useMemo(() => {
    return getAllPresets();
  }, []);

  // ─── Sandbox Functions ─────────────────────────────────────────────────────
  const handleGenerateRoster = () => {
    const roster = generateTeamRoster({
      sport: selectedSport,
      rosterSize: activePreset.rosterSize,
      seed,
    });
    const coach = generateCoach({ seed });
    setMockRoster(roster);
    setMockCoach(coach);
    setAgingRoster(roster.map((p) => ({ ...p, id: p.lastName })));
    setAgingResults([]);
  };

  const handleGenerateSchedule = () => {
    const archetypeToUse =
      selectedArchetype === "default" ? activePreset.archetype : selectedArchetype;
    const sched = generateSchedule({
      archetype: archetypeToUse as ArchetypeType,
      teamCount: teamCountSched,
    });
    setMockSchedule(sched);
  };

  const handleSimulateSingleMatch = () => {
    const vectorA = {
      overall: teamAOverall,
      offense: teamAOverall,
      defense: teamAOverall,
      form: teamAOverall,
      depth: teamAOverall,
      coaching: teamAOverall,
    };
    const vectorB = {
      overall: teamBOverall,
      offense: teamBOverall,
      defense: teamBOverall,
      form: teamBOverall,
      depth: teamBOverall,
      coaching: teamBOverall,
    };

    const homeTeamModifiers = {
      saintName: homeSaint !== "none" ? homeSaint : undefined,
      saintBlessing: homeSaint !== "none" ? 5 : undefined,
      countryScandal: homeScandal ? 8 : undefined,
    };
    const awayTeamModifiers = {
      saintName: awaySaint !== "none" ? awaySaint : undefined,
      saintBlessing: awaySaint !== "none" ? 5 : undefined,
      countryScandal: awayScandal ? 8 : undefined,
    };

    const result = resolveMatch({
      sport: selectedSport,
      homeTeam: vectorA,
      awayTeam: vectorB,
      archetype: activePreset.archetype,
      seed: Math.floor(Math.random() * 10000),
      context: { homeAdvantage },
      homeTeamModifiers,
      awayTeamModifiers,
    });

    setSingleResult(result);
    setSimulationResults(null);
  };

  const handleSimulate100Matches = () => {
    const vectorA = {
      overall: teamAOverall,
      offense: teamAOverall,
      defense: teamAOverall,
      form: teamAOverall,
      depth: teamAOverall,
      coaching: teamAOverall,
    };
    const vectorB = {
      overall: teamBOverall,
      offense: teamBOverall,
      defense: teamBOverall,
      form: teamBOverall,
      depth: teamBOverall,
      coaching: teamBOverall,
    };

    const homeTeamModifiers = {
      saintName: homeSaint !== "none" ? homeSaint : undefined,
      saintBlessing: homeSaint !== "none" ? 5 : undefined,
      countryScandal: homeScandal ? 8 : undefined,
    };
    const awayTeamModifiers = {
      saintName: awaySaint !== "none" ? awaySaint : undefined,
      saintBlessing: awaySaint !== "none" ? 5 : undefined,
      countryScandal: awayScandal ? 8 : undefined,
    };

    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    let totalGoalsA = 0;
    let totalGoalsB = 0;

    for (let i = 0; i < 100; i++) {
      const result = resolveMatch({
        sport: selectedSport,
        homeTeam: vectorA,
        awayTeam: vectorB,
        archetype: activePreset.archetype,
        seed: seed + i * 37,
        context: { homeAdvantage },
        homeTeamModifiers,
        awayTeamModifiers,
      });

      totalGoalsA += result.homeScore;
      totalGoalsB += result.awayScore;

      if (result.winner === "home") winsA++;
      else if (result.winner === "away") winsB++;
      else draws++;
    }

    setSimulationResults({
      winsA,
      winsB,
      draws,
      avgGoalsA: (totalGoalsA / 100).toFixed(2),
      avgGoalsB: (totalGoalsB / 100).toFixed(2),
    });
    setSingleResult(null);
  };

  const handleSimulateAging = () => {
    if (agingRoster.length === 0) {
      handleGenerateRoster();
    }
    const playersToAge = agingRoster.map((p) => ({
      id: p.id || p.lastName,
      age: p.age,
      careerStage: p.careerStage,
      ratings: p.ratings,
    }));

    const coachMap = new Map<string, number>();
    for (const p of playersToAge) {
      coachMap.set(p.id, coachDev);
    }

    const res = processAging({
      players: playersToAge,
      coaches: [],
      coachMap,
      seed: seed + 500,
    });

    setAgingResults(res.playerResults);

    // Apply updates locally
    const updated = agingRoster.map((p) => {
      const pRes = res.playerResults.find((r) => r.playerId === (p.id || p.lastName));
      if (!pRes) return p;
      if (pRes.retired) {
        return { ...p, age: p.age + 1, careerStage: "retired", isActive: false };
      }
      const newRatings = { ...p.ratings };
      for (const [k, v] of Object.entries(pRes.ratingChanges)) {
        newRatings[k] = Math.max(1, Math.min(99, (newRatings[k] ?? 50) + v));
      }
      return { ...p, age: p.age + 1, careerStage: pRes.newStage, ratings: newRatings };
    });

    setAgingRoster(updated);
  };

  const getPlayerOverall = (ratings: any): number => {
    if (!ratings) return 50;
    if (typeof ratings.overall === "number") return ratings.overall;
    const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  // ─── Render Inspector Tabs ────────────────────────────────────────────────

  // 1. Presets View
  const renderPresetsNode = () => {
    if (isSandbox) {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Select Sport Preset</Label>
            <Select
              value={selectedSport}
              onValueChange={(v) => setSelectedSport(v as SportPresetKey)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
              <SelectContent>
                {presetList.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="facet-hierarchy-child border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-amber-500" />
                Preset Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="border-border/40 grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-muted-foreground">Archetype</span>
                  <p className="font-semibold capitalize">{activePreset.archetype}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Roster Size</span>
                  <p className="font-semibold">{activePreset.rosterSize}</p>
                </div>
              </div>
              <div className="border-border/40 grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-muted-foreground">Team Range</span>
                  <p className="font-semibold">
                    {activePreset.minTeamCount} - {activePreset.maxTeamCount}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Federation</span>
                  <p className="truncate font-semibold" title={activePreset.federationName}>
                    {activePreset.federationShort}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Rating Vectors</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {activePreset.ratingVector.map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px]">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // DB Mode
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Database Presets list</h4>
        <div className="thin-scrollbar max-h-[400px] space-y-2 overflow-y-auto">
          {presetList.map((p) => (
            <div
              key={p.key}
              className="bg-muted/20 flex items-center justify-between rounded-lg border p-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-muted-foreground text-[10px] capitalize">
                    {p.archetype} &middot; {p.federationShort}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{p.rosterSize} slots</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 2. Rosters View
  const renderRostersNode = () => {
    if (isSandbox) {
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Generator Seed</Label>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
              />
            </div>
            <Button className="mt-6 gap-1.5" onClick={handleGenerateRoster}>
              <RotateCcw className="h-4 w-4" />
              Generate
            </Button>
          </div>

          {mockCoach && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
              <p className="font-semibold text-emerald-400">
                Head Coach: {mockCoach.firstName} {mockCoach.lastName}
              </p>
              <p className="text-muted-foreground text-[10px] capitalize">
                {mockCoach.role} &middot; Age {mockCoach.age} &middot; {mockCoach.careerStage}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                <div>Strat: {mockCoach.ratings.strategy}</div>
                <div>Dev: {mockCoach.ratings.development}</div>
              </div>
            </div>
          )}

          {mockRoster.length > 0 ? (
            <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
              <p className="text-muted-foreground text-xs">{mockRoster.length} Players Generated</p>
              {mockRoster.map((p, i) => {
                const overall = getPlayerOverall(p.ratings);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border p-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <PositionTooltip position={p.position}>
                          <span className="hover:text-foreground cursor-help font-medium transition-colors">
                            {p.position}
                          </span>
                        </PositionTooltip>{" "}
                        &middot; Age {p.age} &middot; {p.careerStage}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-bold">
                      {overall}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-xs">
              Click Generate to build a sandbox roster.
            </p>
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

        {dbLeague && (
          <div className="space-y-1.5">
            <Label>Select Team</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose team" />
              </SelectTrigger>
              <SelectContent>
                {dbLeague.teams?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {dbTeam && (
          <div className="space-y-3">
            <div className="bg-muted/40 relative overflow-hidden rounded-lg border p-3 text-xs">
              <h5 className="text-foreground font-bold">{dbTeam.name}</h5>
              <p className="text-muted-foreground text-[10px]">
                {dbTeam.shortName} &middot; HSL Color: {dbTeam.color}
              </p>
              {dbTeam.coaches && dbTeam.coaches.length > 0 && (
                <p className="mt-1 font-semibold text-cyan-400">
                  Head Coach: {dbTeam.coaches[0].firstName} {dbTeam.coaches[0].lastName}
                </p>
              )}
              {(dbTeam as any).patronSaint && (
                <p className="mt-1.5 flex items-center gap-1 font-semibold text-amber-400">
                  🙏 Patron Saint:{" "}
                  <Badge
                    variant="secondary"
                    className="border-amber-500/20 bg-amber-500/10 text-[9px] text-amber-400"
                  >
                    {(dbTeam as any).patronSaint}
                  </Badge>
                </p>
              )}
            </div>

            {isOwner && (
              <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-md">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                      Patron Saint Ritual (Cost: ₷100)
                    </p>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-[9px] text-amber-300"
                    >
                      BLESSING BOOST: +5 ELO
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedSaint} onValueChange={setSelectedSaint}>
                      <SelectTrigger className="bg-background/50 h-8 border-amber-500/20 text-xs">
                        <SelectValue placeholder="Select Saint" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Saint Rais">Saint Rais (Light Blessing)</SelectItem>
                        <SelectItem value="Saint Inonsia">
                          Saint Inonsia (Fortitude Blessing)
                        </SelectItem>
                        <SelectItem value="Saint Magador">
                          Saint Magador (Victory Blessing)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 bg-amber-500 px-3 text-xs font-bold text-black hover:bg-amber-600"
                      onClick={handleInvokeSaint}
                      disabled={isInvoking}
                    >
                      {isInvoking ? "Invoking..." : "Invoke"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="thin-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto">
              <h6 className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Active Roster ({dbTeam.players.length})
              </h6>
              {dbTeam.players.map((p) => {
                const overall = getPlayerOverall(p.ratings);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded border p-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <PositionTooltip position={p.position}>
                          <span className="hover:text-foreground cursor-help font-medium transition-colors">
                            {p.position}
                          </span>
                        </PositionTooltip>{" "}
                        &middot; Age {p.age} &middot; {p.careerStage}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {overall}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 3. Schedule View
  const renderScheduleNode = () => {
    if (isSandbox) {
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Team Count</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={teamCountSched}
                onChange={(e) => setTeamCountSched(parseInt(e.target.value) || 2)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Format Archetype</Label>
              <Select
                value={selectedArchetype}
                onValueChange={(v) => setSelectedArchetype(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default (Preset)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default ({activePreset.archetype})</SelectItem>
                  <SelectItem value="league">Round-Robin (League)</SelectItem>
                  <SelectItem value="bracket">Elimination (Bracket)</SelectItem>
                  <SelectItem value="circuit">Racing (Circuit)</SelectItem>
                  <SelectItem value="division_conference">Division & Conference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="mt-6 gap-1.5" onClick={handleGenerateSchedule}>
              <Calendar className="h-4 w-4" />
              Generate
            </Button>
          </div>

          {mockSchedule.length > 0 ? (
            <div className="thin-scrollbar max-h-[350px] space-y-2 overflow-y-auto pr-1">
              <p className="text-muted-foreground text-xs">
                {mockSchedule.length} Fixtures Generated
              </p>
              {mockSchedule.map((f, i) => (
                <div
                  key={i}
                  className="bg-muted/10 flex justify-between rounded border p-2 text-xs"
                >
                  <span className="text-muted-foreground font-bold">Day {f.matchDay}</span>
                  <span>
                    Team {f.homeTeamIndex + 1} vs Team {f.awayTeamIndex + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-xs">
              Click Generate to build a mock schedule.
            </p>
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
          <div className="border-border/40 flex items-center justify-between border-b py-1.5 text-xs">
            <span className="text-muted-foreground">Active Stage:</span>
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/10 text-[10px] font-bold text-amber-400"
            >
              Stage {(dbSeason as any).activeStage ?? 1}
            </Badge>
          </div>
        )}

        {dbLeague && (dbLeague as any).settings?.stages && (
          <div className="border-primary/20 bg-primary/5 space-y-1 rounded-lg border p-2.5 text-xs">
            <p className="text-primary font-semibold">Tournament Stages Configured:</p>
            {((dbLeague as any).settings.stages as any[]).map((stg: any, sIdx: number) => (
              <div
                key={sIdx}
                className="text-muted-foreground border-border/20 flex justify-between border-b py-0.5 text-[10px] last:border-0"
              >
                <span className="font-medium">
                  Stage {stg.id}:{" "}
                  {stg.type === "round_robin"
                    ? "Round Robin"
                    : stg.type === "golden_box"
                      ? "Golden Box"
                      : stg.type}
                </span>
                <span>
                  {stg.teams} Teams{" "}
                  {stg.advancement ? `(Top ${stg.advancement.count} advance)` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {dbSeason && dbSeason.matches && (
          <div className="thin-scrollbar max-h-[220px] space-y-2 overflow-y-auto pr-1">
            <h5 className="text-xs font-semibold">Matches scheduled: {dbSeason.matches.length}</h5>
            {dbSeason.matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded border p-2 text-xs"
              >
                <span className="text-muted-foreground font-bold">Day {m.matchDay}</span>
                <span className="max-w-[140px] truncate">
                  {m.homeTeam.shortName ?? m.homeTeam.name} vs{" "}
                  {m.awayTeam.shortName ?? m.awayTeam.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {(m as any).stage && (
                    <Badge variant="secondary" className="px-1 font-mono text-[8px]">
                      S{(m as any).stage}
                    </Badge>
                  )}
                  {m.status === "completed" ? (
                    <Badge variant="secondary">
                      {m.homeScore} - {m.awayScore}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Scheduled</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 4. Match Resolver View
  const renderResolverNode = () => {
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

              {/* Match Events Ticker Trace (supports Hockey and Soccer events) */}
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
  };

  // 5. Standings View
  const renderStandingsNode = () => {
    if (isSandbox) {
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Standings node displays the cumulative stats (Wins, Losses, Draws, Points). In Sandbox,
            standings can be simulated locally from schedule runs.
          </p>
          <Button variant="outline" className="w-full text-xs" onClick={handleGenerateSchedule}>
            Setup Sandbox Standings
          </Button>
          {mockSchedule.length > 0 && (
            <div className="text-muted-foreground bg-muted/30 rounded border p-3 text-center text-xs">
              Standings generated for {teamCountSched} teams. Click Match Resolver Node to run
              sandbox matches!
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
                      i >= totalTeams - relegationCount &&
                      (dbLeague as any)?.subLeagues?.length > 0;

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
  };

  // 6. Aging Node View
  const renderAgingNode = () => {
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
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  const nodeHeaders: Record<string, { title: string; icon: typeof Trophy; subtitle: string }> = {
    presets: { title: "Sport Presets", icon: Trophy, subtitle: "Manage presets & formats" },
    rosters: { title: "Talent & Roster Gen", icon: Users, subtitle: "Configure coaches & players" },
    schedule: {
      title: "Schedule Generator",
      icon: Calendar,
      subtitle: "Inspect fixture format rules",
    },
    resolver: { title: "Match Resolver", icon: Swords, subtitle: "Seeded match simulator" },
    standings: { title: "Standings & Table", icon: Trophy, subtitle: "Compute standings ranks" },
    aging: { title: "Aging & Retirements", icon: Sliders, subtitle: "Career chain progression" },
  };

  const currentHeader = nodeHeaders[selectedNodeId] ?? {
    title: "Select a Node",
    icon: Database,
    subtitle: "Click a pipeline step to preview",
  };

  return (
    <Card
      className={cn(
        "facet-hierarchy-child border-border/60 bg-card/30 flex h-[650px] flex-col overflow-hidden",
        className
      )}
    >
      <CardHeader className="border-border/40 shrink-0 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="border-border/40 bg-muted/40 text-primary flex h-9 w-9 items-center justify-center rounded-lg border">
            <currentHeader.icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{currentHeader.title}</CardTitle>
            <p className="text-muted-foreground text-[10px]">{currentHeader.subtitle}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
        {selectedNodeId === "presets" && renderPresetsNode()}
        {selectedNodeId === "rosters" && renderRostersNode()}
        {selectedNodeId === "schedule" && renderScheduleNode()}
        {selectedNodeId === "resolver" && renderResolverNode()}
        {selectedNodeId === "standings" && renderStandingsNode()}
        {selectedNodeId === "aging" && renderAgingNode()}
      </CardContent>
    </Card>
  );
}
