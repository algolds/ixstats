/**
 * Demo seed for canonical sports leagues.
 *
 * Seeds three canonical leagues (soccer, F1, boxing) with completed seasons
 * including full rosters, match/race/bracket results, and standings.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import {
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  createRNG,
  resolveMatch,
  resolveRace,
  getPreset,
  type SportPresetKey,
  type TeamRatingVector,
} from "../sports";
import fs from "fs";
import path from "path";
import crypto from "crypto";

type Prisma = PrismaClient;

async function downloadImageForSeed(imageUrl: string): Promise<string> {
  try {
    const hash = crypto.createHash("md5").update(imageUrl).digest("hex");
    const ext = imageUrl.split(".").pop()?.split(/[?#]/)[0] || "jpg";
    const fileName = `seeded_${hash}.${ext}`;
    const imagesDir = path.join(process.cwd(), "public", "images", "downloaded");
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const filePath = path.join(imagesDir, fileName);
    const publicUrl = `/images/downloaded/${fileName}`;
    
    if (fs.existsSync(filePath)) {
      return publicUrl;
    }
    
    console.log(`[SeedImageDownload] Downloading: ${imageUrl}`);
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "IxStats/2.0 (https://ixwiki.com; contact@ixwiki.com)",
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    }
    
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    console.log(`[SeedImageDownload] Saved image to ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[SeedImageDownload] Failed to download ${imageUrl}, using original URL. Error:`, err);
    return imageUrl;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const CITY_NAMES = [
  "Olympus City",
  "Nova Albion",
  "Port Azure",
  "Crownhaven",
  "Ironforge",
  "Silverstead",
  "Goldenfield",
  "Westhaven",
  "Eastgate",
  "Northport",
  "Southbank",
  "Riverside",
  "Highcastle",
  "Stormwind",
  "Sunhaven",
  "Greenwood",
  "Oakvale",
  "Stonebridge",
  "Ashford",
  "Lakewood",
];

const F1_CONSTRUCTOR_NAMES = [
  "Velocity Racing",
  "Apex Motorsport",
  "Titan GP",
  "Phoenix Racing",
  "Storm Engineering",
  "Nova F1 Team",
  "Precision Motors",
  "Horizon Racing",
  "Quantum GP",
  "Fusion Motorsport",
];

const F1_CONSTRUCTOR_COLORS = [
  "#dc2626",
  "#2563eb",
  "#ca8a04",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#65a30d",
];

const CIRCUIT_NAMES = [
  "Aurelian Grand Prix Circuit",
  "Crownstone International Speedway",
  "Port Azure Street Circuit",
  "Silverstone Heritage Track",
  "Monte Cielo Circuit",
  "Ironforge Motorsport Park",
  "Goldenfield Raceway",
  "Westhaven Speed Ring",
  "Eastgate International Circuit",
  "Northport Coastal Track",
  "Southbank City Circuit",
  "Riverside Grand Prix",
  "Highcastle Mountain Course",
  "Stormwind Motor Arena",
  "Sunhaven Park Circuit",
  "Greenwood Forest Track",
  "Oakvale Racing Circuit",
  "Stonebridge Grand Prix",
  "Ashford Speedway",
  "Lakewood International Circuit",
];

function computePlayerAvg(ratings: Record<string, number>): number {
  const values = Object.values(ratings);
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeTeamRatingVector(
  players: Array<{ position: string; ratings: Record<string, number> }>,
  coach: {
    ratings: { strategy: number; development: number; motivation: number; adaptability: number };
  },
  sport: string,
  seed: number
): TeamRatingVector {
  const rng = createRNG(seed);
  const allAvgs = players.map((p) => computePlayerAvg(p.ratings));
  const overall = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 50;

  let offensivePositions: string[];
  let defensivePositions: string[];

  if (sport === "soccer") {
    offensivePositions = ["ST", "AM", "W"];
    defensivePositions = ["GK", "CB", "FB"];
  } else if (sport === "boxing") {
    offensivePositions = ["fighter"];
    defensivePositions = ["fighter"];
  } else {
    offensivePositions = ["driver"];
    defensivePositions = ["driver"];
  }

  const offPlayers = players.filter((p) => offensivePositions.includes(p.position));
  const defPlayers = players.filter((p) => defensivePositions.includes(p.position));

  const offense =
    offPlayers.length > 0
      ? offPlayers.map((p) => computePlayerAvg(p.ratings)).reduce((a, b) => a + b, 0) /
        offPlayers.length
      : overall;
  const defense =
    defPlayers.length > 0
      ? defPlayers.map((p) => computePlayerAvg(p.ratings)).reduce((a, b) => a + b, 0) /
        defPlayers.length
      : overall;

  const coachValues = Object.values(coach.ratings);
  const coaching = coachValues.reduce((a, b) => a + b, 0) / coachValues.length;
  const form = 40 + rng() * 30;
  const depth = 30 + rng() * 40;

  return {
    overall: Math.round(overall * 100) / 100,
    offense: Math.round(offense * 100) / 100,
    defense: Math.round(defense * 100) / 100,
    form: Math.round(form * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    coaching: Math.round(coaching * 100) / 100,
  };
}

// ─── Soccer League ──────────────────────────────────────────────────

const CAPHIRIAN_TEAMS = [
  { name: "Catenas Previcatores", patronSaint: "Saint Previcatus", color: "#dc2626" },
  { name: "Venceia Lupi", patronSaint: "Saint Rais", color: "#2563eb" },
  { name: "Venceia Ludis", patronSaint: "Saint Magador", color: "#0ea5e9" },
  { name: "Militaris FC", patronSaint: "Saint Maurice", color: "#16a34a" },
  { name: "Ludis Consociatio", patronSaint: "Saint Barbara", color: "#ea580c" },
  { name: "Ferriviaria Consociatio", patronSaint: "Saint Joseph", color: "#4f46e5" },
  { name: "Casterratti Ludis", patronSaint: "Saint Casterratus", color: "#8b5cf6" },
  { name: "Sierivi Consociatio", patronSaint: "Saint Christopher", color: "#f97316" },
  { name: "Sangorina Aquilae", patronSaint: "Saint Aquila", color: "#ca8a04" },
  { name: "Ampeloniki Bellatores", patronSaint: "Saint Inonsia", color: "#eab308" },
  { name: "Navalia", patronSaint: "Saint Nicholas", color: "#0891b2" },
  { name: "Genate Ludis", patronSaint: "Saint Genate", color: "#7c3aed" },
  { name: "Venatores", patronSaint: "Saint Hubertus", color: "#be123c" },
  { name: "Mero Pantherae", patronSaint: "Saint Mero", color: "#db2777" },
  { name: "Arzercavalli Tauri", patronSaint: "Saint Anthony", color: "#0d9488" },
  { name: "Faber Ferraruis", patronSaint: "Saint Eloi", color: "#374151" }
];

const YONDERRE_TEAMS = [
  { name: "1. FC Donnebourg", color: "#dc2626" },
  { name: "Artillerie FC", color: "#2563eb" },
  { name: "AS Castruppe", color: "#ca8a04" },
  { name: "AS Gabion-Vandarcôte", color: "#16a34a" },
  { name: "Collinebourg Chevaliers", color: "#9333ea" },
  { name: "Famichez 16", color: "#ea580c" },
  { name: "FC Vandarcholme", color: "#0891b2" },
  { name: "FC Sainte-Catherine", color: "#db2777" },
  { name: "FC Stahl Toubourg", color: "#4f46e5" },
  { name: "FC Willing", color: "#65a30d" },
  { name: "FSV Falcsbourg", color: "#0d9488" },
  { name: "FSV Zwischen", color: "#be123c" },
  { name: "Gabion Giants", color: "#7c3aed" },
  { name: "Lance FC", color: "#b45309" },
  { name: "Sainte-Jule-du-Mont AS", color: "#059669" },
  { name: "SC Sainte-Cataline", color: "#1d4ed8" },
  { name: "Toubourg FC", color: "#a21caf" },
  { name: "Vallonbourg AS", color: "#b91c1c" }
];

const OHL_TEAMS = [
  { name: "Auqali Shockers", city: "Atlomaha, Auqali", conference: "Eastern", division: "Southeast", color: "#eab308", coach: { firstName: "Aphío", lastName: "Antonov" }, nationName: "Tierrador" },
  { name: "Porto Alegre Tubarões", city: "Porto Alegre, Ceylonia", conference: "Eastern", division: "Southeast", color: "#06b6d4", coach: { firstName: "Petró", lastName: "Kiropiki" }, nationName: "Ceylonia" },
  { name: "Porvaos Condors", city: "Porvaos City, Porvaos", conference: "Eastern", division: "Southeast", color: "#3b82f6", coach: { firstName: "Lars", lastName: "Nygaard" }, nationName: "Porlos" },
  { name: "Sačia Tropics", city: "Sačia, Aracadó", conference: "Eastern", division: "Southeast", color: "#f97316", coach: { firstName: "Lazón", lastName: "Ašota" }, nationName: "Tierrador" },
  { name: "Santa Maria Blazers", city: "Santa Maria, Ceylonia", conference: "Eastern", division: "Southeast", color: "#ef4444", coach: { firstName: "Ahmad", lastName: "Ibrahim" }, nationName: "Ceylonia" },
  { name: "Tansher Spirit", city: "Tuwaheekee, Tansher", conference: "Eastern", division: "Southeast", color: "#8b5cf6", coach: { firstName: "Daisuke", lastName: "Sato" }, nationName: "Tierrador" },
  { name: "Tawakee Hurricanes", city: "San Cristóbal, Tawakee", conference: "Eastern", division: "Southeast", color: "#10b981", coach: { firstName: "Pamia", lastName: "Monteriya" }, nationName: "Tawakee" },
  { name: "Suqovia Phantoms", city: "Suqovia, Las Rozas", conference: "Eastern", division: "Southeast", color: "#a855f7", coach: { firstName: "Levar", lastName: "Xirótin" }, nationName: "Tierrador" },

  { name: "Bogocía Bluewave", city: "Holčaq, Bogocía", conference: "Eastern", division: "Central", color: "#2563eb", coach: { firstName: "Kil", lastName: "Faxanen" }, nationName: "Tierrador" },
  { name: "Karaba Ocelots", city: "Karaba, Istrenya", conference: "Eastern", division: "Central", color: "#ea580c", coach: { firstName: "Sven", lastName: "Schmidt" }, nationName: "Istrenya" },
  { name: "Hugo Hitmen", city: "Hugo, Qaleqa", conference: "Eastern", division: "Central", color: "#dc2626", coach: { firstName: "Pavlos", lastName: "Depátaí" }, nationName: "Tierrador" },
  { name: "Qabór Phoenix", city: "Qabór, Las Rozas", conference: "Eastern", division: "Central", color: "#eab308", coach: { firstName: "Timê", lastName: "Qistaanat" }, nationName: "Tierrador" },
  { name: "Moscakee Pioneers", city: "Puerto Rosario, Moscakee", conference: "Eastern", division: "Central", color: "#16a34a", coach: { firstName: "Tomás", lastName: "Morales" }, nationName: "Tierrador" },
  { name: "Taisgol Spires", city: "Woderq, Taisgol", conference: "Eastern", division: "Central", color: "#4f46e5", coach: { firstName: "Petr", lastName: "Tolakov" }, nationName: "Tierrador" },
  { name: "Taisgol Marksmen", city: "Eastern Bend, Taisgol", conference: "Eastern", division: "Central", color: "#0891b2", coach: { firstName: "Luca", lastName: "Bianchi" }, nationName: "Tierrador" },
  { name: "Topaqoí Wahoo", city: "Topaqoí, Telohakee", conference: "Eastern", division: "Central", color: "#ca8a04", coach: { firstName: "Arjun", lastName: "Singh" }, nationName: "Tierrador" },

  { name: "Alcosky Prairie Dogs", city: "Tarhogun, Alcosky", conference: "Western", division: "Mountain", color: "#b45309", coach: { firstName: "Pedro", lastName: "Torres" }, nationName: "Tierrador" },
  { name: "Anloiya Blizzard", city: "Anloiya, Ulunkheria", conference: "Western", division: "Mountain", color: "#0ea5e9", coach: { firstName: "Phoenix", lastName: "Simmons" }, nationName: "Tierrador" },
  { name: "Miccubo Heartlanders", city: "Miccubo, Telohakee", conference: "Western", division: "Mountain", color: "#be123c", coach: { firstName: "Oscar", lastName: "Morales" }, nationName: "Tierrador" },
  { name: "St. Gerónimo Outlaws", city: "St. Gerónimo, Alcosky", conference: "Western", division: "Mountain", color: "#ea580c", coach: { firstName: "Sapalina", lastName: "Wapaakojòò" }, nationName: "Tierrador" },
  { name: "Prisamarina Mystics", city: "Prisamarina, Ulunkheria", conference: "Western", division: "Mountain", color: "#db2777", coach: { firstName: "Ranger", lastName: "Pauliinet" }, nationName: "Tierrador" },
  { name: "Telohakee Wheatmen", city: "Qatólotay, Telohakee", conference: "Western", division: "Mountain", color: "#ca8a04", coach: { firstName: "Maté", lastName: "Utnalat" }, nationName: "Tierrador" },
  { name: "Tulangia Centurions", city: "Sevier, Ulunkheria", conference: "Western", division: "Mountain", color: "#dc2626", coach: { firstName: "Barry", lastName: "Adriza" }, nationName: "Tierrador" },
  { name: "Vernaza Titans", city: "Vernaza, Telohakee", conference: "Western", division: "Mountain", color: "#6366f1", coach: { firstName: "Jason", lastName: "Saunders" }, nationName: "Tierrador" },

  { name: "Alstin Sentinels", city: "Alstin, CDA", conference: "Western", division: "Southwest", color: "#2563eb", coach: { firstName: "Frederic", lastName: "Lalonde" }, nationName: "Alstin" },
  { name: "Cuzco Beserkers", city: "Cuzco City, Cuzco", conference: "Western", division: "Southwest", color: "#dc2626", coach: { firstName: "Karl", lastName: "Muller" }, nationName: "Alstin" },
  { name: "Naqili Hornets", city: "Naqili, Porlos", conference: "Western", division: "Southwest", color: "#ca8a04", coach: { firstName: "Kofi", lastName: "Okafor" }, nationName: "Porlos" },
  { name: "Pacuí Mammoth", city: "Pacuí, Porlos", conference: "Western", division: "Southwest", color: "#4b5563", coach: { firstName: "Sven", lastName: "Hansen" }, nationName: "Porlos" },
  { name: "Sedem Regni Thrones", city: "Sedem Regni, Betlands", conference: "Western", division: "Southwest", color: "#7c3aed", coach: { firstName: "Ivan", lastName: "Kozlov" }, nationName: "Betlands" },
  { name: "Utopia Rouges", city: "Utopia City, Utopia", conference: "Western", division: "Southwest", color: "#be123c", coach: { firstName: "Julius", lastName: "Roberts" }, nationName: "Alstin" },
  { name: "Veraise Raiders", city: "Gastineau, Veraise", conference: "Western", division: "Southwest", color: "#059669", coach: { firstName: "Tim", lastName: "Terrie" }, nationName: "Veraise" },
  { name: "Wallace Clerics", city: "Wallace, Omepra", conference: "Western", division: "Southwest", color: "#0891b2", coach: { firstName: "Tomás", lastName: "Roux" }, nationName: "Alstin" }
];

const HISTORIC_OHL_RECORDS = [
  { year: 2040, champion: "Sačia Tropics", score: "4–1", runnerUp: "St. Gerónimo Outlaws" },
  { year: 2039, champion: "Tawakee Hurricanes", score: "4–3", runnerUp: "Tulangia Centurions" },
  { year: 2038, champion: "Auqali Shockers", score: "4–2", runnerUp: "Tulangia Centurions" },
  { year: 2037, champion: "Tulangia Centurions", score: "4–0", runnerUp: "Auqali Shockers" },
  { year: 2036, champion: "Porto Alegre Tubarões", score: "4–1", runnerUp: "Telohakee Wheatmen" },
  { year: 2035, champion: "Veraise Raiders", score: "4–3", runnerUp: "Taisgol Spires" },
  { year: 2034, champion: "Tulangia Centurions", score: "4–3", runnerUp: "Suqovia Phantoms" },
  { year: 2029, champion: "Tulangia Centurions", score: "4–2", runnerUp: "Qabór Phoenix" },
  { year: 2025, champion: "Alstin Sentinels", score: "4–3", runnerUp: "Qabór Phoenix" },
  { year: 2024, champion: "Alstin Sentinels", score: "4–1", runnerUp: "Sačia Tropics" },
  { year: 2022, champion: "Tulangia Centurions", score: "4–2", runnerUp: "Sačia Tropics" },
  { year: 2021, champion: "Sačia Tropics", score: "4–1", runnerUp: "Alstin Sentinels" },
  { year: 2020, champion: "Sačia Tropics", score: "4–3", runnerUp: "Anloiya Blizzard" }
];

function generateCulturallyAppropriateRoster(
  sport: SportPresetKey,
  seed: number,
  culture: "caphiria" | "yonderre" | "ohl" | "default"
) {
  const preset = getPreset(sport);
  const roster = generateTeamRoster({ sport, rosterSize: preset.rosterSize, seed });

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i];
    const itemSeed = seed + i * 37;
    const rng = createRNG(itemSeed);

    if (culture === "caphiria") {
      const firsts = ["Lucius", "Gaius", "Marcus", "Aulus", "Flavius", "Tiberius", "Publius", "Servius", "Decimus", "Spurius", "Julius", "Augustus", "Cassius", "Cornelius", "Claudius", "Fabius", "Valerius", "Antonius", "Quintus", "Titus"];
      const lasts = ["Aetius", "Decimus", "Aurelius", "Agrippa", "Germanicus", "Severus", "Gracchus", "Cicero", "Venceia", "Previcatus", "Lupus", "Militaris", "Navalius", "Ferrarius", "Bellator", "Aquila", "Taurus", "Sierivi", "Genatus", "Casterratus"];
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    } else if (culture === "yonderre") {
      const firsts = ["Joanus", "Rachet", "Edouard", "Franz", "Otto", "Karl", "Wilhelm", "Heinrich", "Ludwig", "Hans", "Dieter", "Fritz", "Gottfried", "Gustav", "Emil", "Paul", "Albert", "Walter", "Rudolf", "Ulrich"];
      const lasts = ["Charpentier", "d'Agostino", "Gabion", "Vandarcôte", "Chevalier", "Donnebourg", "Stahl", "Willing", "Zwischen", "Falcsbourg", "Toubourg", "Vallonbourg", "Castruppe", "Famichez", "Lance", "Sainte-Catherine", "Sainte-Cataline", "Schmid", "Weber", "Müller"];
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    } else if (culture === "ohl") {
      const firsts = ["Barry", "Lazón", "Sapalina", "Pamia", "Aphío", "Petró", "Tim", "Levar", "Frederic", "Xavier", "Mike", "Vicente", "Hectór", "Pyotr", "Kasperi", "Jason", "Phoenix", "Kil", "Julius", "Kessok"];
      const lasts = ["Adriza", "Ašota", "Wapaakojòò", "Monteriya", "Antonov", "Kiropiki", "Terrie", "Xirótin", "Lalonde", "Cristobál", "DeSoto", "Valdueza", "Qosnan", "Časqon", "Aikala", "Saunders", "Simmons", "Faxanen", "Roberts", "Korentin"];
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    }
  }
  return roster;
}

// ─── Caphirian Imperial League (Soccer) ───────────────────────────────────

async function seedCaphirianSoccerLeague(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("Caphirian Imperial League");

  const caphiriaCountry = await prisma.country.findFirst({
    where: { name: { contains: "Caphiria", mode: "insensitive" } },
    select: { id: true }
  });
  const caphCountryId = caphiriaCountry?.id ?? null;

  const coverImage = await downloadImageForSeed("https://upload.wikimedia.org/wikipedia/commons/1/16/Wembley_Stadium_interior.jpg");
  const league = await prisma.sportLeague.create({
    data: {
      name: "Caphirian Imperial League",
      sportPreset: "soccer",
      archetype: "league",
      teamCount: 16,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      nationAffiliation: caphCountryId,
      coverImage,
    },
  });
  count++;

  const teams: Array<{
    id: string;
    name: string;
    players: ReturnType<typeof generateTeamRoster>;
    createdPlayers: Array<{ id: string; firstName: string; lastName: string; position: string; ratings: any }>;
    coach: ReturnType<typeof generateCoach>;
  }> = [];
  const teamRecords: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < CAPHIRIAN_TEAMS.length; i++) {
    const config = CAPHIRIAN_TEAMS[i]!;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: config.name,
        shortName: config.name.split(" ")[0] ?? config.name,
        city: "Venceia",
        color: config.color,
        foundedIxTime: ixNow - 1440 * 365 * (40 + (i % 25)),
        patronSaint: config.patronSaint,
        nationId: caphCountryId,
      },
    });
    count++;

    const players = generateCulturallyAppropriateRoster("soccer", teamSeed, "caphiria");
    const coach = generateCoach({ seed: teamSeed + 1 });
    const coachRng = createRNG(teamSeed + 2);
    const firsts = ["Lucius", "Gaius", "Marcus", "Aulus", "Flavius", "Tiberius", "Publius"];
    const lasts = ["Aetius", "Decimus", "Aurelius", "Agrippa", "Germanicus", "Severus", "Gracchus"];
    coach.firstName = firsts[Math.floor(coachRng() * firsts.length)]!;
    coach.lastName = lasts[Math.floor(coachRng() * lasts.length)]!;

    // Create players
    const createdPlayers: typeof teams[number]["createdPlayers"] = [];
    for (const player of players) {
      const pRecord = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          number: 1 + Math.floor(createRNG(teamSeed + hashString(player.lastName))() * 99),
          age: player.age,
          careerStage: player.careerStage,
          ratings: player.ratings,
          isActive: true,
        },
      });
      count++;
      createdPlayers.push({
        id: pRecord.id,
        firstName: pRecord.firstName,
        lastName: pRecord.lastName,
        position: pRecord.position,
        ratings: pRecord.ratings
      });
    }

    // Create coach
    await prisma.sportCoach.create({
      data: {
        teamId: team.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        role: coach.role,
        age: coach.age,
        careerStage: coach.careerStage,
        ratings: coach.ratings,
        isActive: true,
      },
    });
    count++;

    teamRecords.push({ id: team.id, name: config.name });
    teams.push({ id: team.id, name: config.name, players, createdPlayers, coach });
  }

  const seasonStart = ixNow - 259200;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  const fixtures = generateSchedule({
    archetype: "league",
    teamCount: 16,
    homeAwayFormat: "double",
  });

  const ratingVectors = teams.map((t) =>
    computeTeamRatingVector(t.players, t.coach, "soccer", hashString(t.name))
  );

  for (let i = 0; i < teams.length; i++) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: teams[i].id,
        ratingVector: ratingVectors[i] as any,
      },
    });
    count++;
  }

  const standings = new Map<
    string,
    { wins: number; losses: number; draws: number; gf: number; ga: number }
  >();
  for (const t of teams) {
    standings.set(t.id, { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 });
  }

  let matchIdx = 0;
  for (const fixture of fixtures) {
    const homeTeam = teams[fixture.homeTeamIndex]!;
    const awayTeam = teams[fixture.awayTeamIndex]!;
    const matchSeed = leagueSeed + 200000 + matchIdx * 7919;

    const homeRating = ratingVectors[fixture.homeTeamIndex]!;
    const awayRating = ratingVectors[fixture.awayTeamIndex]!;

    const result = resolveMatch({
      sport: "soccer",
      homeTeam: homeRating,
      awayTeam: awayRating,
      archetype: "league",
      seed: matchSeed,
      homeRoster: homeTeam.createdPlayers,
      awayRoster: awayTeam.createdPlayers
    });

    const matchIxTime = seasonStart + fixture.matchDay * 1440;

    await prisma.sportMatch.create({
      data: {
        seasonId: season.id,
        matchDay: fixture.matchDay,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: "completed",
        scheduledIxTime: matchIxTime,
        resolvedIxTime: matchIxTime + 120,
        matchStats: result.keyStats,
        homeRatingBefore: homeRating as any,
        awayRatingBefore: awayRating as any,
        homeRatingAfter: {
          ...homeRating,
          overall: Math.round((homeRating.overall + result.homeRatingDelta) * 100) / 100,
        } as any,
        awayRatingAfter: {
          ...awayRating,
          overall: Math.round((awayRating.overall + result.awayRatingDelta) * 100) / 100,
        } as any,
      },
    });
    count++;

    const hStand = standings.get(homeTeam.id)!;
    const aStand = standings.get(awayTeam.id)!;
    hStand.gf += result.homeScore;
    hStand.ga += result.awayScore;
    aStand.gf += result.awayScore;
    aStand.ga += result.homeScore;

    if (result.winner === "home") {
      hStand.wins++;
      aStand.losses++;
    } else if (result.winner === "away") {
      aStand.wins++;
      hStand.losses++;
    } else {
      hStand.draws++;
      aStand.draws++;
    }
    matchIdx++;
  }

  const standingsArr = Array.from(standings.entries()).map(([teamId, s]) => {
    const points = s.wins * 3 + s.draws;
    return { teamId, points, ...s };
  });
  standingsArr.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));

  for (let rank = 0; rank < standingsArr.length; rank++) {
    const s = standingsArr[rank]!;
    await prisma.sportStanding.create({
      data: {
        seasonId: season.id,
        teamId: s.teamId,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        points: s.points,
        pointsFor: s.gf,
        pointsAgainst: s.ga,
        rank: rank + 1,
      },
    });
    count++;
  }

  const champion = standingsArr[0]!;
  await prisma.sportSeason.update({
    where: { id: season.id },
    data: { championTeamId: champion.teamId },
  });

  await prisma.sportSeasonRecord.create({
    data: {
      leagueId: league.id,
      seasonId: season.id,
      recordType: "champion",
      holderId: champion.teamId,
      value: `${teamRecords.find((t) => t.id === champion.teamId)?.name ?? "Unknown"} - Season 1 Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
    },
  });
  count++;

  return count;
}

// ─── Ligue Yonderre (Soccer) ──────────────────────────────────────────────

async function seedYonderreSoccerLeague(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("Ligue Yonderre");

  const yonderreCountry = await prisma.country.findFirst({
    where: { name: { contains: "Yonderre", mode: "insensitive" } },
    select: { id: true }
  });
  const yondCountryId = yonderreCountry?.id ?? null;

  const coverImage = await downloadImageForSeed("https://upload.wikimedia.org/wikipedia/commons/4/46/Maracana_Stadium.jpg");
  const league = await prisma.sportLeague.create({
    data: {
      name: "Ligue Yonderre",
      sportPreset: "soccer",
      archetype: "league",
      teamCount: 18,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      nationAffiliation: yondCountryId,
      coverImage,
    },
  });
  count++;

  const teams: Array<{
    id: string;
    name: string;
    players: ReturnType<typeof generateTeamRoster>;
    createdPlayers: Array<{ id: string; firstName: string; lastName: string; position: string; ratings: any }>;
    coach: ReturnType<typeof generateCoach>;
  }> = [];
  const teamRecords: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < YONDERRE_TEAMS.length; i++) {
    const config = YONDERRE_TEAMS[i]!;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: config.name,
        shortName: config.name.split(" ")[0] ?? config.name,
        city: "Vandarcôte",
        color: config.color,
        foundedIxTime: ixNow - 1440 * 365 * (30 + (i % 20)),
        nationId: yondCountryId,
      },
    });
    count++;

    const players = generateCulturallyAppropriateRoster("soccer", teamSeed, "yonderre");
    const coach = generateCoach({ seed: teamSeed + 1 });
    const coachRng = createRNG(teamSeed + 2);
    const firsts = ["Joanus", "Franz", "Karl", "Dieter", "Fritz", "Gustav", "Hans"];
    const lasts = ["Charpentier", "Gabion", "Vandarcôte", "Donnebourg", "Stahl", "Willing", "Toubourg"];
    coach.firstName = firsts[Math.floor(coachRng() * firsts.length)]!;
    coach.lastName = lasts[Math.floor(coachRng() * lasts.length)]!;

    // Create players
    const createdPlayers: typeof teams[number]["createdPlayers"] = [];
    for (const player of players) {
      const pRecord = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          number: 1 + Math.floor(createRNG(teamSeed + hashString(player.lastName))() * 99),
          age: player.age,
          careerStage: player.careerStage,
          ratings: player.ratings,
          isActive: true,
        },
      });
      count++;
      createdPlayers.push({
        id: pRecord.id,
        firstName: pRecord.firstName,
        lastName: pRecord.lastName,
        position: pRecord.position,
        ratings: pRecord.ratings
      });
    }

    // Create coach
    await prisma.sportCoach.create({
      data: {
        teamId: team.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        role: coach.role,
        age: coach.age,
        careerStage: coach.careerStage,
        ratings: coach.ratings,
        isActive: true,
      },
    });
    count++;

    teamRecords.push({ id: team.id, name: config.name });
    teams.push({ id: team.id, name: config.name, players, createdPlayers, coach });
  }

  const seasonStart = ixNow - 259200;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  const fixtures = generateSchedule({
    archetype: "league",
    teamCount: 18,
    homeAwayFormat: "double",
  });

  const ratingVectors = teams.map((t) =>
    computeTeamRatingVector(t.players, t.coach, "soccer", hashString(t.name))
  );

  for (let i = 0; i < teams.length; i++) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: teams[i].id,
        ratingVector: ratingVectors[i] as any,
      },
    });
    count++;
  }

  const standings = new Map<
    string,
    { wins: number; losses: number; draws: number; gf: number; ga: number }
  >();
  for (const t of teams) {
    standings.set(t.id, { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 });
  }

  let matchIdx = 0;
  for (const fixture of fixtures) {
    const homeTeam = teams[fixture.homeTeamIndex]!;
    const awayTeam = teams[fixture.awayTeamIndex]!;
    const matchSeed = leagueSeed + 200000 + matchIdx * 7919;

    const homeRating = ratingVectors[fixture.homeTeamIndex]!;
    const awayRating = ratingVectors[fixture.awayTeamIndex]!;

    const result = resolveMatch({
      sport: "soccer",
      homeTeam: homeRating,
      awayTeam: awayRating,
      archetype: "league",
      seed: matchSeed,
      homeRoster: homeTeam.createdPlayers,
      awayRoster: awayTeam.createdPlayers
    });

    const matchIxTime = seasonStart + fixture.matchDay * 1440;

    await prisma.sportMatch.create({
      data: {
        seasonId: season.id,
        matchDay: fixture.matchDay,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: "completed",
        scheduledIxTime: matchIxTime,
        resolvedIxTime: matchIxTime + 120,
        matchStats: result.keyStats,
        homeRatingBefore: homeRating as any,
        awayRatingBefore: awayRating as any,
        homeRatingAfter: {
          ...homeRating,
          overall: Math.round((homeRating.overall + result.homeRatingDelta) * 100) / 100,
        } as any,
        awayRatingAfter: {
          ...awayRating,
          overall: Math.round((awayRating.overall + result.awayRatingDelta) * 100) / 100,
        } as any,
      },
    });
    count++;

    const hStand = standings.get(homeTeam.id)!;
    const aStand = standings.get(awayTeam.id)!;
    hStand.gf += result.homeScore;
    hStand.ga += result.awayScore;
    aStand.gf += result.awayScore;
    aStand.ga += result.homeScore;

    if (result.winner === "home") {
      hStand.wins++;
      aStand.losses++;
    } else if (result.winner === "away") {
      aStand.wins++;
      hStand.losses++;
    } else {
      hStand.draws++;
      aStand.draws++;
    }
    matchIdx++;
  }

  const standingsArr = Array.from(standings.entries()).map(([teamId, s]) => {
    const points = s.wins * 3 + s.draws;
    return { teamId, points, ...s };
  });
  standingsArr.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));

  for (let rank = 0; rank < standingsArr.length; rank++) {
    const s = standingsArr[rank]!;
    await prisma.sportStanding.create({
      data: {
        seasonId: season.id,
        teamId: s.teamId,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        points: s.points,
        pointsFor: s.gf,
        pointsAgainst: s.ga,
        rank: rank + 1,
      },
    });
    count++;
  }

  const champion = standingsArr[0]!;
  await prisma.sportSeason.update({
    where: { id: season.id },
    data: { championTeamId: champion.teamId },
  });

  await prisma.sportSeasonRecord.create({
    data: {
      leagueId: league.id,
      seasonId: season.id,
      recordType: "champion",
      holderId: champion.teamId,
      value: `${teamRecords.find((t) => t.id === champion.teamId)?.name ?? "Unknown"} - Season 1 Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
    },
  });
  count++;

  return count;
}

// ─── Orixtal Hockey League (OHL) (Ice Hockey) ─────────────────────────────

async function seedOHLHockeyLeague(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("Orixtal Hockey League");

  // Lookup countries first for speed
  const countries = await prisma.country.findMany({
    select: { id: true, name: true }
  });
  const findCountryId = (name: string) => {
    const match = countries.find(c => c.name.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  };

  const coverImage = await downloadImageForSeed("https://upload.wikimedia.org/wikipedia/commons/9/92/Scotiabank_Saddledome.jpg");
  const league = await prisma.sportLeague.create({
    data: {
      name: "Orixtal Hockey League",
      sportPreset: "hockey",
      archetype: "division_conference",
      teamCount: 32,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      coverImage,
      settings: {
        divisions: 4,
        conferences: 2
      } as any
    },
  });
  count++;

  const teams: Array<{
    id: string;
    name: string;
    conference: string;
    division: string;
    players: ReturnType<typeof generateTeamRoster>;
    createdPlayers: Array<{ id: string; firstName: string; lastName: string; position: string; ratings: any }>;
    coach: ReturnType<typeof generateCoach>;
  }> = [];
  const teamRecords: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < OHL_TEAMS.length; i++) {
    const config = OHL_TEAMS[i]!;
    const teamSeed = leagueSeed + i * 1000;
    const nationId = findCountryId(config.nationName);

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: config.name,
        shortName: config.name.split(" ").pop() ?? config.name,
        city: config.city.split(",")[0] ?? "Taisgol",
        color: config.color,
        foundedIxTime: ixNow - 1440 * 365 * (50 + (i % 30)),
        nationId,
      },
    });
    count++;

    const players = generateCulturallyAppropriateRoster("hockey", teamSeed, "ohl");
    const coach = generateCoach({ seed: teamSeed + 1 });
    coach.firstName = config.coach.firstName;
    coach.lastName = config.coach.lastName;

    // Create players
    const createdPlayers: typeof teams[number]["createdPlayers"] = [];
    for (const player of players) {
      const pRecord = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          number: 1 + Math.floor(createRNG(teamSeed + hashString(player.lastName))() * 99),
          age: player.age,
          careerStage: player.careerStage,
          ratings: player.ratings,
          isActive: true,
        },
      });
      count++;
      createdPlayers.push({
        id: pRecord.id,
        firstName: pRecord.firstName,
        lastName: pRecord.lastName,
        position: pRecord.position,
        ratings: pRecord.ratings
      });
    }

    // Create coach
    await prisma.sportCoach.create({
      data: {
        teamId: team.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        role: "Head Coach",
        age: coach.age,
        careerStage: coach.careerStage,
        ratings: coach.ratings,
        isActive: true,
      },
    });
    count++;

    teamRecords.push({ id: team.id, name: config.name });
    teams.push({
      id: team.id,
      name: config.name,
      conference: config.conference,
      division: config.division,
      players,
      createdPlayers,
      coach
    });
  }

  const seasonStart = ixNow - 259200;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // 4 divisions of 8 teams index mappings
  const divisionsConfig = [
    { name: "Southeast", teamIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
    { name: "Central", teamIndices: [8, 9, 10, 11, 12, 13, 14, 15] },
    { name: "Mountain", teamIndices: [16, 17, 18, 19, 20, 21, 22, 23] },
    { name: "Southwest", teamIndices: [24, 25, 26, 27, 28, 29, 30, 31] }
  ];

  const fixtures = generateSchedule({
    archetype: "division_conference",
    teamCount: 32,
    divisions: divisionsConfig,
    conferenceCount: 2,
    divisionCount: 2
  });

  const ratingVectors = teams.map((t) =>
    computeTeamRatingVector(t.players, t.coach, "hockey", hashString(t.name))
  );

  for (let i = 0; i < teams.length; i++) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: teams[i].id,
        ratingVector: ratingVectors[i] as any,
      },
    });
    count++;
  }

  const standings = new Map<
    string,
    { wins: number; losses: number; draws: number; gf: number; ga: number }
  >();
  for (const t of teams) {
    standings.set(t.id, { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 });
  }

  let matchIdx = 0;
  for (const fixture of fixtures) {
    const homeTeam = teams[fixture.homeTeamIndex]!;
    const awayTeam = teams[fixture.awayTeamIndex]!;
    const matchSeed = leagueSeed + 200000 + matchIdx * 7919;

    const homeRating = ratingVectors[fixture.homeTeamIndex]!;
    const awayRating = ratingVectors[fixture.awayTeamIndex]!;

    const result = resolveMatch({
      sport: "hockey",
      homeTeam: homeRating,
      awayTeam: awayRating,
      archetype: "division_conference",
      seed: matchSeed,
      homeRoster: homeTeam.createdPlayers,
      awayRoster: awayTeam.createdPlayers
    });

    const matchIxTime = seasonStart + fixture.matchDay * 1440;

    await prisma.sportMatch.create({
      data: {
        seasonId: season.id,
        matchDay: fixture.matchDay,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: "completed",
        scheduledIxTime: matchIxTime,
        resolvedIxTime: matchIxTime + 120,
        matchStats: result.keyStats,
        homeRatingBefore: homeRating as any,
        awayRatingBefore: awayRating as any,
        homeRatingAfter: {
          ...homeRating,
          overall: Math.round((homeRating.overall + result.homeRatingDelta) * 100) / 100,
        } as any,
        awayRatingAfter: {
          ...awayRating,
          overall: Math.round((awayRating.overall + result.awayRatingDelta) * 100) / 100,
        } as any,
      },
    });
    count++;

    const hStand = standings.get(homeTeam.id)!;
    const aStand = standings.get(awayTeam.id)!;
    hStand.gf += result.homeScore;
    hStand.ga += result.awayScore;
    aStand.gf += result.awayScore;
    aStand.ga += result.homeScore;

    if (result.winner === "home") {
      hStand.wins++;
      aStand.losses++;
    } else if (result.winner === "away") {
      aStand.wins++;
      hStand.losses++;
    } else {
      hStand.draws++;
      aStand.draws++;
    }
    matchIdx++;
  }

  // Create standings with conference/division ranks
  const standingsArr = Array.from(standings.entries()).map(([teamId, s]) => {
    const points = s.wins * 2 + s.draws; // Win is 2 points, Draw/OTL is 1 point in hockey
    const teamMeta = teams.find(t => t.id === teamId)!;
    return {
      teamId,
      points,
      conference: teamMeta.conference,
      division: teamMeta.division,
      ...s
    };
  });

  // Sort within each division to assign local rank
  const divisions = ["Southeast", "Central", "Mountain", "Southwest"];
  for (const divName of divisions) {
    const divStandings = standingsArr.filter(s => s.division === divName);
    divStandings.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));
    for (let r = 0; r < divStandings.length; r++) {
      const s = divStandings[r]!;
      await prisma.sportStanding.create({
        data: {
          seasonId: season.id,
          teamId: s.teamId,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          points: s.points,
          pointsFor: s.gf,
          pointsAgainst: s.ga,
          division: s.division,
          conference: s.conference,
          rank: r + 1,
        },
      });
      count++;
    }
  }

  // Set league champion (overall points leader in regular season)
  standingsArr.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));
  const champion = standingsArr[0]!;
  await prisma.sportSeason.update({
    where: { id: season.id },
    data: { championTeamId: champion.teamId },
  });

  await prisma.sportSeasonRecord.create({
    data: {
      leagueId: league.id,
      seasonId: season.id,
      recordType: "champion",
      holderId: champion.teamId,
      value: `${teamRecords.find((t) => t.id === champion.teamId)?.name ?? "Unknown"} - Season 1 Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
    },
  });
  count++;

  // Add historical Watson Cup champions
  for (const record of HISTORIC_OHL_RECORDS) {
    const champTeam = teams.find(t => t.name === record.champion);
    if (champTeam) {
      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "watson_cup_historic",
          holderId: champTeam.id,
          value: `${record.year} Watson Cup Winner: ${record.champion} defeat ${record.runnerUp} (${record.score})`,
        }
      });
      count++;
    }
  }

  return count;
}


// ─── F1 / Motorsport ────────────────────────────────────────────────

async function seedF1League(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const preset = getPreset("f1");
  const leagueSeed = hashString("IRF World Championship");
  const raceCount = 20;

  const coverImage = await downloadImageForSeed("https://upload.wikimedia.org/wikipedia/commons/9/92/Monaco_Grand_Prix.jpg");
  const league = await prisma.sportLeague.create({
    data: {
      name: "IRF World Championship",
      sportPreset: "f1",
      archetype: "circuit",
      teamCount: 10,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  // Create teams
  const teams: Array<{
    id: string;
    name: string;
    drivers: Array<{ id: string; ratings: Record<string, number> }>;
  }> = [];

  for (let i = 0; i < 10; i++) {
    const constructorName = F1_CONSTRUCTOR_NAMES[i]!;
    const shortName = constructorName.split(" ")[0]!;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: constructorName,
        shortName,
        color: F1_CONSTRUCTOR_COLORS[i],
        foundedIxTime: ixNow - 1440 * 365 * (15 + (i % 10)),
      },
    });
    count++;

    const rng = createRNG(teamSeed);

    // Create 2 drivers
    const drivers: Array<{ id: string; ratings: Record<string, number> }> = [];
    for (let d = 0; d < 2; d++) {
      const driverSeed = teamSeed + 100 + d * 7919;
      const drng = createRNG(driverSeed);
      const driverRatings: Record<string, number> = {
        pace: Math.round(50 + drng() * 45),
        consistency: Math.round(40 + drng() * 50),
        wetSkill: Math.round(30 + drng() * 60),
        overtaking: Math.round(35 + drng() * 55),
        tyreManagement: Math.round(40 + drng() * 50),
        technicalFeedback: Math.round(30 + drng() * 60),
        starts: Math.round(40 + drng() * 50),
      };
      const firstName = [
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
        "Enzo",
        "Kai",
        "Sergei",
        "Pedro",
        "Luca",
        "Niko",
      ][i * 2 + d]!;
      const lastName = [
        "Kozlov",
        "Dubois",
        "Tanaka",
        "Muller",
        "Santos",
        "Park",
        "Ferrari",
        "Jensen",
        "Nakamura",
        "Silva",
        "Petrov",
        "Kowalski",
        "Garcia",
        "Rossi",
        "Fernandez",
        "Chen",
        "Vasquez",
        "Lindberg",
        "Costa",
        "Zhang",
      ][i * 2 + d]!;

      const driver = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName,
          lastName,
          position: "driver",
          number: d === 0 ? 1 : 2,
          age: Math.floor(20 + drng() * 15),
          careerStage: "prime",
          ratings: driverRatings,
          isActive: true,
        },
      });
      count++;
      drivers.push({ id: driver.id, ratings: driverRatings });
    }

    // Create team principal
    const tpRatings = {
      pace: Math.round(rng() * 30),
      consistency: Math.round(rng() * 30),
      wetSkill: Math.round(rng() * 30),
      overtaking: Math.round(rng() * 30),
      tyreManagement: Math.round(30 + rng() * 40),
      technicalFeedback: Math.round(50 + rng() * 40),
      starts: Math.round(rng() * 30),
    };
    const tp = await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: [
          "Henrik",
          "Matteo",
          "Bjorn",
          "Anton",
          "Gustav",
          "Erik",
          "Ravi",
          "Idris",
          "Sami",
          "Boris",
        ][i]!,
        lastName: [
          "Berg",
          "Vogel",
          "Jensen",
          "Romanov",
          "Holm",
          "Sorensen",
          "Ibrahim",
          "Mwangi",
          "Larsson",
          "Novak",
        ][i]!,
        position: "team_principal",
        age: Math.floor(40 + rng() * 20),
        careerStage: "prime",
        ratings: tpRatings,
        isActive: true,
      },
    });
    count++;

    // Create race engineer
    const reRatings = {
      pace: Math.round(rng() * 30),
      consistency: Math.round(30 + rng() * 40),
      wetSkill: Math.round(30 + rng() * 40),
      overtaking: Math.round(rng() * 25),
      tyreManagement: Math.round(40 + rng() * 45),
      technicalFeedback: Math.round(50 + rng() * 40),
      starts: Math.round(rng() * 25),
    };
    await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: ["Wei", "Jin", "Ahmad", "Tunde", "Kofi", "Ren", "Ali", "Piotr", "Zain", "Tomás"][
          i
        ]!,
        lastName: [
          "Yamamoto",
          "Watanabe",
          "Ito",
          "Ndiaye",
          "Choi",
          "Okafor",
          "Adebayo",
          "Singh",
          "Moreau",
          "Roux",
        ][i]!,
        position: "race_engineer",
        age: Math.floor(30 + rng() * 20),
        careerStage: "prime",
        ratings: reRatings,
        isActive: true,
      },
    });
    count++;

    teams.push({ id: team.id, name: constructorName, drivers });
  }

  // Create season
  const seasonStart = ixNow - 259200;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // Create team seasons
  for (const team of teams) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        ratingVector: { overall: 50, offense: 50, defense: 50, form: 50, depth: 50, coaching: 50 },
      },
    });
    count++;
  }

  // Driver standings accumulator
  const driverPoints = new Map<string, number>();
  const constructorPoints = new Map<string, number>();
  for (const t of teams) {
    constructorPoints.set(t.id, 0);
    for (const d of t.drivers) {
      driverPoints.set(d.id, 0);
    }
  }

  // Create and resolve races
  for (let raceNum = 0; raceNum < raceCount; raceNum++) {
    const raceSeed = leagueSeed + 300000 + raceNum * 7919;
    const circuitName = CIRCUIT_NAMES[raceNum]!;
    const raceIxTime = seasonStart + raceNum * 8640; // ~ every 6 IxTime days

    // Generate qualifying grid (just random order for demo)
    const rng = createRNG(raceSeed);
    const allDrivers = teams.flatMap((t) =>
      t.drivers.map((d) => ({
        driverId: d.id,
        teamId: t.id,
        pace: d.ratings.pace ?? 50,
        consistency: d.ratings.consistency ?? 50,
        wetSkill: d.ratings.wetSkill ?? 50,
        overtaking: d.ratings.overtaking ?? 50,
        tyreManagement: d.ratings.tyreManagement ?? 50,
        starts: d.ratings.starts ?? 50,
      }))
    );

    const grid = allDrivers.map((d, idx) => ({
      driverId: d.driverId,
      teamId: d.teamId,
      gridPosition: idx + 1,
    }));

    // Resolve race
    const isWet = rng() < 0.2;
    const result = resolveRace({
      drivers: allDrivers,
      seed: raceSeed + 1,
      isWet,
    });

    await prisma.sportRace.create({
      data: {
        seasonId: season.id,
        raceNumber: raceNum + 1,
        circuitName,
        raceIxTime,
        status: "completed",
        grid: JSON.stringify(grid),
        results: JSON.stringify(result.positions),
        weather: isWet ? "wet" : "dry",
      },
    });
    count++;

    // Update standings
    for (const pos of result.positions) {
      driverPoints.set(pos.driverId, (driverPoints.get(pos.driverId) ?? 0) + pos.points);
      if (pos.fastestLap) {
        driverPoints.set(pos.driverId, (driverPoints.get(pos.driverId) ?? 0) + 1);
      }
      constructorPoints.set(pos.teamId, (constructorPoints.get(pos.teamId) ?? 0) + pos.points);
    }
  }

  // Determine champion
  const driverStandings = Array.from(driverPoints.entries()).sort((a, b) => b[1] - a[1]);
  const constructorStandings = Array.from(constructorPoints.entries()).sort((a, b) => b[1] - a[1]);

  const championDriverId = driverStandings[0]?.[0];
  const championTeamId = constructorStandings[0]?.[0];

  if (championTeamId) {
    await prisma.sportSeason.update({
      where: { id: season.id },
      data: { championTeamId },
    });
  }

  // Create driver champion record
  if (championDriverId) {
    const driver = await prisma.sportPlayer.findUnique({
      where: { id: championDriverId },
      select: { firstName: true, lastName: true, team: { select: { name: true } } },
    });
    if (driver) {
      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "drivers_champion",
          holderId: championDriverId,
          value: `${driver.firstName} ${driver.lastName} (${driver.team.name}) - ${driverStandings[0]![1]} pts`,
        },
      });
      count++;
    }
  }

  // Create constructor champion record
  if (championTeamId) {
    const team = teams.find((t) => t.id === championTeamId);
    if (team) {
      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "constructors_champion",
          holderId: championTeamId,
          value: `${team.name} - ${constructorStandings[0]![1]} pts`,
        },
      });
      count++;
    }
  }

  return count;
}

// ─── Boxing Bracket ─────────────────────────────────────────────────

async function seedBoxingLeague(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("ICC Heavyweight Grand Prix");

  const coverImage = await downloadImageForSeed("https://upload.wikimedia.org/wikipedia/commons/7/7e/Boxing_ring.jpg");
  const league = await prisma.sportLeague.create({
    data: {
      name: "ICC Heavyweight Grand Prix",
      sportPreset: "boxing",
      archetype: "bracket",
      teamCount: 16,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  // Create 16 fighters as individual teams
  const fighters: Array<{
    teamId: string;
    playerId: string;
    name: string;
    ratings: Record<string, number>;
  }> = [];

  const fighterFirstNames = [
    "Marco",
    "Dmitri",
    "Carlos",
    "Kwame",
    "Diego",
    "Boris",
    "Tunde",
    "Enzo",
    "Sergei",
    "Pedro",
    "Mateo",
    "Thiago",
    "Arjun",
    "Luca",
    "Niko",
    "Ivan",
  ];
  const fighterLastNames = [
    "Kozlov",
    "Santos",
    "Okafor",
    "Ferrari",
    "Mwangi",
    "Petrov",
    "Ndiaye",
    "Rossi",
    "Vasquez",
    "Silva",
    "Garcia",
    "Costa",
    "Singh",
    "Bianchi",
    "Tanaka",
    "Andersen",
  ];

  for (let i = 0; i < 16; i++) {
    const fighterName = `${fighterFirstNames[i]} "${["The Hammer", "Iron", "Lightning", "The Wall", "Bulldog", "Hurricane", "Titan", "Cobra", "The Bear", "Falcon", "Wolf", "Dragon", "Gladiator", "Phantom", "Viper", "Cyclone"][i]}" ${fighterLastNames[i]}`;
    const fighterSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: fighterName,
        shortName: `${fighterFirstNames[i]} ${fighterLastNames[i]}`,
        color: [
          "#dc2626",
          "#2563eb",
          "#ca8a04",
          "#16a34a",
          "#9333ea",
          "#ea580c",
          "#0891b2",
          "#db2777",
          "#4f46e5",
          "#65a30d",
          "#0d9488",
          "#be123c",
          "#7c3aed",
          "#b45309",
          "#059669",
          "#1d4ed8",
        ][i],
        foundedIxTime: ixNow - 1440 * 365 * 5,
      },
    });
    count++;

    const rng = createRNG(fighterSeed);
    const fighterRatings: Record<string, number> = {
      power: Math.round(50 + rng() * 45),
      speed: Math.round(40 + rng() * 50),
      stamina: Math.round(40 + rng() * 50),
      defense: Math.round(35 + rng() * 55),
      chin: Math.round(40 + rng() * 50),
      footwork: Math.round(35 + rng() * 55),
      ringIQ: Math.round(30 + rng() * 60),
    };

    const player = await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: fighterFirstNames[i]!,
        lastName: fighterLastNames[i]!,
        position: "fighter",
        age: Math.floor(22 + rng() * 12),
        careerStage: "prime",
        ratings: fighterRatings,
        isActive: true,
      },
    });
    count++;

    fighters.push({
      teamId: team.id,
      playerId: player.id,
      name: `${fighterFirstNames[i]!} ${fighterLastNames[i]!}`,
      ratings: fighterRatings,
    });
  }

  // Create season
  const seasonStart = ixNow - 129600;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // Create team seasons
  for (const f of fighters) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: f.teamId,
        ratingVector: {
          overall: Math.round(computePlayerAvg(f.ratings)),
          offense: Math.round((f.ratings.power + f.ratings.speed) / 2),
          defense: Math.round((f.ratings.defense + f.ratings.chin) / 2),
          form: 50,
          depth: 50,
          coaching: 50,
        },
      },
    });
    count++;
  }

  // Manually run bracket tournament: 16 → 8 → 4 → 2 → champion
  // Round 1: seed 1 vs 16, 2 vs 15, 3 vs 14, ... 8 vs 9
  let roundFighters: Array<(typeof fighters)[number]> = [...fighters];
  // Reorder for bracket pairing: top of bracket vs bottom
  const bracketOrder: typeof fighters = [];
  const half = 8;
  for (let i = 0; i < half; i++) {
    bracketOrder.push(roundFighters[i]!, roundFighters[15 - i]!);
  }
  roundFighters = bracketOrder;

  let roundNum = 1;
  let bracketMatchCount = 0;

  while (roundFighters.length >= 2) {
    const nextRound: typeof fighters = [];
    const isChampionship = roundFighters.length === 2;

    for (let i = 0; i < roundFighters.length; i += 2) {
      const homeFighter = roundFighters[i]!;
      const awayFighter = roundFighters[i + 1]!;
      const matchSeed = leagueSeed + 400000 + bracketMatchCount * 7919;
      bracketMatchCount++;

      const homeRatingVector: TeamRatingVector = {
        overall: Math.round(computePlayerAvg(homeFighter.ratings)),
        offense: Math.round((homeFighter.ratings.power + homeFighter.ratings.speed) / 2),
        defense: Math.round((homeFighter.ratings.defense + homeFighter.ratings.chin) / 2),
        form: 50,
        depth: 50,
        coaching: 50,
      };
      const awayRatingVector: TeamRatingVector = {
        overall: Math.round(computePlayerAvg(awayFighter.ratings)),
        offense: Math.round((awayFighter.ratings.power + awayFighter.ratings.speed) / 2),
        defense: Math.round((awayFighter.ratings.defense + awayFighter.ratings.chin) / 2),
        form: 50,
        depth: 50,
        coaching: 50,
      };

      const result = resolveMatch({
        sport: "boxing",
        homeTeam: homeRatingVector,
        awayTeam: awayRatingVector,
        archetype: "bracket",
        seed: matchSeed,
        context: { isChampionship, isPlayoff: !isChampionship },
      });

      const boutIxTime = seasonStart + roundNum * 2880;

      const winnerId = result.winner === "home" ? homeFighter.playerId : awayFighter.playerId;
      const methods = ["KO", "TKO", "UD", "SD", "MD"];

      await prisma.sportBracket.create({
        data: {
          seasonId: season.id,
          round: roundNum,
          weightClass: "heavyweight",
          fighter1Id: homeFighter.playerId,
          fighter2Id: awayFighter.playerId,
          winnerId,
          status: "completed",
          scheduledIxTime: boutIxTime,
          resolvedIxTime: boutIxTime + 60,
          result: {
            method: methods[bracketMatchCount % methods.length]!,
            round: Math.floor(1 + createRNG(matchSeed + 99)() * 12),
            time: `${Math.floor(1 + createRNG(matchSeed + 100)() * 3)}:${String(Math.floor(createRNG(matchSeed + 101)() * 60)).padStart(2, "0")}`,
          },
        },
      });
      count++;

      nextRound.push(result.winner === "home" ? homeFighter : awayFighter);
    }

    roundFighters = nextRound;
    roundNum++;

    // Champion determined
    if (roundFighters.length === 1) {
      const champion = roundFighters[0]!;
      await prisma.sportSeason.update({
        where: { id: season.id },
        data: { championTeamId: champion.teamId },
      });

      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "champion",
          holderId: champion.teamId,
          value: `${champion.name} - ICC Heavyweight Grand Prix Champion`,
        },
      });
      count++;
    }
  }

  return count;
}

// ─── Main Entry Point ───────────────────────────────────────────────

export async function seedSportsLeagues(
  prisma: Prisma,
  countryId: string,
  userId: string
): Promise<number> {
  let count = 0;
  const ixNow = IxTime.getCurrentIxTime();

  // Check if canonical leagues already exist
  const existing = await prisma.sportLeague.count({ where: { isCanonical: true } });
  if (existing > 0) {
    return 0;
  }

  count += await seedCaphirianSoccerLeague(prisma, userId, ixNow);
  count += await seedYonderreSoccerLeague(prisma, userId, ixNow);
  count += await seedOHLHockeyLeague(prisma, userId, ixNow);
  count += await seedF1League(prisma, userId, ixNow);
  count += await seedBoxingLeague(prisma, userId, ixNow);

  return count;
}
