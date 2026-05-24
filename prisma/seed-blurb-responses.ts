/**
 * seed-blurb-responses.ts — Import Discord #lore-prompts responses into BlurbResponse.
 *
 * Maps Discord usernames to IxStats users via country name matching.
 * Only imports responses for users who have countries in IxStats.
 * Matches responses to existing BlurbPrompts by fuzzy content matching.
 *
 * Run: npx tsx prisma/seed-blurb-responses.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const db = new PrismaClient();

// Discord username -> country name (manually curated)
const DISCORD_TO_COUNTRY: Record<string, string> = {
  urcea: "Urcea",
  bourgondie: "Burgundie",
  mr_ballz1111111: "Tierrador",
  keaor: "Faneria",
  masinstante: "Caphiria",
  cyril_gwynne_spyncer: "Castadilla",
  bobbo3: "Daxia",
  heku_: "Kabasa",
  ".stealie_2": "Nasastan",
  ".retrofossil": "Cartadania",
  laughing_tree: "Fiannria",
  iander: "Maresteyn",
  lambchops: "Burgundie",
  ralkern: "Drasenia",
};

// Prompt detection keywords
const PROMPT_KEYWORDS = [
  "topic tuesday",
  "thot-ic",
  "wopic",
  "tropic tuesday",
  "#tropictuesday",
  "#wapwednesday",
  "lore contest",
  "lore prompt",
];
const QUESTION_PATTERNS = [
  "what is your",
  "what are your",
  "how does your",
  "how is your",
  "what was",
  "what does your",
  "does your nation",
  "in your country",
  "in your nation",
  "of your nation",
  "of your country",
];

function isPromptMessage(content: string): boolean {
  const lower = content.toLowerCase();
  if (PROMPT_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (
    content.length > 100 &&
    content.includes("?") &&
    QUESTION_PATTERNS.some((kw) => lower.includes(kw))
  )
    return true;
  return false;
}

// Fuzzy match a Discord prompt to a BlurbPrompt by comparing question text
function findMatchingPrompt(
  discordContent: string,
  blurbPrompts: { id: string; title: string; question: string; slug: string }[]
): (typeof blurbPrompts)[0] | null {
  const lower = discordContent.toLowerCase();

  // Try exact question substring match
  for (const bp of blurbPrompts) {
    const qLower = bp.question.toLowerCase();
    // Check if the blurb question appears in the discord message or vice versa
    if (lower.includes(qLower.slice(0, 40)) || qLower.includes(lower.slice(0, 60))) {
      return bp;
    }
  }

  // Try title keyword match
  for (const bp of blurbPrompts) {
    const titleWords = bp.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matchCount = titleWords.filter((w) => lower.includes(w)).length;
    if (titleWords.length > 0 && matchCount >= Math.ceil(titleWords.length * 0.6)) {
      return bp;
    }
  }

  return null;
}

async function main() {
  // Load Discord messages
  const rawMsgs = JSON.parse(fs.readFileSync("/tmp/lore-prompts-all.json", "utf8")) as {
    id: string;
    content: string;
    author: { username: string };
    timestamp: string;
  }[];
  console.log(`Loaded ${rawMsgs.length} Discord messages`);

  // Load existing BlurbPrompts
  const blurbPrompts = await db.blurbPrompt.findMany({
    select: { id: true, title: true, question: true, slug: true },
  });
  console.log(`Found ${blurbPrompts.length} existing BlurbPrompts`);

  // Load users and countries
  const users = await db.user.findMany({
    select: { id: true, countryId: true, country: { select: { name: true } } },
  });
  const countries = await db.country.findMany({
    select: { id: true, name: true },
  });

  // Build lookup maps
  const countryByName = new Map(countries.map((c) => [c.name.toLowerCase(), c]));
  const userByCountryName = new Map<string, { id: string; countryId: string }>();
  for (const u of users) {
    if (u.country?.name && u.countryId) {
      const key = u.country.name.toLowerCase();
      if (!userByCountryName.has(key)) {
        userByCountryName.set(key, { id: u.id, countryId: u.countryId });
      }
    }
  }

  // Process messages chronologically
  const chronological = [...rawMsgs].reverse();

  let currentDiscordPrompt: (typeof rawMsgs)[0] | null = null;
  let currentBlurbPrompt: (typeof blurbPrompts)[0] | null = null;

  let imported = 0;
  let skippedNoMapping = 0;
  let skippedNoPrompt = 0;
  let skippedDuplicate = 0;
  let skippedTooShort = 0;
  let skippedBots = 0;

  const SKIP_AUTHORS = new Set(["Dyno", "IxBot", "Deleted User"]);

  for (const msg of chronological) {
    const content = msg.content?.trim();
    if (!content) continue;

    const author = msg.author.username;
    if (SKIP_AUTHORS.has(author)) {
      skippedBots++;
      continue;
    }

    // Check if this is a prompt message
    if (isPromptMessage(content)) {
      currentDiscordPrompt = msg;
      currentBlurbPrompt = findMatchingPrompt(content, blurbPrompts);
      if (currentBlurbPrompt) {
        console.log(`  Matched prompt: "${currentBlurbPrompt.title}" ← ${content.slice(0, 60)}...`);
      }
      continue;
    }

    // Skip short messages
    if (content.length < 30) {
      skippedTooShort++;
      continue;
    }

    // Must have an active prompt context
    if (!currentDiscordPrompt || !currentBlurbPrompt) {
      skippedNoPrompt++;
      continue;
    }

    // Check time proximity (within 30 days of prompt)
    const msgDate = new Date(msg.timestamp);
    const promptDate = new Date(currentDiscordPrompt.timestamp);
    const daysDiff = (msgDate.getTime() - promptDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 0 || daysDiff > 30) {
      skippedNoPrompt++;
      continue;
    }

    // Map author to user/country
    const countryName = DISCORD_TO_COUNTRY[author];
    if (!countryName) {
      skippedNoMapping++;
      continue;
    }

    const userRecord = userByCountryName.get(countryName.toLowerCase());
    if (!userRecord) {
      skippedNoMapping++;
      continue;
    }

    // Check for existing response (unique constraint: promptId + userId)
    const existing = await db.blurbResponse.findUnique({
      where: {
        promptId_userId: {
          promptId: currentBlurbPrompt.id,
          userId: userRecord.id,
        },
      },
    });
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    // Truncate to 1000 chars
    const truncatedContent = content.slice(0, 1000);

    try {
      await db.blurbResponse.create({
        data: {
          promptId: currentBlurbPrompt.id,
          userId: userRecord.id,
          countryId: userRecord.countryId,
          content: truncatedContent,
          createdAt: new Date(msg.timestamp),
        },
      });
      imported++;
    } catch (e: any) {
      if (e.code === "P2002") {
        skippedDuplicate++;
      } else {
        console.error(`  Error importing ${author}'s response:`, e.message);
      }
    }
  }

  console.log(`\nDone:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (no user mapping): ${skippedNoMapping}`);
  console.log(`  Skipped (no matching prompt): ${skippedNoPrompt}`);
  console.log(`  Skipped (duplicate): ${skippedDuplicate}`);
  console.log(`  Skipped (too short): ${skippedTooShort}`);
  console.log(`  Skipped (bots): ${skippedBots}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
