/** @jest-environment node */
/**
 * The Teams tab's draft table: only rows whose fields differ from the saved ones become patches, a reset drops every
 * edit, and a save makes the rows it sent the new baseline (edits typed while it was in flight stay unsaved).
 */
import {
  changedRows,
  createTeamTable,
  teamTableReducer,
  type TeamTableSource,
} from "~/lib/sports/team-table";

const teams: TeamTableSource[] = [
  {
    id: "a",
    name: "Alpha",
    shortName: "ALP",
    color: "#111111",
    nationId: "n1",
    wikiSlug: "Alpha_FC",
  },
  { id: "b", name: "Bravo", shortName: null, color: "#222222", nationId: null, wikiSlug: null },
  { id: "c", name: "Charlie", shortName: "CHA", color: "#333333", nationId: "n2", wikiSlug: null },
];

describe("teamTableReducer", () => {
  it("has no changed rows before any edit", () => {
    expect(changedRows(createTeamTable(teams))).toEqual([]);
  });

  it("editing a name then resetting leaves zero changed rows", () => {
    const edited = teamTableReducer(createTeamTable(teams), {
      type: "edit",
      id: "a",
      field: "name",
      value: "Alpha United",
    });
    expect(changedRows(edited)).toHaveLength(1);

    expect(changedRows(teamTableReducer(edited, { type: "reset" }))).toEqual([]);
  });

  it("editing two rows gives exactly those two patches, with only the changed fields", () => {
    let state = createTeamTable(teams);
    state = teamTableReducer(state, { type: "edit", id: "a", field: "color", value: "#abcdef" });
    state = teamTableReducer(state, {
      type: "edit",
      id: "c",
      field: "name",
      value: "Charlie Town",
    });
    state = teamTableReducer(state, { type: "edit", id: "c", field: "shortName", value: "CHT" });

    expect(changedRows(state)).toEqual([
      { id: "a", color: "#abcdef" },
      { id: "c", name: "Charlie Town", shortName: "CHT" },
    ]);
  });

  it("editing a field back to its saved value is not a change", () => {
    let state = createTeamTable(teams);
    state = teamTableReducer(state, { type: "edit", id: "a", field: "name", value: "Other" });
    state = teamTableReducer(state, { type: "edit", id: "a", field: "name", value: "Alpha" });

    expect(changedRows(state)).toEqual([]);
  });

  it("sends a cleared short name, nation or wiki slug as null and trims a name", () => {
    let state = createTeamTable(teams);
    state = teamTableReducer(state, { type: "edit", id: "a", field: "shortName", value: "" });
    state = teamTableReducer(state, { type: "edit", id: "a", field: "nationId", value: "" });
    state = teamTableReducer(state, { type: "edit", id: "a", field: "wikiSlug", value: "  " });
    state = teamTableReducer(state, { type: "edit", id: "b", field: "name", value: "  Bravo FC " });

    expect(changedRows(state)).toEqual([
      { id: "a", shortName: null, nationId: null, wikiSlug: null },
      { id: "b", name: "Bravo FC" },
    ]);
  });

  it("makes the draft the baseline once saved", () => {
    let state = createTeamTable(teams);
    state = teamTableReducer(state, { type: "edit", id: "b", field: "name", value: "Bravo FC" });
    state = teamTableReducer(state, { type: "saved", sent: state.rows });

    expect(changedRows(state)).toEqual([]);
    expect(teamTableReducer(state, { type: "reset" }).rows[1]?.name).toBe("Bravo FC");
  });

  it("keeps an edit typed while a save was in flight unsaved", () => {
    let state = createTeamTable(teams);
    state = teamTableReducer(state, { type: "edit", id: "a", field: "name", value: "Alpha FC" });
    const sent = state.rows;
    state = teamTableReducer(state, { type: "edit", id: "b", field: "name", value: "Bravo FC" });
    state = teamTableReducer(state, { type: "saved", sent });

    expect(changedRows(state)).toEqual([{ id: "b", name: "Bravo FC" }]);
    expect(state.rows[1]?.name).toBe("Bravo FC");
  });
});
