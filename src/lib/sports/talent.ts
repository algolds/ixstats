import { createRNG } from "./resolver";
import type { SportPresetKey } from "./presets";
import { getPreset } from "./presets";

export type CareerStage = "rookie" | "developing" | "prime" | "plateau" | "declining" | "retired";

export interface MarkovTransition {
  from: CareerStage;
  to: CareerStage;
  probability: number;
}

export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  careerStage: CareerStage;
  ratings: Record<string, number>;
}

const FIRST_NAMES: string[] = [
  "Alex",
  "Marco",
  "Yuki",
  "Dmitri",
  "Carlos",
  "Liam",
  "Jean",
  "Hiroshi",
  "Omar",
  "Viktor",
  "Andre",
  "Sven",
  "Kwame",
  "Diego",
  "Boris",
  "Lars",
  "Rafael",
  "Tunde",
  "Enzo",
  "Kai",
  "Sergei",
  "Pedro",
  "Emil",
  "Jin",
  "Mateo",
  "Thiago",
  "Arjun",
  "Luca",
  "Niko",
  "Wei",
  "Ivan",
  "Gustav",
  "Oscar",
  "Takumi",
  "Hugo",
  "Kofi",
  "Ren",
  "Ali",
  "Santiago",
  "Yann",
  "Cristian",
  "Mikhail",
  "João",
  "Seung",
  "Bjorn",
  "Ahmad",
  "Piotr",
  "Tomás",
  "Kenji",
  "Zain",
  "Henrik",
  "Matteo",
  "Daisuke",
  "Erik",
  "Ravi",
  "Felipe",
  "Anton",
  "Leon",
  "Sami",
  "Idris",
];

const LAST_NAMES: string[] = [
  "Kozlov",
  "Dubois",
  "Tanaka",
  "Muller",
  "Santos",
  "Park",
  "Okafor",
  "Ferrari",
  "Jensen",
  "Mwangi",
  "Berg",
  "Nakamura",
  "Silva",
  "Petrov",
  "Kowalski",
  "Ito",
  "Andersen",
  "Garcia",
  "Schmidt",
  "Kim",
  "Yamamoto",
  "Rossi",
  "Lund",
  "Fernandez",
  "Sato",
  "Olsen",
  "Morales",
  "Hoffman",
  "Lee",
  "Ndiaye",
  "Vasquez",
  "Lindberg",
  "Choi",
  "Novak",
  "Martinez",
  "Watanabe",
  "Hansen",
  "Roux",
  "Costa",
  "Zhang",
  "Johansson",
  "Takahashi",
  "Moreau",
  "Popov",
  "Nygaard",
  "Alvarez",
  "Sorensen",
  "Chen",
  "Bianchi",
  "Singh",
  "Holm",
  "Kurosawa",
  "Torres",
  "Vogel",
  "Rivera",
  "Nielsen",
  "Ibrahim",
  "Romanov",
  "Larsson",
  "Adebayo",
];

