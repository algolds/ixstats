import type { SportDefinition } from "./types";

export const soccerDefinition: SportDefinition = {
  id: "soccer",
  name: "Soccer",
  emoji: "⚽",
  surfaceType: "pitch",
  terminology: {
    athlete: "Player",
    athletes: "Players",
    organization: "Club",
    organizations: "Clubs",
    match: "Match",
    matches: "Matches",
    scoringUnit: "Goal",
    scoringUnitPlural: "Goals",
    surfaceName: "Pitch",
    headCoach: "Manager",
  },
  periods: {
    count: 2,
    periodName: "Half",
    periodNamePlural: "Halves",
    periodLengthMinutes: 45,
    hasOvertime: true,
    overtimeName: "Extra Time",
    hasShootout: true,
  },
  scoringRules: {
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    pointSystemDescription: "3 pts for Win, 1 pt for Draw, 0 pts for Loss",
  },
  rosterSlots: [
    { code: "GK", label: "Goalkeeper", group: "goalkeeper", isStarter: true },
    { code: "CB", label: "Center Back", group: "defense", isStarter: true },
    { code: "FB", label: "Full Back", group: "defense", isStarter: true },
    { code: "CM", label: "Central Midfielder", group: "offense", isStarter: true },
    { code: "AM", label: "Attacking Midfielder", group: "offense", isStarter: true },
    { code: "W", label: "Winger", group: "offense", isStarter: true },
    { code: "ST", label: "Striker", group: "offense", isStarter: true },
  ],
};
