import { useReducer } from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  changedRows,
  createTeamTable,
  teamTableReducer,
  type TeamField,
  type TeamTableSource,
} from "~/lib/sports/team-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ValueSelect } from "~/components/ui/value-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

interface LeagueTeamsTabProps {
  leagueId: string;
  teams: readonly TeamTableSource[];
  onOpenRoster: (teamId: string) => void;
}

/** `Select` items cannot hold an empty value, so "no nation" is this. */
const NO_NATION = "none";

/** Every team of the league in one table, saved together. */
export function LeagueTeamsTab({ leagueId, teams, onOpenRoster }: LeagueTeamsTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [table, dispatch] = useReducer(teamTableReducer, teams, createTeamTable);
  const { data: nations } = api.countries.getSelectList.useQuery(
    { limit: 200 },
    { staleTime: 5 * 60 * 1000 }
  );
  const nationOptions = [
    [NO_NATION, "No nation"] as const,
    ...(nations ?? []).map((nation) => [nation.id, nation.name] as const),
  ];

  const patches = changedRows(table);
  const hasBlankName = patches.some((patch) => patch.name === "");

  const updateTeams = api.sports.updateTeams.useMutation({
    onSuccess: () => {
      dispatch({ type: "saved" });
      notify.success("Teams saved", "Every change was saved.");
      void utils.sports.getLeague.invalidate({ id: leagueId });
    },
    onError: (err) => notify.error("Save failed", err.message),
  });

  const edit = (id: string, field: TeamField, value: string) =>
    dispatch({ type: "edit", id, field, value });

  return (
    <div className="space-y-3">
      <Table containerClassName="thin-scrollbar max-h-[350px]">
        <TableHeader sticky>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Short name</TableHead>
            <TableHead>Colour</TableHead>
            <TableHead>Nation</TableHead>
            <TableHead>Wiki slug</TableHead>
            <TableHead pinned>Roster</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Input
                  value={row.name}
                  onChange={(e) => edit(row.id, "name", e.target.value)}
                  aria-label={`Name of ${row.name || "team"}`}
                  aria-invalid={row.name.trim() === ""}
                  maxLength={200}
                  className="min-w-40"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={row.shortName}
                  onChange={(e) => edit(row.id, "shortName", e.target.value)}
                  aria-label={`Short name of ${row.name}`}
                  maxLength={20}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={row.color}
                    onChange={(e) => edit(row.id, "color", e.target.value)}
                    aria-label={`Colour picker for ${row.name}`}
                    className="h-(--control-height) w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={row.color}
                    onChange={(e) => edit(row.id, "color", e.target.value)}
                    aria-label={`Colour of ${row.name}`}
                    className="w-28 tabular-nums"
                  />
                </div>
              </TableCell>
              <TableCell>
                <ValueSelect
                  value={row.nationId || NO_NATION}
                  onValueChange={(id) => edit(row.id, "nationId", id === NO_NATION ? "" : id)}
                  options={nationOptions}
                  aria-label={`Nation of ${row.name}`}
                  className="w-44"
                  contentClassName="max-h-72"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={row.wikiSlug}
                  onChange={(e) => edit(row.id, "wikiSlug", e.target.value)}
                  aria-label={`Wiki slug of ${row.name}`}
                  placeholder="Real_Capital"
                  maxLength={100}
                  className="min-w-40"
                />
              </TableCell>
              <TableCell pinned>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenRoster(row.id)}
                  aria-label={`Open the roster of ${row.name}`}
                >
                  Roster
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-2">
        <p className="text-label-secondary text-footnote tabular-nums">
          {patches.length === 0
            ? "No unsaved changes."
            : `${patches.length} ${patches.length === 1 ? "team" : "teams"} changed.`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={patches.length === 0 || updateTeams.isPending}
            onClick={() => dispatch({ type: "reset" })}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={patches.length === 0 || hasBlankName || updateTeams.isPending}
            onClick={() => updateTeams.mutate({ leagueId, teams: patches })}
          >
            {updateTeams.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save teams
          </Button>
        </div>
      </div>
    </div>
  );
}
