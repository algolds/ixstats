import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { Undo as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { generateTeamRoster, generateCoach, type SportPresetKey } from "~/lib/sports";
import { getPlayerOverall } from "../sports-labs-utils";

interface RostersInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
}

export const RostersInspectorNode = React.memo(function RostersInspectorNode({
  isSandbox,
  selectedSport,
  selectedLeagueId,
  setSelectedLeagueId,
  selectedTeamId,
  setSelectedTeamId,
}: RostersInspectorNodeProps) {
  const [seed, setSeed] = useState(42);
  const [mockRoster, setMockRoster] = useState<any[]>([]);
  const [mockCoach, setMockCoach] = useState<any>(null);
  const [selectedSaint, setSelectedSaint] = useState("Saint Rais");

  // DB queries
  const { data: dbLeagues } = api.sports.getLeagues.useQuery({});
  const { data: dbLeague } = api.sports.getLeague.useQuery(
    { id: selectedLeagueId },
    { enabled: !!selectedLeagueId }
  );
  const { data: dbTeam, refetch: refetchTeam } = api.sports.getTeam.useQuery(
    { id: selectedTeamId },
    { enabled: !!selectedTeamId }
  );

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

  const handleGenerateRoster = () => {
    const roster = generateTeamRoster({ sport: selectedSport, rosterSize: 15, seed });
    const coach = generateCoach({ seed });
    setMockRoster(roster);
    setMockCoach(coach);
  };

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
                Head Coach: {dbTeam.coaches[0]?.firstName} {dbTeam.coaches[0]?.lastName}
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
                    disabled={invokeSaintMutation.isPending}
                  >
                    {invokeSaintMutation.isPending ? "Invoking..." : "Invoke"}
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
});