const COACH_ROLES = [
  "manager",
  "head_coach",
  "assistant",
  "goalkeeper_coach",
  "offensive_coordinator",
  "defensive_coordinator",
  "special_teams_coach",
  "pitching_coach",
  "hitting_coach",
  "bench_coach",
  "strength_coach",
  "scout",
  "technical_director",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function advanceCareerStage(
  current: CareerStage,
  age: number,
  coachDevelopment: number,
  seed: number
): CareerStage {
  if (current === "retired") return "retired";

  const rng = createRNG(seed);
  const devModifier = 1 + ((coachDevelopment - 50) / 50) * 0.1;
  let baseProbability: number;

  switch (current) {
    case "rookie":
      baseProbability = 0.85;
      if (age < 20) baseProbability *= 0.6;
      else if (age < 22) baseProbability *= 0.8;
      else if (age > 24) baseProbability *= 1.2;
      break;
    case "developing":
      baseProbability = 0.6;
      if (age >= 24 && age <= 29) baseProbability *= 1.3;
      else if (age > 29) baseProbability *= 0.8;
      break;
    case "prime":
      baseProbability = 0.4;
      if (age > 30) baseProbability *= 1.4;
      else if (age > 28) baseProbability *= 1.2;
      break;
    case "plateau":
      baseProbability = 0.5;
      if (age > 33) baseProbability *= 1.4;
      else if (age > 31) baseProbability *= 1.2;
      break;
    case "declining":
      baseProbability = 0.7;
      if (age > 36) baseProbability *= 1.3;
      else if (age > 34) baseProbability *= 1.1;
      break;
    default:
      baseProbability = 0;
  }

  const adjustedProbability = clamp(baseProbability * devModifier, 0, 1);
  const roll = rng();

  if (roll < adjustedProbability) {
    switch (current) {
      case "rookie":
        return "developing";
      case "developing":
        return "prime";
      case "prime":
        return "plateau";
      case "plateau":
        return "declining";
      case "declining":
        return "retired";
    }
  }

  return current;
}

export function generatePlayer(args: {
  sport: SportPresetKey;
  position?: string;
  age?: number;
  careerStage?: CareerStage;
  seed: number;
}): GeneratedPlayer {
  const preset = getPreset(args.sport);
  const rng = createRNG(args.seed);

  const position = args.position ?? preset.positions[Math.floor(rng() * preset.positions.length)];

  const age = args.age ?? Math.floor(18 + rng() * 17);

  const careerStage =
    args.careerStage ??
    (age < 21
      ? "rookie"
      : age < 25
        ? "developing"
        : age < 30
          ? "prime"
          : age < 34
            ? "plateau"
            : "declining");

  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];

  const stageMultiplier: Record<CareerStage, number> = {
    rookie: 0.7,
    developing: 0.85,
    prime: 1.1,
    plateau: 1.0,
    declining: 0.8,
    retired: 0.5,
  };

  const positionModifiers = getPositionModifiers(args.sport, position);
  const ratings: Record<string, number> = {};

  for (const key of preset.ratingVector) {
    const base = 40 + rng() * 55;
    const posMod = positionModifiers[key] ?? 0;
    const stageMod = stageMultiplier[careerStage];
    const raw = base * stageMod + posMod;
    ratings[key] = clamp(Math.round(raw), 1, 99);
  }

  return {
    firstName,
    lastName,
    position,
    age,
    careerStage,
    ratings,
  };
}

