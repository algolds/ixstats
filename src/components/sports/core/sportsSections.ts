export type SportsNavSection =
  // Competition / league views
  | "overview"
  | "standings"
  | "schedule"
  | "bracket"
  | "races"
  | "draft"
  | "teams"
  | "history"
  // Club views
  | "roster"
  | "tactics"
  | "transfers"
  | "management";

export interface SportsSectionTab {
  id: SportsNavSection;
  label: string;
}

export const CLUB_SECTION_TABS: readonly SportsSectionTab[] = [
  { id: "overview", label: "Dashboard" },
  { id: "roster", label: "Roster" },
  { id: "tactics", label: "Tactics" },
  { id: "transfers", label: "Transfers" },
  { id: "management", label: "Management" },
  { id: "history", label: "History" },
];

/** Every league view; a league shows the subset that applies to its format. */
export const LEAGUE_SECTION_TABS: readonly SportsSectionTab[] = [
  { id: "overview", label: "Overview" },
  { id: "standings", label: "Standings" },
  { id: "schedule", label: "Schedule" },
  { id: "bracket", label: "Bracket" },
  { id: "races", label: "Races" },
  { id: "draft", label: "Draft" },
  { id: "teams", label: "Franchises" },
  { id: "history", label: "History" },
];
