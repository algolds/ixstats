import { Label } from "~/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

interface LeagueSeasonPickerProps {
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  /** Omit both season props to render the league selector alone. */
  selectedSeasonId?: string;
  setSelectedSeasonId?: (id: string) => void;
}

export function LeagueSeasonPicker({
  selectedLeagueId,
  setSelectedLeagueId,
  selectedSeasonId,
  setSelectedSeasonId,
}: LeagueSeasonPickerProps) {
  const { data: leagues } = api.sports.getLeagues.useQuery({});
  const { data: league } = api.sports.getLeague.useQuery(
    { id: selectedLeagueId },
    { enabled: !!selectedLeagueId }
  );

  return (
    <>
      <div className="space-y-2">
        <Label>Select league</Label>
        <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose league" />
          </SelectTrigger>
          <SelectContent>
            {leagues?.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {setSelectedSeasonId && league?.seasons && (
        <div className="space-y-2">
          <Label>Select season</Label>
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose season" />
            </SelectTrigger>
            <SelectContent>
              {league.seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Season {s.seasonNumber} ({s.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
