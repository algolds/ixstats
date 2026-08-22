/**
 * Shared helper functions for sports league demo seeding.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  generateTeamRoster,
  createRNG,
  getPreset,
  type SportPresetKey,
  type TeamRatingVector,
} from "../../sports";
import sportsData from "../../../../data/seed/sports-leagues.json";

export async function downloadImageForSeed(imageUrl: string): Promise<string> {
  if (imageUrl.includes("wikimedia.org") || imageUrl.includes("wikipedia.org")) {
    try {
      const decodedUrl = decodeURIComponent(imageUrl);
      const commonsMatch = decodedUrl.match(
        /\/wikipedia\/(?:commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^\/]+)/i
      );
      if (commonsMatch && commonsMatch[1]) {
        const filename = commonsMatch[1];
        return `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(filename.replace(/ /g, "_"))}`;
      }

      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      const lastSegment = pathname.split("/").pop();
      if (lastSegment && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(lastSegment)) {
        return `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(lastSegment.replace(/ /g, "_"))}`;
      }
    } catch (e) {
      console.error("[SeedImageDownload] Error parsing Wikimedia URL, falling back:", e);
    }
  }

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
    console.error(
      `[SeedImageDownload] Failed to download ${imageUrl}, using original URL. Error:`,
      err
    );
    return imageUrl;
  }
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function computePlayerAvg(ratings: Record<string, number>): number {
  const values = Object.values(ratings);
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeTeamRatingVector(
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

export function generateCulturallyAppropriateRoster(
  sport: SportPresetKey,
  seed: number,
  culture: "caphiria" | "yonderre" | "ohl" | "default"
) {
  const preset = getPreset(sport);
  const roster = generateTeamRoster({ sport, rosterSize: preset.rosterSize, seed });

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i]!;
    const itemSeed = seed + i * 37;
    const rng = createRNG(itemSeed);

    if (culture === "caphiria") {
      const { firsts, lasts } = sportsData.namePools.caphiria;
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    } else if (culture === "yonderre") {
      const { firsts, lasts } = sportsData.namePools.yonderre;
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    } else if (culture === "ohl") {
      const { firsts, lasts } = sportsData.namePools.ohl;
      p.firstName = firsts[Math.floor(rng() * firsts.length)]!;
      p.lastName = lasts[Math.floor(rng() * lasts.length)]!;
    }
  }
  return roster;
}
