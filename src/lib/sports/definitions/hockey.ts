import type { SportDefinition } from "./types";

export const hockeyDefinition: SportDefinition = {
  id: "hockey",
  name: "Ice Hockey",
  emoji: "🏒",
  surfaceType: "rink",
  terminology: {
    athlete: "Skater",
    athletes: "Skaters",
    organization: "Club",
    organizations: "Clubs",
    match: "Game",
    matches: "Games",
    scoringUnit: "Goal",
    scoringUnitPlural: "Goals",
    surfaceName: "Rink",
    headCoach: "Head Coach",
  },
  periods: {
    count: 3,
    periodName: "Period",
    periodNamePlural: "Periods",
    periodLengthMinutes: 20,
    hasOvertime: true,
    overtimeName: "Overtime (3-on-3)",
    hasShootout: true,
  },
  scoringRules: {
    winPoints: 2,
    drawPoints: 0,
    otLossPoints: 1,
    lossPoints: 0,
    pointSystemDescription: "2 pts for Win, 1 pt for Overtime Loss (OTL), 0 pts for Reg Loss",
  },
  rosterSlots: [
    { code: "G", label: "Goaltender", group: "goalkeeper", isStarter: true },
    { code: "D", label: "Defenseman", group: "defense", isStarter: true },
    { code: "C", label: "Center", group: "offense", isStarter: true },
    { code: "LW", label: "Left Wing", group: "offense", isStarter: true },
    { code: "RW", label: "Right Wing", group: "offense", isStarter: true },
  ],
};