function getPositionModifiers(sport: SportPresetKey, position: string): Record<string, number> {
  const modifiers: Record<string, Record<string, Record<string, number>>> = {
    soccer: {
      GK: { pace: -10, shooting: -15, passing: -5, defending: 5, physical: 5, composure: 10 },
      CB: { pace: -5, shooting: -10, passing: 0, defending: 15, physical: 10, stamina: 5 },
      FB: { pace: 10, shooting: -5, passing: 0, defending: 10, physical: 5, stamina: 10 },
      CM: { pace: 0, shooting: 5, passing: 15, defending: 5, physical: 5, stamina: 10 },
      AM: { pace: 5, shooting: 10, passing: 15, defending: -5, physical: -5, composure: 10 },
      W: { pace: 15, shooting: 5, passing: 5, defending: -10, physical: -5, stamina: 5 },
      ST: { pace: 10, shooting: 15, passing: -5, defending: -10, physical: 5, composure: 10 },
    },
    football: {
      QB: { strength: -10, speed: -5, agility: 0, technique: 15, intelligence: 15, clutch: 10 },
      RB: { strength: 5, speed: 15, agility: 10, technique: 0, stamina: 5, clutch: 0 },
      WR: { strength: -5, speed: 15, agility: 15, technique: 5, clutch: 5 },
      TE: { strength: 10, speed: 0, agility: 0, technique: 10, stamina: 5 },
      OL: { strength: 15, speed: -10, agility: -5, technique: 10, stamina: 5 },
      DL: { strength: 15, speed: 5, agility: 5, technique: 5, stamina: 0 },
      LB: { strength: 10, speed: 5, agility: 5, technique: 5, intelligence: 5 },
      CB: { speed: 15, agility: 15, technique: 0, clutch: 5 },
      S: { strength: -5, speed: 10, agility: 10, intelligence: 10, clutch: 5 },
      K: { strength: -15, speed: -15, agility: -10, technique: 15, clutch: 15 },
      P: { strength: -10, speed: -15, agility: -10, technique: 15, clutch: 5 },
    },
    hockey: {
      G: {
        skating: -10,
        shooting: -15,
        passing: -5,
        checking: -5,
        positioning: 15,
        reflexes: 15,
        physical: 0,
      },
      D: { skating: 5, shooting: 5, passing: 5, checking: 10, positioning: 10, physical: 5 },
      C: { skating: 5, shooting: 10, passing: 15, checking: 0, positioning: 5, physical: 0 },
      LW: { skating: 10, shooting: 10, passing: 5, checking: 0, positioning: 0, physical: 5 },
      RW: { skating: 10, shooting: 10, passing: 5, checking: 0, positioning: 0, physical: 5 },
    },
    basketball: {
      PG: {
        shooting: 5,
        dribbling: 15,
        passing: 15,
        defense: -5,
        rebounding: -15,
        athleticism: 5,
        iq: 10,
      },
      SG: {
        shooting: 15,
        dribbling: 10,
        passing: 0,
        defense: 0,
        rebounding: -10,
        athleticism: 10,
        iq: 0,
      },
      SF: {
        shooting: 10,
        dribbling: 5,
        passing: 0,
        defense: 5,
        rebounding: 5,
        athleticism: 10,
        iq: 0,
      },
      PF: {
        shooting: 0,
        dribbling: -5,
        passing: -5,
        defense: 10,
        rebounding: 15,
        athleticism: 10,
        iq: 0,
      },
      C: {
        shooting: -10,
        dribbling: -15,
        passing: -5,
        defense: 15,
        rebounding: 15,
        athleticism: 0,
        iq: 0,
      },
    },
    baseball: {
      SP: {
        contact: -15,
        power: -15,
        speed: -5,
        fielding: -5,
        arm: 5,
        pitching: 15,
        discipline: 0,
      },
      RP: {
        contact: -15,
        power: -15,
        speed: -5,
        fielding: -5,
        arm: 5,
        pitching: 10,
        discipline: 0,
      },
      C: { contact: 0, power: 5, speed: -10, fielding: 15, arm: 15, pitching: -15, discipline: 5 },
      "1B": { contact: 5, power: 15, speed: -5, fielding: 5, arm: 0, pitching: -15, discipline: 5 },
      "2B": {
        contact: 5,
        power: -5,
        speed: 10,
        fielding: 15,
        arm: 5,
        pitching: -15,
        discipline: 5,
      },
      "3B": {
        contact: 5,
        power: 10,
        speed: 5,
        fielding: 10,
        arm: 15,
        pitching: -15,
        discipline: 5,
      },
      SS: { contact: 5, power: 0, speed: 10, fielding: 15, arm: 10, pitching: -15, discipline: 5 },
      LF: { contact: 5, power: 10, speed: 10, fielding: 5, arm: 5, pitching: -15, discipline: 0 },
      CF: { contact: 5, power: 5, speed: 15, fielding: 10, arm: 5, pitching: -15, discipline: 0 },
      RF: { contact: 5, power: 10, speed: 10, fielding: 5, arm: 10, pitching: -15, discipline: 0 },
      DH: {
        contact: 10,
        power: 15,
        speed: -5,
        fielding: -15,
        arm: -15,
        pitching: -15,
        discipline: 10,
      },
    },
    f1: {
      driver: {
        pace: 10,
        consistency: 5,
        wetSkill: 5,
        overtaking: 5,
        tyreManagement: 5,
        technicalFeedback: -5,
        starts: 5,
      },
      team_principal: {
        pace: -15,
        consistency: -10,
        wetSkill: -10,
        overtaking: -10,
        tyreManagement: -5,
        technicalFeedback: 15,
        starts: -5,
      },
      race_engineer: {
        pace: -5,
        consistency: 5,
        wetSkill: 5,
        overtaking: 0,
        tyreManagement: 10,
        technicalFeedback: 10,
        starts: 0,
      },
    },
    boxing: {
      fighter: { power: 10, speed: 5, stamina: 5, defense: 5, chin: 5, footwork: 5, ringIQ: 0 },
      trainer: {
        power: -15,
        speed: -15,
        stamina: -10,
        defense: -10,
        chin: -15,
        footwork: -10,
        ringIQ: 15,
      },
    },
  };

  return modifiers[sport]?.[position] ?? {};
}

