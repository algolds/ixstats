import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import fs from "fs";

const OUTPUT_FILE = "scripts/audit_output.txt";
fs.writeFileSync(OUTPUT_FILE, "");

function log(msg: string = "") {
  console.log(msg);
  fs.appendFileSync(OUTPUT_FILE, msg + "\n");
}

import { db as prisma } from "../src/server/db";

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

function sanitize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/\0/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return sanitize(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface MWUser {
  userid: number;
  name: string;
  editcount: number;
  registration?: string;
  groups?: string[];
}

async function fetchAllMediaWikiUsers(): Promise<MWUser[]> {
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

    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as any;
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

      if (data?.["continue"]?.aufrom) {
        aufrom = data["continue"].aufrom;
      } else {
        break;
      }
    } catch (e) {
      console.warn("MW fetch error:", e);
      break;
    }
  }

  return allUsers;
}

async function main() {
  log("==================================================================");
  log("📊 MEDIAWIKI <-> IXNAYID (IXSTATES) ACCOUNT MATCHING AUDIT");
  log("==================================================================");

  // 1. Fetch all MediaWiki users
  const mwUsers = await fetchAllMediaWikiUsers();
  log(`\nFound ${mwUsers.length} total MediaWiki users on ${MEDIAWIKI_URL}.`);

  // 2. Fetch all IxStates User records with Country and linked identities
  const dbUsers = await prisma.user.findMany({
    include: {
      country: {
        select: {
          id: true,
          name: true,
          slug: true,
          leaderName: true,
          discordUserId: true,
          forumUsername: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  log(`Found ${dbUsers.length} total IxStates User accounts in PostgreSQL.`);

  // Categorize
  const alreadyLinked: Array<{ user: any; mwUser?: MWUser }> = [];
  const unlinkedUsers: typeof dbUsers = [];
  const mwMapByName = new Map<string, MWUser>();
  const mwMapByNormalized = new Map<string, MWUser>();

  for (const mwu of mwUsers) {
    mwMapByName.set(mwu.name.toLowerCase(), mwu);
    const norm = normalize(mwu.name);
    if (norm && !mwMapByNormalized.has(norm)) {
      mwMapByNormalized.set(norm, mwu);
    }
  }

  for (const u of dbUsers) {
    if (u.wikiUsername) {
      const mw = mwMapByName.get(u.wikiUsername.toLowerCase());
      alreadyLinked.push({ user: u, mwUser: mw });
    } else {
      unlinkedUsers.push(u);
    }
  }

  // 3. Exact Unlinked Matches (by forumUsername, discordUsername, country.name, country.slug, country.leaderName, etc.)
  interface MatchCandidate {
    user: (typeof dbUsers)[0];
    mwUser: MWUser;
    matchType: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    details: string;
  }

  const candidates: MatchCandidate[] = [];
  const usedMwUsers = new Set<string>();

  // Add already linked to used set
  for (const al of alreadyLinked) {
    if (al.user.wikiUsername) {
      usedMwUsers.add(al.user.wikiUsername.toLowerCase());
    }
  }

  for (const u of unlinkedUsers) {
    let matched = false;

    // Check 1: forumUsername exact match
    if (u.forumUsername) {
      const mw = mwMapByName.get(u.forumUsername.toLowerCase());
      if (mw) {
        candidates.push({
          user: u,
          mwUser: mw,
          matchType: "forumUsername (Exact)",
          confidence: "HIGH",
          details: `forumUsername: "${u.forumUsername}" === MW: "${mw.name}" (Edits: ${mw.editcount})`,
        });
        matched = true;
      }
    }

    // Check 2: discordUsername exact match
    if (!matched && u.discordUsername) {
      const cleanDiscord = u.discordUsername.replace(/#\d+$/, "");
      const mw = mwMapByName.get(cleanDiscord.toLowerCase());
      if (mw) {
        candidates.push({
          user: u,
          mwUser: mw,
          matchType: "discordUsername (Exact)",
          confidence: "HIGH",
          details: `discordUsername: "${u.discordUsername}" === MW: "${mw.name}" (Edits: ${mw.editcount})`,
        });
        matched = true;
      }
    }

    // Check 3: country.name exact match (In IxWiki, nation names are very frequently player wiki accounts)
    if (!matched && u.country?.name) {
      const mw = mwMapByName.get(u.country.name.toLowerCase());
      if (mw) {
        candidates.push({
          user: u,
          mwUser: mw,
          matchType: "country.name (Exact)",
          confidence: "HIGH",
          details: `Country: "${u.country.name}" === MW: "${mw.name}" (Edits: ${mw.editcount})`,
        });
        matched = true;
      }
    }

    // Check 4: country.slug match
    if (!matched && u.country?.slug) {
      const mw = mwMapByName.get(u.country.slug.toLowerCase());
      if (mw) {
        candidates.push({
          user: u,
          mwUser: mw,
          matchType: "country.slug (Exact)",
          confidence: "HIGH",
          details: `Country slug: "${u.country.slug}" === MW: "${mw.name}" (Edits: ${mw.editcount})`,
        });
        matched = true;
      }
    }

    // Check 5: country.leaderName exact match
    if (!matched && u.country?.leaderName) {
      const mw = mwMapByName.get(u.country.leaderName.toLowerCase());
      if (mw) {
        candidates.push({
          user: u,
          mwUser: mw,
          matchType: "country.leaderName (Exact)",
          confidence: "MEDIUM",
          details: `Country leaderName: "${u.country.leaderName}" === MW: "${mw.name}" (Edits: ${mw.editcount})`,
        });
        matched = true;
      }
    }

    // Check 6: Normalized fuzzy matches (alphanumeric match)
    if (!matched) {
      const targets = [
        { field: "forumUsername", val: u.forumUsername },
        { field: "discordUsername", val: u.discordUsername },
        { field: "country.name", val: u.country?.name },
        { field: "country.leaderName", val: u.country?.leaderName },
      ];

      for (const t of targets) {
        if (!t.val) continue;
        const norm = normalize(t.val);
        if (norm.length >= 3) {
          const mw = mwMapByNormalized.get(norm);
          if (mw) {
            candidates.push({
              user: u,
              mwUser: mw,
              matchType: `${t.field} (Fuzzy/Normalized)`,
              confidence: "MEDIUM",
              details: `${t.field}: "${t.val}" (norm: ${norm}) ~~~ MW: "${mw.name}" (Edits: ${mw.editcount})`,
            });
            matched = true;
            break;
          }
        }
      }
    }
  }

  // 4. Output Summary Tables
  log("\n==================================================================");
  log("1. ALREADY LINKED ACCOUNTS (Current Status)");
  log("==================================================================");
  log(`Total already linked: ${alreadyLinked.length}`);
  for (const al of alreadyLinked) {
    log(
      `  - User: ${al.user.id.substring(0, 10)}... | Clerk: ${al.user.clerkUserId.substring(0, 15)}... | Wiki: "${al.user.wikiUsername}" (MW UserID: ${al.user.wikiUserId || "N/A"}) | Country: "${al.user.country?.name || "N/A"}" | Forum: "${al.user.forumUsername || "N/A"}" | Discord: "${al.user.discordUsername || "N/A"}"`
    );
  }

  log("\n==================================================================");
  log("2. HIGH & MEDIUM CONFIDENCE MATCH CANDIDATES");
  log("==================================================================");
  log(`Total match candidates found: ${candidates.length}`);
  for (const c of candidates) {
    log(`  [${c.confidence}] ${c.matchType}`);
    log(
      `      IxStates User: ID=${c.user.id.substring(0, 10)}... Country="${c.user.country?.name || "N/A"}" Forum="${c.user.forumUsername || "N/A"}" Discord="${c.user.discordUsername || "N/A"}"`
    );
    log(
      `      Matched MW User: "${c.mwUser.name}" (MW ID: ${c.mwUser.userid}, Edits: ${c.mwUser.editcount})`
    );
    log(`      Details: ${c.details}\n`);
  }

  // 5. Active MediaWiki users with edits > 0 that remain unmatched
  const activeUnmatchedMW = mwUsers
    .filter(
      (mwu) =>
        mwu.editcount > 0 &&
        !usedMwUsers.has(mwu.name.toLowerCase()) &&
        !candidates.some((c) => c.mwUser.name.toLowerCase() === mwu.name.toLowerCase())
    )
    .sort((a, b) => b.editcount - a.editcount);

  log("\n==================================================================");
  log("3. ACTIVE MEDIAWIKI USERS (Edits > 0) CURRENTLY UNMATCHED");
  log("==================================================================");
  log(`Total active unmatched MediaWiki users: ${activeUnmatchedMW.length}`);
  for (const u of activeUnmatchedMW.slice(0, 30)) {
    log(
      `  - "${u.name}" (ID: ${u.userid}) | Edits: ${u.editcount} | Registered: ${u.registration || "N/A"} | Groups: ${u.groups?.join(", ") || "none"}`
    );
  }
  if (activeUnmatchedMW.length > 30) {
    log(`  ... and ${activeUnmatchedMW.length - 30} more.`);
  }

  // 6. Remaining unlinked IxStates users
  const matchedUserIds = new Set(candidates.map((c) => c.user.id));
  const remainingUnlinkedUsers = unlinkedUsers.filter((u) => !matchedUserIds.has(u.id));
  log("\n==================================================================");
  log("4. IXSTATES USERS WITH NO WIKI MATCH CANDIDATE");
  log("==================================================================");
  log(`Total unmatched IxStates users: ${remainingUnlinkedUsers.length}`);
  for (const u of remainingUnlinkedUsers) {
    log(
      `  - User: ${u.id.substring(0, 10)}... | Clerk: ${u.clerkUserId.substring(0, 15)}... | Country: "${u.country?.name || "N/A"}" | Forum: "${u.forumUsername || "N/A"}" | Discord: "${u.discordUsername || "N/A"}"`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
