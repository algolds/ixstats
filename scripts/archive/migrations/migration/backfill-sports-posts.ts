#!/usr/bin/env tsx

/**
 * Migration script to backfill and regenerate past sports posts in the ThinkPages feed.
 * It parses raw markdown posts and encodes them with the JSON structured comment marker
 * and standard linebreaks (no dividers), while dynamically looking up missing league
 * and team IDs from the database to populate links.
 *
 * Run with --write to save changes to the database.
 */

import { PrismaClient } from "@prisma/client";
import {
  parseSportsBulletin,
  encodeSportsBulletin,
  formatMatchDayBulletin,
  formatSeasonChampionBulletin,
  formatPlayoffBulletin,
} from "../../src/lib/sports/feed-bulletins";

const db = new PrismaClient();

async function main() {
  const writeMode = process.argv.includes("--write");

  console.log(
    `🔍 Sports Post Backfill & ID Link Lookup Tool (${writeMode ? "WRITE MODE" : "DRY RUN MODE"})`
  );
  console.log("--------------------------------------------------");

  const account = await db.thinkpagesAccount.findUnique({
    where: { username: "SportsNews" },
  });

  if (!account) {
    console.error("❌ SportsNews account not found in the database. Seeding may be required.");
    process.exit(1);
  }

  const posts = await db.thinkpagesPost.findMany({
    where: { accountId: account.id },
    orderBy: { ixTimeTimestamp: "desc" },
  });

  console.log(`Found ${posts.length} total posts for @SportsNews`);
  let parsedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const post of posts) {
    try {
      const data = parseSportsBulletin(post.content);
      if (!data) {
        console.log(
          `[SKIP] Could not parse post ${post.id}: ${JSON.stringify(post.content.slice(0, 80))}...`
        );
        skippedCount++;
        continue;
      }

      // Dynamic database lookups for missing IDs to populate Markdown links
      if (!data.league.id) {
        const dbLeague = await db.sportLeague.findFirst({
          where: { name: data.league.name },
        });
        if (dbLeague) {
          data.league.id = dbLeague.id;
        }
      }

      if (data.isChampionBulletin && data.championName && !data.championId) {
        const dbChampion = await db.sportTeam.findFirst({
          where: { name: data.championName },
        });
        if (dbChampion) {
          data.championId = dbChampion.id;
        }
      }

      if (data.results) {
        for (const r of data.results) {
          if (!r.home.id) {
            const dbHome = await db.sportTeam.findFirst({
              where: { name: r.home.name },
            });
            if (dbHome) r.home.id = dbHome.id;
          }
          if (!r.away.id) {
            const dbAway = await db.sportTeam.findFirst({
              where: { name: r.away.name },
            });
            if (dbAway) r.away.id = dbAway.id;
          }
        }
      }

      if (data.movers) {
        for (const m of data.movers) {
          if (!m.id) {
            const dbMover = await db.sportTeam.findFirst({
              where: { name: m.name },
            });
            if (dbMover) m.id = dbMover.id;
          }
        }
      }

      // Regenerate the clean markdown content using formatters (which will output Markdown links now that IDs are set)
      let cleanContent = "";
      if (data.isChampionBulletin) {
        cleanContent = formatSeasonChampionBulletin({
          leagueName: data.league.name,
          leagueId: data.league.id,
          sportEmoji: data.sportEmoji,
          championName: data.championName || "",
          championId: data.championId,
          llmSummary: data.llmSummary,
        });
      } else if (data.isPlayoffBulletin) {
        const results =
          data.results?.map((r) => ({
            homeName: r.home.name,
            homeId: r.home.id,
            awayName: r.away.name,
            awayId: r.away.id,
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            isUpset: r.isUpset,
          })) || [];
        cleanContent = formatPlayoffBulletin({
          leagueName: data.league.name,
          leagueId: data.league.id,
          sportEmoji: data.sportEmoji,
          roundName: data.roundName || "",
          results,
          llmSummary: data.llmSummary,
        });
      } else {
        const results =
          data.results?.map((r) => ({
            homeName: r.home.name,
            homeId: r.home.id,
            awayName: r.away.name,
            awayId: r.away.id,
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            isUpset: r.isUpset,
          })) || [];
        const movers = data.movers?.map((m) => ({
          name: m.name,
          id: m.id,
          oldRank: m.oldRank,
          newRank: m.newRank,
        }));
        cleanContent = formatMatchDayBulletin({
          leagueName: data.league.name,
          leagueId: data.league.id,
          sportEmoji: data.sportEmoji,
          matchDay: data.matchDay || 0,
          results,
          movers,
          llmSummary: data.llmSummary,
        });
      }

      const updatedContent = encodeSportsBulletin(data, cleanContent);

      if (updatedContent.trim() === post.content?.trim()) {
        skippedCount++;
        continue;
      }

      console.log(`[UPDATE REQUIRED] Post ${post.id} (${post.ixTimeTimestamp.toISOString()}):`);
      console.log(
        `  - League: ${data.league.name}${data.matchDay ? ` (Matchday ${data.matchDay})` : ""}`
      );
      if (data.isChampionBulletin) {
        console.log(
          `  - Champion: ${data.championName} (${data.championId ? `Linked: ${data.championId}` : "Not Found"})`
        );
      } else if (data.isPlayoffBulletin) {
        console.log(`  - Playoff Round: ${data.roundName}`);
      } else {
        console.log(`  - Results: ${data.results?.length ?? 0}`);
      }

      if (writeMode) {
        await db.thinkpagesPost.update({
          where: { id: post.id },
          data: { content: updatedContent },
        });
        console.log(`  - Saved successfully!`);
      } else {
        console.log(`  - [Dry-Run] Would update content.`);
      }

      parsedCount++;
    } catch (err) {
      console.error(`❌ Error processing post ${post.id}:`, err);
      errorCount++;
    }
  }

  console.log("\nMigration Summary:");
  console.log(`- Total processed: ${posts.length}`);
  console.log(`- Successfully parsed/updated: ${parsedCount}`);
  console.log(`- Skipped/No changes: ${skippedCount}`);
  console.log(`- Errors: ${errorCount}`);

  if (!writeMode && parsedCount > 0) {
    console.log(
      "\n💡 Run with --write to write changes to the database: bunx tsx scripts/migration/backfill-sports-posts.ts --write"
    );
  }
}

main()
  .catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
