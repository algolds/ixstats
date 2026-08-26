/**
 * scripts/rebuild-clean-loreward-stats.ts — Pure Namespace 0 Lore Telemetry Rebuilder
 *
 * Recalculates all Loreward user stats, total scores, written byte volume,
 * and leaderboard rankings strictly from Main Article (Namespace 0) revisions,
 * filtering out all template imports, system scripts, and bot accounts.
 *
 * Usage:
 *   bun run scripts/rebuild-clean-loreward-stats.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

const BOT_ACCOUNTS = ["LorewardsBot", "Maintenance script", "Robot", "System", "Admin"];

async function main() {
  console.log("==================================================================");
  console.log("🏆 Rebuilding Pure Namespace 0 Loreward User Telemetry");
  console.log("==================================================================");

  // 1. Group revisions strictly for Namespace 0 articles and non-bot authors
  const authorGroups = await prisma.wikiRevision.groupBy({
    by: ["author"],
    where: {
      source: "ixwiki",
      author: {
        not: null,
        notIn: BOT_ACCOUNTS,
      },
      article: {
        namespace: 0,
      },
    },
    _count: { id: true },
    _sum: { byteSize: true },
  });

  console.log(`Found ${authorGroups.length} human authors with Main Article (ns:0) contributions.`);

  // 2. Fetch daily win counts from LorewardEntry
  const entries = await prisma.lorewardEntry.findMany({
    where: { status: "approved" },
    select: { winnerUser: true, runnerUpUser: true, date: true },
  });

  const dailyWinsMap = new Map<string, number>();
  const dailyRunnerUpsMap = new Map<string, number>();
  const lastWinDateMap = new Map<string, string>();

  for (const e of entries) {
    if (e.winnerUser) {
      dailyWinsMap.set(e.winnerUser, (dailyWinsMap.get(e.winnerUser) || 0) + 1);
      const curLast = lastWinDateMap.get(e.winnerUser);
      if (!curLast || e.date > curLast) {
        lastWinDateMap.set(e.winnerUser, e.date);
      }
    }
    if (e.runnerUpUser) {
      dailyRunnerUpsMap.set(e.runnerUpUser, (dailyRunnerUpsMap.get(e.runnerUpUser) || 0) + 1);
    }
  }

  // 3. Upsert clean Loreward stats per author
  let updatedCount = 0;
  for (const ag of authorGroups) {
    if (!ag.author) continue;

    const editCount = ag._count.id;
    const totalBytes = ag._sum.byteSize || 0;
    const wins = dailyWinsMap.get(ag.author) || 0;
    const runnerUps = dailyRunnerUpsMap.get(ag.author) || 0;
    const lastWinDate = lastWinDateMap.get(ag.author) || null;

    // Lore score: 10 pts per ns:0 edit + 1 pt per 500 bytes + 100 pts per daily win + 50 pts per runner-up
    const score = editCount * 10 + Math.round(totalBytes / 500) + wins * 100 + runnerUps * 50;

    await prisma.lorewardUserStats.upsert({
      where: { username: ag.author },
      create: {
        username: ag.author,
        totalScore: score,
        totalBytes,
        dailyWins: wins,
        dailyRunnerUps: runnerUps,
        lastWinDate,
        currentStreak: 1,
        longestStreak: 1,
      },
      update: {
        totalScore: score,
        totalBytes,
        dailyWins: wins,
        dailyRunnerUps: runnerUps,
        lastWinDate,
      },
    });
    updatedCount++;
  }

  // 4. Reset bot accounts to 0 score if they exist
  for (const bot of BOT_ACCOUNTS) {
    try {
      await prisma.lorewardUserStats.delete({
        where: { username: bot },
      });
    } catch {}
  }

  console.log(`\n✅ Successfully rebuilt ${updatedCount} clean Loreward user profiles.`);

  // 5. Display Top 15 Clean Leaderboard
  const topLeaderboard = await prisma.lorewardUserStats.findMany({
    orderBy: { totalScore: "desc" },
    take: 15,
  });

  console.log("\n--- Top 15 Lore Leaderboard (Pure Namespace 0 Lore) ---");
  topLeaderboard.forEach((u, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. ${u.username.padEnd(16)} | Score: ${String(u.totalScore).padStart(8)} | Bytes: ${String(u.totalBytes).padStart(10)} | Wins: ${u.dailyWins}`
    );
  });

  console.log("==================================================================");
  await prisma.$disconnect();
  process.exit(0);
}

main();
