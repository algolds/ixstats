import type { SportDefinition } from "./types";

export const basketballDefinition: SportDefinition = {
  id: "basketball",
  name: "Basketball",
  emoji: "🏀",
  surfaceType: "court",
  terminology: {
    athlete: "Player",
    athletes: "Players",
    organization: "Franchise",
    organizations: "Franchises",
    match: "Game",
    matches: "Games",
    scoringUnit: "Point",
    scoringUnitPlural: "Points",
    surfaceName: "Court",
    headCoach: "Head Coach",
  },
  periods: {
    count: 4,
    periodName: "Quarter",
    periodNamePlural: "Quarters",
    periodLengthMinutes: 12,
    hasOvertime: true,
    overtimeName: "Overtime (5m)",
    hasShootout: false,
  },
  scoringRules: {
    winPoints: 2,
    drawPoints: 0,
    lossPoints: 0,
    pointSystemDescription: "2 pts for Win, 0 pts for Loss",
  },
  rosterSlots: [
    { code: "PG", label: "Point Guard", group: "offense", isStarter: true },
    { code: "SG", label: "Shooting Guard", group: "offense", isStarter: true },
    { code: "SF", label: "Small Forward", group: "offense", isStarter: true },
    { code: "PF", label: "Power Forward", group: "defense", isStarter: true },
    { code: "C", label: "Center", group: "defense", isStarter: true },
  ],
};
