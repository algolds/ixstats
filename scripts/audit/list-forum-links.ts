#!/usr/bin/env tsx

/**
 * Lists every IxStats user with a linked forum account (WK-1 audit). Read-only.
 *
 * Forum links made before verification codes (rose-garden 2026-09) needed no proof, so each one
 * should be reviewed: a user holding someone else's forum account posts, edits and deletes as them.
 * Forum accounts linked to more than one user are flagged first. A proven owner who verifies later
 * takes the link over automatically; to drop a suspect link now, unlink it from the admin user tools.
 *
 * Run with:
 *   bun run audit:forum-links            (uses DATABASE_URL from the environment)
 *   bun run audit:forum-links --json     (machine-readable output)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ForumLinkRow {
  userId: string;
  clerkUserId: string;
  forumUserId: number;
  forumUsername: string | null;
  lastForumSync: string | null;
  linkedAt: string;
  country: string | null;
  sharedWith: number;
}

async function main() {
  const asJson = process.argv.includes("--json");

  const users = await prisma.user.findMany({
    where: { forumUserId: { not: null } },
    select: {
      id: true,
      clerkUserId: true,
      forumUserId: true,
      forumUsername: true,
      lastForumSync: true,
      updatedAt: true,
      country: { select: { name: true } },
    },
    orderBy: [{ forumUserId: "asc" }, { updatedAt: "asc" }],
    take: 100_000,
  });

  const holders = new Map<number, number>();
  for (const u of users) holders.set(u.forumUserId!, (holders.get(u.forumUserId!) ?? 0) + 1);

  const rows: ForumLinkRow[] = users.map((u) => ({
    userId: u.id,
    clerkUserId: u.clerkUserId,
    forumUserId: u.forumUserId!,
    forumUsername: u.forumUsername,
    lastForumSync: u.lastForumSync?.toISOString() ?? null,
    linkedAt: u.updatedAt.toISOString(),
    country: u.country?.name ?? null,
    sharedWith: (holders.get(u.forumUserId!) ?? 1) - 1,
  }));
  rows.sort((a, b) => b.sharedWith - a.sharedWith || a.forumUserId - b.forumUserId);

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const shared = rows.filter((r) => r.sharedWith > 0);
  console.log(`Forum links: ${rows.length} users, ${holders.size} forum accounts`);
  console.log(
    `Forum accounts linked to more than one user: ${new Set(shared.map((r) => r.forumUserId)).size}`
  );
  console.log("");
  console.table(
    rows.map((r) => ({
      forumUserId: r.forumUserId,
      forumUsername: r.forumUsername ?? "",
      shared: r.sharedWith > 0 ? `+${r.sharedWith}` : "",
      clerkUserId: r.clerkUserId,
      country: r.country ?? "",
      lastForumSync: r.lastForumSync ?? "",
    }))
  );
  console.log(
    "\nThese links were made without proof unless the user re-verified with a forum profile code."
  );
}

main()
  .catch((error) => {
    console.error("[audit:forum-links] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
