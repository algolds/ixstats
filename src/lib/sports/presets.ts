export type ArchetypeType = "league" | "division_conference" | "bracket" | "circuit";
export type SportPresetKey = "soccer" | "football" | "hockey" | "basketball" | "baseball" | "f1" | "boxing";

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
    ratingVector: ["strength", "speed", "agility", "technique", "intelligence", "stamina", "clutch"],
    federationName: "International Gridiron Federation",
    federationShort: "IGF",
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
    ratingVector: ["skating", "shooting", "passing", "checking", "positioning", "reflexes", "physical"],
    federationName: "World Ice Hockey Federation",
    federationShort: "WIHF",
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
    ratingVector: ["shooting", "dribbling", "passing", "defense", "rebounding", "athleticism", "iq"],
    federationName: "Global Basketball Association",
    federationShort: "GBA",
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
    ratingVector: ["pace", "consistency", "wetSkill", "overtaking", "tyreManagement", "technicalFeedback", "starts"],
    federationName: "International Racing Federation",
    federationShort: "IRF",
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
  },
];

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
  postseasonType: "none" | "optional_playoff" | "seeded_bracket" | "elimination_bracket" | "points_championship";
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
