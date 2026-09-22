import type { SportDefinition } from "./types";

export const f1Definition: SportDefinition = {
  id: "f1",
  name: "Formula 1",
  emoji: "🏎️",
  surfaceType: "circuit",
  terminology: {
    athlete: "Driver",
    athletes: "Drivers",
    organization: "Constructor",
    organizations: "Constructors",
    match: "Grand Prix",
    matches: "Grand Prix",
    scoringUnit: "Point",
    scoringUnitPlural: "Points",
    surfaceName: "Circuit",
    headCoach: "Team Principal",
  },
  periods: {
    count: 1,
    periodName: "Race",
    periodNamePlural: "Races",
    hasOvertime: false,
    hasShootout: false,
  },
  scoringRules: {
    winPoints: 25,
    drawPoints: 0,
    lossPoints: 0,
    pointSystemDescription: "FIA Points: 25-18-15-12-10-8-6-4-2-1 + 1 pt for Fastest Lap",
  },
  rosterSlots: [
    { code: "D1", label: "Lead Driver", group: "driver", isStarter: true },
    { code: "D2", label: "Second Driver", group: "driver", isStarter: true },
    { code: "RES", label: "Reserve Driver", group: "driver", isStarter: false },
  ],
};
