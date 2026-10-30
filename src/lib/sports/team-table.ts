/**
 * The Teams tab's draft table. Every field is held as the text the inputs show; `changedRows` turns the rows that
 * differ from the saved ones into the patches `sports.updateTeams` takes.
 */

/** A team as the league query returns it: the fields the table edits. */
export interface TeamTableSource {
  id: string;
  name: string;
  shortName?: string | null;
  color: string;
  nationId?: string | null;
  wikiSlug?: string | null;
}

export interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  color: string;
  nationId: string;
  wikiSlug: string;
}

export type TeamField = Exclude<keyof TeamRow, "id">;

/** One team's changes: only the fields that differ; a cleared optional field is `null`. */
export interface TeamPatch {
  id: string;
  name?: string;
  shortName?: string | null;
  color?: string;
  nationId?: string | null;
  wikiSlug?: string | null;
}

export interface TeamTableState {
  /** What the server holds. */
  saved: TeamRow[];
  /** What the inputs show. */
  rows: TeamRow[];
}

export type TeamTableAction =
  | { type: "edit"; id: string; field: TeamField; value: string }
  | { type: "reset" }
  | { type: "saved" };

const toRow = (team: TeamTableSource): TeamRow => ({
  id: team.id,
  name: team.name,
  shortName: team.shortName ?? "",
  color: team.color,
  nationId: team.nationId ?? "",
  wikiSlug: team.wikiSlug ?? "",
});

export function createTeamTable(teams: readonly TeamTableSource[]): TeamTableState {
  const rows = teams.map(toRow);
  return { saved: rows, rows };
}

export function teamTableReducer(state: TeamTableState, action: TeamTableAction): TeamTableState {
  switch (action.type) {
    case "edit":
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.id ? { ...row, [action.field]: action.value } : row
        ),
      };
    case "reset":
      return { ...state, rows: state.saved };
    case "saved":
      return { ...state, saved: state.rows };
  }
}

const text = (value: string): string => value.trim();
/** A cleared optional field is sent as `null`. */
const optional = (value: string): string | null => value.trim() || null;

/** The fields of `row` that differ from `saved`, ready to send. */
function patchOf(row: TeamRow, saved: TeamRow): TeamPatch | null {
  const patch: TeamPatch = { id: row.id };
  if (text(row.name) !== text(saved.name)) patch.name = text(row.name);
  if (optional(row.shortName) !== optional(saved.shortName))
    patch.shortName = optional(row.shortName);
  if (text(row.color) !== text(saved.color)) patch.color = text(row.color);
  if (optional(row.nationId) !== optional(saved.nationId)) patch.nationId = optional(row.nationId);
  if (optional(row.wikiSlug) !== optional(saved.wikiSlug)) patch.wikiSlug = optional(row.wikiSlug);
  return Object.keys(patch).length > 1 ? patch : null;
}

export function changedRows(state: TeamTableState): TeamPatch[] {
  return state.rows.flatMap((row, index) => {
    const saved = state.saved[index];
    const patch = saved ? patchOf(row, saved) : null;
    return patch ? [patch] : [];
  });
}
