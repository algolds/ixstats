/**
 * scripts/sync-all-users-wiki.ts — Complete User Profile & Contribution Synchronization Engine
 *
 * Discovers every registered MediaWiki user on https://ixwiki.com,
 * syncs their full contribution history into PostgreSQL wiki_revisions,
 * auto-links IxStats accounts, and rebuilds the Loreward telemetry leaderboard.
 *
 * Usage:
 *   bun run scripts/sync-all-users-wiki.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

function sanitize(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

async function fetchWithRetry(url: string, retries = 6, baseDelay = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(25000),
      });

      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        const retryAfter = res.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : baseDelay * Math.pow(1.5, attempt);
        console.warn(`   ⏳ Rate limited (${res.status}). Waiting ${(waitTime / 1000).toFixed(1)}s (Attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === retries) throw err;
      const wait = baseDelay * attempt;
      console.warn(`   ⚠️ Fetch attempt ${attempt} failed: ${err.message}. Retrying in ${(wait / 1000).toFixed(1)}s...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  return null;
}

interface MWUser {
  userid: number;
  name: string;
  editcount: number;
  registration?: string;
  groups?: string[];
}

async function fetchAllUsers(): Promise<MWUser[]> {
  console.log("📦 1/4 Discovering all registered MediaWiki users...");
  const allUsers: MWUser[] = [];
  let aufrom: string | undefined = undefined;

  while (true) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "allusers");
    url.searchParams.set("auprop", "editcount|registration|groups");
    url.searchParams.set("aulimit", "500");
    url.searchParams.set("format", "json");
    if (aufrom) {
      url.searchParams.set("aufrom", aufrom);
    }

    const data = await fetchWithRetry(url.toString());
    if (!data) break;

    const users = data?.query?.allusers || [];
    if (users.length === 0) break;

    for (const u of users) {
      allUsers.push({
        userid: Number(u.userid),
        name: sanitize(u.name),
        editcount: Number(u.editcount || 0),
        registration: u.registration,
        groups: u.groups || [],
      });
    }

    console.log(`   Found ${allUsers.length} total registered users so far...`);

    const continueParam = data?.continue?.aufrom;
    if (!continueParam) break;
    aufrom = continueParam;
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(`✅ Discovered ${allUsers.length} registered MediaWiki users.`);
  return allUsers;
}

async function syncUserContributions(user: MWUser) {
  if (user.editcount === 0) return 0;

  let uccontinue: string | undefined = undefined;
  let synced = 0;

  while (true) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "usercontribs");
    url.searchParams.set("ucuser", user.name);
    url.searchParams.set("uclimit", "500");
    url.searchParams.set("ucprop", "ids|title|timestamp|comment|size|flags");
    url.searchParams.set("format", "json");
    if (uccontinue) {
      url.searchParams.set("uccontinue", uccontinue);
    }

    const data = await fetchWithRetry(url.toString());
    if (!data) break;

    const contribs = data?.query?.usercontribs || [];
    if (contribs.length === 0) break;

    for (const c of contribs) {
      const revId = Number(c.revid || 0);
      if (revId <= 0) continue;

      const existing = await prisma.wikiRevision.findFirst({
        where: { source: "ixwiki", mwRevId: revId },
        select: { id: true },
      });

      if (!existing) {
        const rawTitle = sanitize(String(c.title || "").replace(/_/g, " ").trim());
        const article = await prisma.wikiArticle.findFirst({
          where: { source: "ixwiki", title: rawTitle },
          select: { id: true },
        });

        if (article) {
          await prisma.wikiRevision.create({
            data: {
              articleId: article.id,
              mwRevId: revId,
              author: user.name,
              summary: sanitize(c.comment || ""),
              wikitext: "",
              byteSize: Number(c.size || 0),
              byteDelta: Number(c.sizediff || 0),
              minor: Boolean(c.minor !== undefined),
              format: "WIKITEXT",
              source: "ixwiki",
              createdAt: c.timestamp ? new Date(c.timestamp) : new Date(),
            },
          });
          synced++;
        }
      }
    }

    uccontinue = data?.continue?.uccontinue;
    if (!uccontinue) break;
    await new Promise((r) => setTimeout(r, 60));
  }

  return synced;
}

async function linkUserAccounts(users: MWUser[]) {
  console.log("\n📦 3/4 Auto-linking IxStats Passport profiles to MediaWiki credentials...");
  let linked = 0;

  for (const u of users) {
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { wikiUsername: { equals: u.name, mode: "insensitive" } },
            { name: { equals: u.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, wikiUsername: true, wikiUserId: true },
      });

      if (dbUser) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            wikiUsername: u.name,
            wikiUserId: u.userid,
            lastWikiSync: new Date(),
          },
        });
        linked++;
      }
    } catch {}
  }

  console.log(`✅ Auto-linked and refreshed ${linked} user passport profiles.`);
}

async function rebuildLorewardStats() {
  console.log("\n📦 4/4 Rebuilding Loreward User Telemetry & Leaderboards...");
  const authors = await prisma.wikiRevision.groupBy({
    by: ["author"],
    where: { source: "ixwiki", author: { not: null } },
    _count: { id: true },
    _sum: { byteSize: true },
  });

  let profilesUpdated = 0;
  for (const a of authors) {
    if (!a.author) continue;
    const count = a._count.id;
    const totalBytes = a._sum.byteSize || 0;
    const score = count * 10 + Math.round(totalBytes / 500);

    await prisma.lorewardUserStats.upsert({
      where: { username: a.author },
      create: {
        username: a.author,
        totalScore: score,
        totalBytes,
        currentStreak: 1,
        longestStreak: 1,
      },
      update: {
        totalScore: score,
        totalBytes,
      },
    });
    profilesUpdated++;
  }

  console.log(`✅ Rebuilt ${profilesUpdated} Loreward user telemetry profiles.`);
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 WikiOS Comprehensive User Profile & Contribution Sync Engine");
  console.log(`   Source: ${API_URL}`);
  console.log("==================================================================");

  const startTime = Date.now();
  const users = await fetchAllUsers();

  const activeUsers = users.filter((u) => u.editcount > 0);
  console.log(`\n📦 2/4 Syncing contributions for ${activeUsers.length} active contributors...`);

  let totalRevsSynced = 0;
  let userIdx = 0;

  for (const u of activeUsers) {
    userIdx++;
    const synced = await syncUserContributions(u);
    totalRevsSynced += synced;
    if (synced > 0 || userIdx % 25 === 0 || userIdx === activeUsers.length) {
      console.log(`   [${userIdx}/${activeUsers.length}] Synced ${synced} new edits for "${u.name}" (Total edits on wiki: ${u.editcount})`);
    }
  }

  await linkUserAccounts(users);
  await rebuildLorewardStats();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 User Synchronization Complete in ${totalTime}s! Total New Revisions Synced: ${totalRevsSynced}`);
  await prisma.$disconnect();
  process.exit(0);
}

main();
