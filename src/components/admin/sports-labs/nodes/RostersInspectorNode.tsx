import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { ValueSelect } from "~/components/ui/value-select";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { Undo as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { generateTeamRoster, generateCoach, type SportPresetKey } from "~/lib/sports";
import { LeagueSeasonPicker } from "./LeagueSeasonPicker";
import { getPlayerOverall } from "../sports-labs-utils";

function PlayerRow({
  player,
}: {
  player: {
    firstName: string;
    lastName: string;
    position: string;
    age: number;
    careerStage: string;
    ratings: Parameters<typeof getPlayerOverall>[0];
  };
}) {
  return (
    <div className="rounded-control-sm text-footnote flex items-center justify-between border p-2">
      <div>
        <p className="font-semibold">
          {player.firstName} {player.lastName}
        </p>
        <p className="text-label-secondary text-footnote flex items-center gap-1">
          <PositionTooltip position={player.position}>
            <span className="hover:text-label cursor-help font-medium transition-colors">
              {player.position}
            </span>
          </PositionTooltip>{" "}
          &middot; Age {player.age} &middot; {player.careerStage}
        </p>
      </div>
      <Badge variant="outline" className="font-semibold tabular-nums">
        {getPlayerOverall(player.ratings)}
      </Badge>
    </div>
  );
}

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
            <Label>Generator seed</Label>
            <Input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
            />
          </div>
          <Button className="mt-6 gap-2" onClick={handleGenerateRoster}>
            <RotateCcw className="h-4 w-4" />
            Generate
          </Button>
        </div>

        {mockCoach && (
          <div className="rounded-control border-green/20 bg-green/5 text-footnote border p-3">
            <p className="text-green font-semibold">
              Head Coach: {mockCoach.firstName} {mockCoach.lastName}
            </p>
            <p className="text-label-secondary text-footnote capitalize">
              {mockCoach.role} &middot; Age {mockCoach.age} &middot; {mockCoach.careerStage}
            </p>
            <div className="text-footnote mt-2 grid grid-cols-2 gap-2 tabular-nums">
              <div>Strat: {mockCoach.ratings.strategy}</div>
              <div>Dev: {mockCoach.ratings.development}</div>
            </div>
          </div>
        )}

        {mockRoster.length > 0 ? (
          <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
            <p className="text-label-secondary text-footnote">
              {mockRoster.length} Players Generated
            </p>
            {mockRoster.map((p, i) => (
              <PlayerRow key={i} player={p} />
            ))}
          </div>
        ) : (
          <p className="text-label-secondary text-footnote py-6 text-center">
            Click Generate to build a sandbox roster.
          </p>
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
      />

      {dbLeague && (
        <div className="space-y-2">
          <Label>Select team</Label>
          <ValueSelect
            value={selectedTeamId}
            onValueChange={setSelectedTeamId}
            options={dbLeague.teams?.map((t) => [t.id, t.name] as const)}
            placeholder="Choose team"
          />
        </div>
      )}

      {dbTeam && (
        <div className="space-y-3">
          <div className="bg-fill-3 rounded-control text-footnote relative overflow-hidden border p-3">
            <h5 className="text-label font-semibold">{dbTeam.name}</h5>
            <p className="text-label-secondary text-footnote">
              {dbTeam.shortName} &middot; HSL Color: {dbTeam.color}
            </p>
            {dbTeam.coaches && dbTeam.coaches.length > 0 && (
              <p className="text-teal mt-1 font-semibold">
                Head Coach: {dbTeam.coaches[0]?.firstName} {dbTeam.coaches[0]?.lastName}
              </p>
            )}
            {(dbTeam as any).patronSaint && (
              <p className="text-yellow mt-2 flex items-center gap-1 font-semibold">
                🙏 Patron Saint: <Badge variant="warning">{(dbTeam as any).patronSaint}</Badge>
              </p>
            )}
          </div>

          {isOwner && (
            <Card className="border-yellow/20 bg-yellow/5 flex flex-col gap-6 py-6">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-eyebrow text-yellow">Patron Saint Ritual (Cost: ₷100)</p>
                  <Badge variant="warning">BLESSING BOOST: +5 ELO</Badge>
                </div>
                <div className="flex gap-2">
                  <ValueSelect
                    value={selectedSaint}
                    onValueChange={setSelectedSaint}
                    options={[
                      ["Saint Rais", "Saint Rais (Light Blessing)"],
                      ["Saint Inonsia", "Saint Inonsia (Fortitude Blessing)"],
                      ["Saint Magador", "Saint Magador (Victory Blessing)"],
                    ]}
                    size="sm"
                    placeholder="Select saint"
                  />
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={handleInvokeSaint}
                    disabled={invokeSaintMutation.isPending}
                  >
                    {invokeSaintMutation.isPending ? "Invoking..." : "Invoke"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto">
            <h6 className="text-label-secondary text-subhead">
              Active Roster ({dbTeam.players.length})
            </h6>
            {dbTeam.players.map((p) => (
              <PlayerRow key={p.id} player={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
