import { Label } from "~/components/ui/label";
import { ValueSelect } from "~/components/ui/value-select";
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
        <ValueSelect
          value={selectedLeagueId}
          onValueChange={setSelectedLeagueId}
          options={leagues?.map((l) => [l.id, l.name] as const) ?? []}
          placeholder="Choose league"
        />
      </div>

      {setSelectedSeasonId && league?.seasons && (
        <div className="space-y-2">
          <Label>Select season</Label>
          <ValueSelect
            value={selectedSeasonId}
            onValueChange={setSelectedSeasonId}
            options={league.seasons.map(
              (s) => [s.id, `Season ${s.seasonNumber} (${s.status})`] as const
            )}
            placeholder="Choose season"
          />
        </div>
      )}
    </>
  );
}
