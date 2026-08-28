import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Calendar } from "iconoir-react";
import { api } from "~/trpc/react";
import { generateSchedule, getPreset, type SportPresetKey, type ArchetypeType } from "~/lib/sports";

interface ScheduleInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (id: string) => void;
}

export const ScheduleInspectorNode = React.memo(function ScheduleInspectorNode({
  isSandbox,
  selectedSport,
  selectedLeagueId,
  setSelectedLeagueId,
  selectedSeasonId,
  setSelectedSeasonId,
}: ScheduleInspectorNodeProps) {
  const [mockSchedule, setMockSchedule] = useState<any[]>([]);
  const [teamCountSched, setTeamCountSched] = useState(8);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeType | "default">("default");

  const activePreset = getPreset(selectedSport);

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

  const handleGenerateSchedule = () => {
    const arch = selectedArchetype === "default" ? activePreset.archetype : selectedArchetype;
    const schedule = generateSchedule({
      teamCount: teamCountSched,
      archetype: arch as ArchetypeType,
    });
    setMockSchedule(schedule);
  };

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
            <Select value={selectedArchetype} onValueChange={(v) => setSelectedArchetype(v as any)}>
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
              <div key={i} className="bg-muted/10 flex justify-between rounded border p-2 text-xs">
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
                {stg.teams} Teams {stg.advancement ? `(Top ${stg.advancement.count} advance)` : ""}
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
});
