import type { SportDefinition } from "./types";

export const boxingDefinition: SportDefinition = {
  id: "boxing",
  name: "Boxing",
  emoji: "🥊",
  surfaceType: "ring",
  terminology: {
    athlete: "Fighter",
    athletes: "Fighters",
    organization: "Gym",
    organizations: "Gyms",
    match: "Bout",
    matches: "Bouts",
    scoringUnit: "Round",
    scoringUnitPlural: "Rounds",
    surfaceName: "Ring",
    headCoach: "Trainer",
  },
  periods: {
    count: 12,
    periodName: "Round",
    periodNamePlural: "Rounds",
    periodLengthMinutes: 3,
    hasOvertime: false,
    hasShootout: false,
  },
  scoringRules: {
    winPoints: 1,
    drawPoints: 0,
    lossPoints: 0,
    pointSystemDescription: "10-Point Must System per Round",
  },
  rosterSlots: [
    { code: "FIGHTER", label: "Fighter", group: "special", isStarter: true },
  ],
};
