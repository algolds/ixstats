export type ArchetypeType = "league" | "division_conference" | "bracket" | "circuit";
export type SportPresetKey =
  "soccer" | "football" | "hockey" | "basketball" | "baseball" | "f1" | "boxing";

export interface SportPreset {
  key: SportPresetKey;
  name: string;
  archetype: ArchetypeType;
  icon: string;
  defaultTeamCount: number;
  minTeamCount: number;
  maxTeamCount: number;
  rosterSize: number;
  positions: string[];
  ratingVector: string[];
  federationName: string;
  federationShort: string;
  // Merged v2 config properties
  startingSlots: Record<string, number>;
  offensePositions: string[];
  defensePositions: string[];
  offenseAttributes: string[];
  defenseAttributes: string[];
  accentColor: string;
  highlightColor: string;
}

export const SPORT_PRESETS: SportPreset[] = [
  {
    key: "soccer",
    name: "Soccer",
    archetype: "league",
    icon: "\u26BD",
    defaultTeamCount: 20,
    minTeamCount: 8,
    maxTeamCount: 24,
    rosterSize: 23,
    positions: ["GK", "CB", "FB", "CM", "AM", "W", "ST"],
    ratingVector: ["pace", "shooting", "passing", "defending", "physical", "stamina", "composure"],
    federationName: "World Association Football Federation",
    federationShort: "WAFF",
    startingSlots: { GK: 1, CB: 2, FB: 2, CM: 3, AM: 1, W: 1, ST: 1 },
    offensePositions: ["ST", "W", "AM"],
    defensePositions: ["GK", "CB", "FB"],
    offenseAttributes: ["shooting", "passing", "pace"],
    defenseAttributes: ["defending", "physical", "composure"],
    accentColor: "274 57% 22%",
    highlightColor: "152 100% 50%",
  },
  {
    key: "football",
    name: "American Football",
    archetype: "division_conference",
    icon: "\uD83C\uDFC8",
    defaultTeamCount: 32,
    minTeamCount: 8,
    maxTeamCount: 32,
    rosterSize: 53,
    positions: ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"],
    ratingVector: [
      "strength",
      "speed",
      "agility",
      "technique",
      "intelligence",
      "stamina",
      "clutch",
    ],
    federationName: "International Gridiron Federation",
    federationShort: "IGF",
    startingSlots: { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 },
    offensePositions: ["QB", "RB", "WR", "TE", "OL"],
    defensePositions: ["DL", "LB", "CB", "S"],
    offenseAttributes: ["technique", "speed", "agility", "clutch"],
    defenseAttributes: ["strength", "technique", "intelligence", "stamina"],
    accentColor: "211 98% 21%",
    highlightColor: "210 10% 80%",
  },
  {
    key: "hockey",
    name: "Ice Hockey",
    archetype: "division_conference",
    icon: "\uD83C\uDFD2",
    defaultTeamCount: 30,
    minTeamCount: 6,
    maxTeamCount: 32,
    rosterSize: 20,
    positions: ["G", "D", "C", "LW", "RW"],
    ratingVector: [
      "skating",
      "shooting",
      "passing",
      "checking",
      "positioning",
      "reflexes",
      "physical",
    ],
    federationName: "World Ice Hockey Federation",
    federationShort: "WIHF",
    startingSlots: { G: 1, D: 2, C: 1, LW: 1, RW: 1 },
    offensePositions: ["C", "LW", "RW"],
    defensePositions: ["D", "G"],
    offenseAttributes: ["shooting", "passing", "skating"],
    defenseAttributes: ["checking", "positioning", "reflexes", "physical"],
    accentColor: "197 100% 44%",
    highlightColor: "180 5% 90%",
  },
  {
    key: "basketball",
    name: "Basketball",
    archetype: "division_conference",
    icon: "\uD83C\uDFC0",
    defaultTeamCount: 30,
    minTeamCount: 8,
    maxTeamCount: 32,
    rosterSize: 15,
    positions: ["PG", "SG", "SF", "PF", "C"],
    ratingVector: [
      "shooting",
      "dribbling",
      "passing",
      "defense",
      "rebounding",
      "athleticism",
      "iq",
    ],
    federationName: "Global Basketball Association",
    federationShort: "GBA",
    startingSlots: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
    offensePositions: ["PG", "SG", "SF"],
    defensePositions: ["PF", "C"],
    offenseAttributes: ["shooting", "dribbling", "passing"],
    defenseAttributes: ["defense", "rebounding", "athleticism"],
    accentColor: "204 100% 36%",
    highlightColor: "355 84% 51%",
  },
  {
    key: "baseball",
    name: "Baseball",
    archetype: "division_conference",
    icon: "\u26BE",
    defaultTeamCount: 30,
    minTeamCount: 8,
    maxTeamCount: 32,
    rosterSize: 26,
    positions: ["SP", "RP", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"],
    ratingVector: ["contact", "power", "speed", "fielding", "arm", "pitching", "discipline"],
    federationName: "World Baseball Confederation",
    federationShort: "WBC",
    startingSlots: {
      SP: 1,
      RP: 1,
      C: 1,
      "1B": 1,
      "2B": 1,
      "3B": 1,
      SS: 1,
      LF: 1,
      CF: 1,
      RF: 1,
      DH: 1,
    },
    offensePositions: ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"],
    defensePositions: ["SP", "RP"],
    offenseAttributes: ["contact", "power", "speed", "discipline"],
    defenseAttributes: ["pitching", "fielding", "arm"],
    accentColor: "210 100% 20%",
    highlightColor: "28 65% 55%",
  },
  {
    key: "f1",
    name: "F1 / Motorsport",
    archetype: "circuit",
    icon: "\uD83C\uDFCE\uFE0F",
    defaultTeamCount: 10,
    minTeamCount: 6,
    maxTeamCount: 14,
    rosterSize: 20,
    positions: ["driver", "team_principal", "race_engineer"],
    ratingVector: [
      "pace",
      "consistency",
      "wetSkill",
      "overtaking",
      "tyreManagement",
      "technicalFeedback",
      "starts",
    ],
    federationName: "International Racing Federation",
    federationShort: "IRF",
    startingSlots: { driver: 2, team_principal: 1, race_engineer: 1 },
    offensePositions: ["driver"],
    defensePositions: ["team_principal", "race_engineer"],
    offenseAttributes: ["pace", "overtaking", "starts"],
    defenseAttributes: ["consistency", "wetSkill", "tyreManagement"],
    accentColor: "2 100% 44%",
    highlightColor: "0 0% 10%",
  },
  {
    key: "boxing",
    name: "Boxing",
    archetype: "bracket",
    icon: "\uD83E\uDD4A",
    defaultTeamCount: 16,
    minTeamCount: 4,
    maxTeamCount: 64,
    rosterSize: 1,
    positions: ["fighter", "trainer"],
    ratingVector: ["power", "speed", "stamina", "defense", "chin", "footwork", "ringIQ"],
    federationName: "Istroyan Combat Commission",
    federationShort: "ICC",
    startingSlots: { fighter: 1, trainer: 1 },
    offensePositions: ["fighter"],
    defensePositions: ["trainer"],
    offenseAttributes: ["power", "speed", "ringIQ"],
    defenseAttributes: ["defense", "chin", "stamina", "footwork"],
    accentColor: "45 70% 53%",
    highlightColor: "348 83% 47%",
  },
];

export const SPORT_EMOJIS: Record<SportPresetKey, string> = {
  soccer: "⚽",
  football: "🏈",
  hockey: "🏒",
  basketball: "🏀",
  baseball: "⚾",
  f1: "🏎️",
  boxing: "🥊",
};

export function getSportEmoji(key: string): string {
  return SPORT_EMOJIS[key as SportPresetKey] ?? "⚽";
}

export function getSportColors(key: SportPresetKey): {
  accentColor: string;
  highlightColor: string;
} {
  const preset = getPreset(key);
  return { accentColor: preset.accentColor, highlightColor: preset.highlightColor };
}

export function getPreset(key: SportPresetKey): SportPreset {
  const preset = SPORT_PRESETS.find((p) => p.key === key);
  if (!preset) {
    throw new Error(`Sport preset not found for key: ${key}`);
  }
  return preset;
}

export function getPresetsByArchetype(archetype: ArchetypeType): SportPreset[] {
  return SPORT_PRESETS.filter((p) => p.archetype === archetype);
}

export function getAllPresets(): SportPreset[] {
  return SPORT_PRESETS;
}

export interface ArchetypeConfig {
  type: ArchetypeType;
  name: string;
  usesDivisions: boolean;
  usesPlayoffs: boolean;
  usesPoints: boolean;
  pointsForWin: number;
  pointsForDraw: number;
  postseasonType:
    "none" | "optional_playoff" | "seeded_bracket" | "elimination_bracket" | "points_championship";
}

export const ARCHETYPE_CONFIGS: ArchetypeConfig[] = [
  {
    type: "league",
    name: "League",
    usesDivisions: false,
    usesPlayoffs: true,
    usesPoints: true,
    pointsForWin: 3,
    pointsForDraw: 1,
    postseasonType: "optional_playoff",
  },
  {
    type: "division_conference",
    name: "Division / Conference",
    usesDivisions: true,
    usesPlayoffs: true,
    usesPoints: true,
    pointsForWin: 2,
    pointsForDraw: 1,
    postseasonType: "seeded_bracket",
  },
  {
    type: "bracket",
    name: "Bracket",
    usesDivisions: false,
    usesPlayoffs: true,
    usesPoints: false,
    pointsForWin: 1,
    pointsForDraw: 0,
    postseasonType: "elimination_bracket",
  },
  {
    type: "circuit",
    name: "Circuit",
    usesDivisions: false,
    usesPlayoffs: false,
    usesPoints: true,
    pointsForWin: 25,
    pointsForDraw: 0,
    postseasonType: "points_championship",
  },
];

export function getArchetypeConfig(type: ArchetypeType): ArchetypeConfig {
  const config = ARCHETYPE_CONFIGS.find((c) => c.type === type);
  if (!config) {
    throw new Error(`Archetype config not found for type: ${type}`);
  }
  return config;
}

export const SPORTS_ABBREVIATIONS: Record<string, string> = {
  // Soccer
  GK: "Goalkeeper",
  CB: "Center Back",
  FB: "Fullback",
  CM: "Central Midfielder",
  AM: "Attacking Midfielder",
  W: "Winger",
  ST: "Striker",
  // Football
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  OL: "Offensive Line",
  DL: "Defensive Line",
  LB: "Linebacker",
  S: "Safety",
  K: "Kicker",
  P: "Punter",
  // Hockey
  G: "Goalie",
  D: "Defenseman / Driver",
  C: "Center / Catcher",
  LW: "Left Wing",
  RW: "Right Wing",
  // Basketball
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  // Baseball
  SP: "Starting Pitcher",
  RP: "Relief Pitcher",
  "1B": "First Baseman",
  "2B": "Second Baseman",
  "3B": "Third Baseman",
  SS: "Shortstop",
  LF: "Left Fielder",
  CF: "Center Fielder",
  RF: "Right Fielder",
  DH: "Designated Hitter",
  // F1 / Racing
  driver: "Driver",
  team_principal: "Team Principal",
  race_engineer: "Race Engineer",
  // Boxing
  fighter: "Fighter",
  trainer: "Trainer",
};