export function generateRookieClass(args: {
  sport: SportPresetKey;
  count: number;
  seed: number;
}): GeneratedPlayer[] {
  const rookies: GeneratedPlayer[] = [];
  for (let i = 0; i < args.count; i++) {
    rookies.push(
      generatePlayer({
        sport: args.sport,
        age: Math.floor(18 + Math.random()),
        careerStage: "rookie",
        seed: args.seed + i * 137,
      })
    );
  }
  return rookies;
}

export function generateTeamRoster(args: {
  sport: SportPresetKey;
  rosterSize: number;
  seed: number;
}): GeneratedPlayer[] {
  const preset = getPreset(args.sport);
  const rng = createRNG(args.seed);
  const roster: GeneratedPlayer[] = [];

  const positionCounts = new Map<string, number>();
  const baseSlotsPerPosition = Math.floor(args.rosterSize / preset.positions.length);

  for (const pos of preset.positions) {
    positionCounts.set(pos, baseSlotsPerPosition);
  }

  const remaining = args.rosterSize - baseSlotsPerPosition * preset.positions.length;
  const priorityPositions = [...preset.positions].sort(() => rng() - 0.5);
  for (let i = 0; i < remaining; i++) {
    const pos = priorityPositions[i % priorityPositions.length];
    positionCounts.set(pos, (positionCounts.get(pos) ?? 0) + 1);
  }

  let playerSeed = args.seed;
  positionCounts.forEach((count, position) => {
    for (let i = 0; i < count; i++) {
      roster.push(
        generatePlayer({
          sport: args.sport,
          position,
          seed: playerSeed + i * 7919,
        })
      );
    }
    playerSeed += 1000;
  });

  return roster;
}

export function generateCoach(args: { seed: number }): {
  firstName: string;
  lastName: string;
  role: string;
  age: number;
  careerStage: CareerStage;
  ratings: {
    strategy: number;
    development: number;
    motivation: number;
    adaptability: number;
  };
} {
  const rng = createRNG(args.seed);

  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const role = COACH_ROLES[Math.floor(rng() * COACH_ROLES.length)];
  const age = Math.floor(35 + rng() * 30);

  let careerStage: CareerStage;
  if (age < 40) careerStage = "developing";
  else if (age < 50) careerStage = "prime";
  else if (age < 60) careerStage = "plateau";
  else careerStage = "declining";

  const stageMultiplier: Record<string, number> = {
    rookie: 0.7,
    developing: 0.85,
    prime: 1.1,
    plateau: 1.0,
    declining: 0.8,
    retired: 0.5,
  };

  const mult = stageMultiplier[careerStage];
  const base = 40;

  return {
    firstName,
    lastName,
    role,
    age,
    careerStage,
    ratings: {
      strategy: clamp(Math.round((base + rng() * 55) * mult), 1, 99),
      development: clamp(Math.round((base + rng() * 55) * mult), 1, 99),
      motivation: clamp(Math.round((base + rng() * 55) * mult), 1, 99),
      adaptability: clamp(Math.round((base + rng() * 55) * mult), 1, 99),
    },
  };
}
